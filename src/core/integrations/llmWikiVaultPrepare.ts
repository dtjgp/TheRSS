import { lstat, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { DiscoveryItem } from '../../shared/discovery'
import {
  LLM_WIKI_PROMOTION_PREVIEW_VERSION,
  llmWikiPromotionPreviewSchema
} from '../../shared/llmWikiPromotion'
import type { PreparedLlmWikiPromotion } from './llmWikiPromotionService'
import {
  archiveBasename,
  assertNoActiveNoteContent,
  assertSafeParentDirectory,
  assertSafePathChain,
  buildPaths,
  buildPrompt,
  buildSidecar,
  existingSidecarForArxiv,
  hashText,
  normalizeNoteBoilerplate,
  preflightVault,
  readRegularFile,
  romeDate,
  validateNoteMarkdown
} from './llmWikiVaultSupport'
import {
  MUTABLE_INDEX_PATHS,
  llmWikiPromotionAnalysisSchema,
  type LlmWikiVaultRuntime,
  type StagedPromotionHandle,
  type VaultPreflight
} from './llmWikiVaultTypes'

export async function prepareLlmWikiPromotion(
  runtime: LlmWikiVaultRuntime,
  item: DiscoveryItem,
  context: { readonly previewId: string; readonly expiresAt: string }
): Promise<PreparedLlmWikiPromotion> {
  const preparedAt = runtime.now().toISOString()
  let preflight: VaultPreflight
  try {
    preflight = await preflightVault(runtime.vaultRoot, runtime.trustedRuntimeHash)
    if (!(await runtime.codexAvailable())) throw new Error('Codex CLI was not found')
  } catch (error) {
    const blocker = error instanceof Error ? error.message : 'llm-wiki preflight failed'
    return {
      preview: llmWikiPromotionPreviewSchema.parse({
        version: LLM_WIKI_PROMOTION_PREVIEW_VERSION,
        previewId: null,
        itemId: item.id,
        arxivId: item.externalId.replace(/v\d+$/u, ''),
        title: item.title,
        ready: false,
        vaultLabel: 'llm-wiki',
        level: null,
        routingRationale: 'The live llm-wiki contract could not be prepared safely.',
        intendedPaths: [],
        pdf: null,
        evidenceBoundary: 'No vault write was attempted.',
        blockers: [blocker],
        sourceHash: '0'.repeat(64),
        contractHash: '0'.repeat(64),
        expiresAt: context.expiresAt
      }),
      opaqueHandle: {
        kind: 'therss-llm-wiki-staged-v1',
        stageDirectory: null,
        stagedPdfPath: null,
        vaultRoot: runtime.vaultRoot,
        sourceItem: null,
        analysis: null,
        sidecarMarkdown: null,
        sidecarPreexisting: false,
        paths: { pdf: null, sidecar: null, note: null, audit: null },
        mutableHashes: {},
        preparedAt
      } satisfies StagedPromotionHandle
    }
  }

  const stageDirectory = await mkdtemp(join(runtime.tempRoot, 'therss-llm-wiki-promotion-'))
  const stagedPdfPath = join(stageDirectory, 'paper.pdf')
  try {
    const pdfUrl = `https://arxiv.org/pdf/${item.externalId}`
    const existingSidecar = await existingSidecarForArxiv(
      preflight.root,
      item.externalId.replace(/v\d+$/u, '')
    )
    const plannedPdfPath = existingSidecar
      ? `raw/papers/${basename(existingSidecar.path, '.md')}.pdf`
      : `raw/papers/${archiveBasename(item)}.pdf`
    if (existingSidecar) {
      try {
        await assertSafePathChain(preflight.root, plannedPdfPath, 'file')
        throw new Error(
          `This arXiv paper is already archived in ${plannedPdfPath} with ${existingSidecar.path}`
        )
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.startsWith('This arXiv paper') ||
            !('code' in error) ||
            error.code !== 'ENOENT')
        ) {
          throw error
        }
      }
    }
    const pdfBytes = await runtime.fetchPdf(pdfUrl)
    await writeFile(stagedPdfPath, pdfBytes, { flag: 'wx' })
    const pdf = await runtime.inspectPdf(stagedPdfPath)
    let analysis = llmWikiPromotionAnalysisSchema.parse(
      await runtime.runCodex({
        prompt: buildPrompt(item, pdf.text, preflight, plannedPdfPath),
        stageDirectory
      })
    )
    assertNoActiveNoteContent(analysis.noteMarkdown)
    if (!preflight.domains[analysis.level].includes(analysis.domain)) {
      throw new Error('Codex selected a non-canonical llm-wiki domain')
    }
    if (analysis.relatedPaths.some((path) => !preflight.knowledgePaths.includes(path))) {
      throw new Error('Codex selected a non-canonical llm-wiki Topic/Method page')
    }
    const routingTimestamp = runtime.now()
    let paths = buildPaths(item, analysis, routingTimestamp)
    if (existingSidecar) {
      paths = {
        ...paths,
        sidecar: existingSidecar.path,
        pdf: plannedPdfPath
      }
    }
    analysis = normalizeNoteBoilerplate(
      item,
      analysis,
      paths.pdf,
      romeDate(routingTimestamp.toISOString())
    )
    validateNoteMarkdown(item, analysis, preflight, paths)
    const targetPaths = [
      paths.pdf,
      ...(existingSidecar ? [] : [paths.sidecar]),
      paths.note,
      paths.audit
    ]
    for (const relativePath of targetPaths) {
      if (!relativePath) throw new Error('A required promotion path is missing')
      const absolutePath = join(preflight.root, relativePath)
      await assertSafeParentDirectory(preflight.root, absolutePath)
      try {
        await lstat(absolutePath)
        throw new Error(`The promotion target already exists: ${relativePath}`)
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.startsWith('The promotion target') ||
            !('code' in error) ||
            error.code !== 'ENOENT')
        ) {
          throw error
        }
      }
    }
    const mutablePaths = [
      ...(existingSidecar ? [existingSidecar.path] : []),
      ...analysis.relatedPaths,
      ...MUTABLE_INDEX_PATHS
    ]
    const mutableHashes = Object.fromEntries(
      await Promise.all(
        mutablePaths.map(async (path) => [
          path,
          hashText(await readRegularFile(preflight.root, path))
        ])
      )
    )
    const intendedPaths = [
      paths.pdf,
      paths.sidecar,
      paths.note,
      ...analysis.relatedPaths,
      ...MUTABLE_INDEX_PATHS,
      paths.audit
    ]
    const preview = llmWikiPromotionPreviewSchema.parse({
      version: LLM_WIKI_PROMOTION_PREVIEW_VERSION,
      previewId: context.previewId,
      itemId: item.id,
      arxivId: item.externalId.replace(/v\d+$/u, ''),
      title: item.title,
      ready: true,
      vaultLabel: 'llm-wiki',
      level: analysis.level,
      routingRationale: analysis.routingRationale,
      intendedPaths,
      pdf: {
        pageCount: pdf.pageCount,
        byteSize: pdf.byteSize,
        sha256: pdf.sha256
      },
      evidenceBoundary:
        'The note is based on a locally verified full-text PDF. Author-reported results are not reproduced results.',
      blockers: [],
      sourceHash: '0'.repeat(64),
      contractHash: preflight.contractHash,
      expiresAt: context.expiresAt
    })
    return {
      preview,
      opaqueHandle: {
        kind: 'therss-llm-wiki-staged-v1',
        stageDirectory,
        stagedPdfPath,
        vaultRoot: preflight.root,
        sourceItem: item,
        analysis,
        sidecarMarkdown: buildSidecar(item, paths.pdf),
        sidecarPreexisting: Boolean(existingSidecar),
        paths,
        mutableHashes,
        preparedAt
      } satisfies StagedPromotionHandle
    }
  } catch (error) {
    await rm(stageDirectory, { recursive: true, force: true })
    const blocker = error instanceof Error ? error.message : 'Paper preparation failed'
    return {
      preview: llmWikiPromotionPreviewSchema.parse({
        version: LLM_WIKI_PROMOTION_PREVIEW_VERSION,
        previewId: null,
        itemId: item.id,
        arxivId: item.externalId.replace(/v\d+$/u, ''),
        title: item.title,
        ready: false,
        vaultLabel: 'llm-wiki',
        level: null,
        routingRationale: 'The paper could not be staged safely for promotion.',
        intendedPaths: [],
        pdf: null,
        evidenceBoundary: 'No vault write was attempted.',
        blockers: [blocker],
        sourceHash: '0'.repeat(64),
        contractHash: preflight.contractHash,
        expiresAt: context.expiresAt
      }),
      opaqueHandle: {
        kind: 'therss-llm-wiki-staged-v1',
        stageDirectory: null,
        stagedPdfPath: null,
        vaultRoot: preflight.root,
        sourceItem: null,
        analysis: null,
        sidecarMarkdown: null,
        sidecarPreexisting: false,
        paths: { pdf: null, sidecar: null, note: null, audit: null },
        mutableHashes: {},
        preparedAt
      } satisfies StagedPromotionHandle
    }
  }
}

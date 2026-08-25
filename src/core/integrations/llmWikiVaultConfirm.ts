import { constants } from 'node:fs'
import { copyFile, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { LlmWikiPromotionReceipt } from '../../shared/llmWikiPromotion'
import type { PreparedLlmWikiPromotion } from './llmWikiPromotionService'
import {
  appendPromotionEntry,
  assertInsideRoot,
  assertSafeParentDirectory,
  atomicReplace,
  auditRecord,
  handleFrom,
  hashText,
  mergeSidecarArchiveLinks,
  preflightVault,
  promotionReceipt,
  readRegularFile,
  revalidateMutableFiles,
  romeDate,
  safeFilenamePart,
  updateRelatedFrontmatter,
  validateNoteMarkdown
} from './llmWikiVaultSupport'
import {
  AUTOMATION_ID,
  MUTABLE_INDEX_PATHS,
  type LlmWikiVaultRuntime,
  type PromotionPaths,
  type VaultPreflight
} from './llmWikiVaultTypes'

export async function confirmLlmWikiPromotion(
  runtime: LlmWikiVaultRuntime,
  prepared: PreparedLlmWikiPromotion
): Promise<LlmWikiPromotionReceipt> {
  const handle = handleFrom(prepared)
  const completedAt = runtime.now().toISOString()
  const receiptId = runtime.idFactory()
  if (
    !prepared.preview.ready ||
    !handle.stageDirectory ||
    !handle.stagedPdfPath ||
    !handle.analysis ||
    !handle.sidecarMarkdown ||
    !handle.paths.pdf ||
    !handle.paths.sidecar ||
    !handle.paths.note ||
    !handle.paths.audit ||
    !handle.sourceItem
  ) {
    return promotionReceipt(prepared.preview, {
      id: receiptId,
      status: 'blocked',
      summary: 'The prepared promotion was incomplete; no vault write was attempted.',
      blockers: ['Create a new promotion preview.'],
      startedAt: handle.preparedAt,
      completedAt
    })
  }

  let preflight: VaultPreflight
  try {
    preflight = await preflightVault(handle.vaultRoot, runtime.trustedRuntimeHash)
    if (preflight.contractHash !== prepared.preview.contractHash) {
      throw new Error('The live llm-wiki contract changed after preview')
    }
    await revalidateMutableFiles(preflight, handle)
  } catch (error) {
    return promotionReceipt(prepared.preview, {
      id: receiptId,
      status: 'blocked',
      summary: 'The live llm-wiki contract changed or could not be revalidated.',
      blockers: [error instanceof Error ? error.message : 'Vault preflight failed'],
      startedAt: handle.preparedAt,
      completedAt
    })
  }

  const ownerId = `therss-${runtime.idFactory()}`.slice(0, 128)
  const lease = await runtime.runRuntime(
    preflight.root,
    [
      'begin',
      AUTOMATION_ID,
      ownerId,
      '--ttl-seconds',
      '1800',
      '--metadata',
      JSON.stringify({ item_id: prepared.preview.itemId, arxiv_id: prepared.preview.arxivId })
    ],
    runtime.trustedRuntimeHash
  )
  if (lease.status !== 'acquired' && lease.status !== 'already-owned') {
    return promotionReceipt(prepared.preview, {
      id: receiptId,
      status: 'blocked',
      summary: 'The llm-wiki writer lease could not be acquired; no canonical file was written.',
      blockers: ['Another automation may own an overlapping vault scope.'],
      startedAt: handle.preparedAt,
      completedAt
    })
  }

  let mutableContents: Map<string, string>
  try {
    const lockedPreflight = await preflightVault(preflight.root, runtime.trustedRuntimeHash)
    if (lockedPreflight.contractHash !== prepared.preview.contractHash) {
      throw new Error('The live llm-wiki contract changed while acquiring the writer lease')
    }
    mutableContents = await revalidateMutableFiles(lockedPreflight, handle)
    preflight = lockedPreflight
  } catch (error) {
    let blockedAuditPath: string | null
    const blocker = error instanceof Error ? error.message : 'Locked vault preflight failed'
    const blockedAudit = auditRecord({
      status: 'blocked',
      arxivId: prepared.preview.arxivId,
      startedAt: handle.preparedAt,
      completedAt,
      actions: [
        'The writer lease was acquired.',
        'A governed file changed during lease acquisition; no paper artifact was written.'
      ],
      createdPaths: [handle.paths.audit],
      updatedPaths: [],
      blockers: [blocker],
      finalResponse: 'Promotion blocked before any paper artifact was written.'
    })
    try {
      const target = join(preflight.root, handle.paths.audit)
      await assertSafeParentDirectory(preflight.root, target)
      await writeFile(target, blockedAudit, { encoding: 'utf8', flag: 'wx' })
      blockedAuditPath = handle.paths.audit
    } catch {
      blockedAuditPath = null
    }
    const finish = await runtime.runRuntime(
      preflight.root,
      [
        'finish',
        AUTOMATION_ID,
        ownerId,
        'blocked',
        ...(blockedAuditPath ? ['--audit-record', blockedAuditPath] : [])
      ],
      runtime.trustedRuntimeHash
    )
    const releaseFailed = finish.status !== 'released'
    return promotionReceipt(prepared.preview, {
      id: receiptId,
      status: releaseFailed ? 'partial' : 'blocked',
      summary: releaseFailed
        ? 'The promotion was blocked, but the writer lease release could not be verified.'
        : 'The live llm-wiki contract changed while the writer lease was being acquired.',
      createdPaths: blockedAuditPath ? [blockedAuditPath] : [],
      auditPath: blockedAuditPath,
      blockers: [blocker, ...(releaseFailed ? ['The writer lease may still be held.'] : [])],
      startedAt: handle.preparedAt,
      completedAt
    })
  }

  const created: string[] = []
  const updated: string[] = []
  const originals = new Map<string, string>()
  const writtenHashes = new Map<string, string>()
  const pdfPath = handle.paths.pdf
  const sidecarPath = handle.paths.sidecar
  const notePath = handle.paths.note
  const auditPath = handle.paths.audit
  try {
    const pdfTarget = join(preflight.root, pdfPath)
    const sidecarTarget = join(preflight.root, sidecarPath)
    const noteTarget = join(preflight.root, notePath)
    const auditTarget = join(preflight.root, auditPath)
    for (const target of [pdfTarget, sidecarTarget, noteTarget, auditTarget]) {
      await assertSafeParentDirectory(preflight.root, target)
    }
    const initialAudit = auditRecord({
      status: 'partial',
      arxivId: prepared.preview.arxivId,
      startedAt: handle.preparedAt,
      completedAt,
      actions: [
        'The cooperative writer lease was acquired.',
        'The durable audit record was created before the first paper artifact write.'
      ],
      createdPaths: [auditPath],
      updatedPaths: [],
      blockers: ['The transaction was still active when this checkpoint was written.'],
      finalResponse: 'An interrupted transaction must be inspected before retrying.'
    })
    await writeFile(auditTarget, initialAudit, { encoding: 'utf8', flag: 'wx' })
    created.push(auditPath)
    writtenHashes.set(auditPath, hashText(initialAudit))
    await copyFile(handle.stagedPdfPath, pdfTarget, constants.COPYFILE_EXCL)
    created.push(pdfPath)
    writtenHashes.set(pdfPath, prepared.preview.pdf?.sha256 ?? '')
    if (!handle.sidecarPreexisting) {
      await writeFile(sidecarTarget, handle.sidecarMarkdown, { encoding: 'utf8', flag: 'wx' })
      created.push(sidecarPath)
      writtenHashes.set(sidecarPath, hashText(handle.sidecarMarkdown))
    }
    await writeFile(noteTarget, handle.analysis.noteMarkdown, { encoding: 'utf8', flag: 'wx' })
    created.push(notePath)
    writtenHashes.set(notePath, hashText(handle.analysis.noteMarkdown))

    const noteLink = notePath.replace(/\.md$/u, '')
    const safeTitle = safeFilenamePart(prepared.preview.title, prepared.preview.arxivId, 200)
    const entry = `- [[${noteLink}|${safeTitle}]] — arXiv ${prepared.preview.arxivId}; ${handle.analysis.level}; promoted by TheRSS.`
    const replacements = new Map<string, string>()
    if (handle.sidecarPreexisting) {
      const existing = mutableContents.get(sidecarPath)
      if (existing === undefined)
        throw new Error(`Missing mutable llm-wiki content: ${sidecarPath}`)
      replacements.set(sidecarPath, mergeSidecarArchiveLinks(existing, handle.sourceItem, pdfPath))
    }
    for (const path of handle.analysis.relatedPaths) {
      const content = mutableContents.get(path)
      if (content === undefined) throw new Error(`Missing mutable llm-wiki content: ${path}`)
      replacements.set(path, updateRelatedFrontmatter(content, noteLink, romeDate(completedAt)))
    }
    replacements.set(
      MUTABLE_INDEX_PATHS[0],
      appendPromotionEntry(
        mutableContents.get(MUTABLE_INDEX_PATHS[0]) ?? '',
        '## TheRSS manual promotions',
        entry,
        noteLink
      )
    )
    replacements.set(
      MUTABLE_INDEX_PATHS[1],
      appendPromotionEntry(
        mutableContents.get(MUTABLE_INDEX_PATHS[1]) ?? '',
        '## TheRSS promoted papers',
        entry,
        noteLink
      )
    )
    replacements.set(
      MUTABLE_INDEX_PATHS[2],
      `${(mutableContents.get(MUTABLE_INDEX_PATHS[2]) ?? '').trimEnd()}\n- **THRSS_PAPER_PROMOTION** | ${romeDate(completedAt)} | [[${noteLink}|${safeTitle}]] archived with verified PDF and ${handle.analysis.level} analysis; backlinks: ${handle.analysis.relatedPaths.map((path) => `[[${path.replace(/\.md$/u, '')}]]`).join(', ')}.\n`
    )
    for (const [path, content] of replacements) {
      const absolutePath = join(preflight.root, path)
      await assertSafeParentDirectory(preflight.root, absolutePath)
      const original = mutableContents.get(path)
      if (original === undefined) throw new Error(`Missing mutable llm-wiki content: ${path}`)
      originals.set(path, original)
      await atomicReplace(absolutePath, content, runtime.idFactory())
      writtenHashes.set(path, hashText(content))
      updated.push(path)
    }

    const completedAudit = auditRecord({
      status: 'completed',
      arxivId: prepared.preview.arxivId,
      startedAt: handle.preparedAt,
      completedAt,
      actions: [
        `Verified PDF SHA-256 ${prepared.preview.pdf?.sha256 ?? '[TBD]'} and ${prepared.preview.pdf?.pageCount ?? '[TBD]'} pages.`,
        `Created the PDF, same-basename sidecar, and ${handle.analysis.level} paper note.`,
        'Updated every selected Topic/Method backlink plus the paper index, root index, and operation log.',
        'Ran the exact-content and bidirectional-link post-write verifier.'
      ],
      createdPaths: created,
      updatedPaths: updated,
      blockers: [],
      finalResponse: 'The confirmed llm-wiki paper promotion completed and passed verification.'
    })
    const pdfBytes = await readFile(pdfTarget)
    const writtenSidecar = await readRegularFile(preflight.root, sidecarPath)
    const writtenNote = await readRegularFile(preflight.root, notePath)
    const expectedSidecar = replacements.get(sidecarPath) ?? handle.sidecarMarkdown
    if (
      pdfBytes.subarray(0, 5).toString('ascii') !== '%PDF-' ||
      hashText(pdfBytes) !== prepared.preview.pdf?.sha256 ||
      basename(pdfPath, '.pdf') !== basename(sidecarPath, '.md') ||
      writtenSidecar !== expectedSidecar ||
      writtenNote !== handle.analysis.noteMarkdown
    ) {
      throw new Error('Post-write artifact verification failed')
    }
    validateNoteMarkdown(
      handle.sourceItem,
      handle.analysis,
      preflight,
      handle.paths as PromotionPaths
    )
    for (const [path, expected] of replacements) {
      const written = await readRegularFile(preflight.root, path)
      if (
        written !== expected ||
        (handle.analysis.relatedPaths.includes(path) && !written.includes(`[[${noteLink}]]`))
      ) {
        throw new Error(`Post-write backlink verification failed: ${path}`)
      }
    }
    await atomicReplace(auditTarget, completedAudit, runtime.idFactory())
    writtenHashes.set(auditPath, hashText(completedAudit))
    if ((await readRegularFile(preflight.root, auditPath)) !== completedAudit) {
      throw new Error('Post-write audit verification failed')
    }
    const finish = await runtime.runRuntime(
      preflight.root,
      ['finish', AUTOMATION_ID, ownerId, 'completed', '--audit-record', auditPath],
      runtime.trustedRuntimeHash
    )
    if (finish.status !== 'released') throw new Error('The writer lease was not released cleanly')
    return promotionReceipt(prepared.preview, {
      id: receiptId,
      status: 'completed',
      summary: `Verified PDF, sidecar, and ${handle.analysis.level} note were saved to llm-wiki.`,
      createdPaths: created,
      updatedPaths: updated,
      auditPath,
      startedAt: handle.preparedAt,
      completedAt
    })
  } catch (error) {
    const survivingCreated: string[] = []
    const survivingUpdated: string[] = []
    for (const [path, content] of [...originals.entries()].reverse()) {
      try {
        const current = await readRegularFile(preflight.root, path)
        if (current === content) continue
        const writtenHash = writtenHashes.get(path)
        if (!writtenHash || hashText(current) !== writtenHash) {
          survivingUpdated.push(path)
          continue
        }
        await atomicReplace(join(preflight.root, path), content, runtime.idFactory())
      } catch {
        survivingUpdated.push(path)
      }
    }
    for (const path of [...created].reverse()) {
      try {
        const target = join(preflight.root, path)
        assertInsideRoot(preflight.root, target)
        const writtenHash = writtenHashes.get(path)
        if (!writtenHash || hashText(await readFile(target)) !== writtenHash) {
          survivingCreated.push(path)
          continue
        }
        await rm(target, { force: true })
      } catch (rollbackError) {
        if (
          rollbackError instanceof Error &&
          'code' in rollbackError &&
          rollbackError.code === 'ENOENT'
        ) {
          continue
        }
        survivingCreated.push(path)
      }
    }
    let partialAuditPath: string | null
    const partialAudit = auditRecord({
      status: 'partial',
      arxivId: prepared.preview.arxivId,
      startedAt: handle.preparedAt,
      completedAt,
      actions: [
        'A canonical write, artifact verifier, or lease finalizer failed.',
        'New transaction files and exact mutable-file snapshots were rolled back where possible.'
      ],
      createdPaths: survivingCreated.includes(auditPath)
        ? survivingCreated
        : [...survivingCreated, auditPath],
      updatedPaths: survivingUpdated,
      blockers: [error instanceof Error ? error.message : 'A canonical write or verifier failed.'],
      finalResponse: 'The promotion is partial; inspect llm-wiki before retrying.'
    })
    try {
      const partialAuditTarget = join(preflight.root, auditPath)
      assertInsideRoot(preflight.root, partialAuditTarget)
      if (survivingCreated.includes(auditPath)) {
        partialAuditPath = null
      } else {
        await writeFile(partialAuditTarget, partialAudit, { encoding: 'utf8', flag: 'wx' })
        survivingCreated.push(auditPath)
        partialAuditPath = auditPath
      }
    } catch {
      partialAuditPath = null
    }
    const finish = await runtime.runRuntime(
      preflight.root,
      [
        'finish',
        AUTOMATION_ID,
        ownerId,
        'partial',
        ...(partialAuditPath ? ['--audit-record', partialAuditPath] : [])
      ],
      runtime.trustedRuntimeHash
    )
    const releaseFailed = finish.status !== 'released'
    return promotionReceipt(prepared.preview, {
      id: receiptId,
      status: 'partial',
      summary:
        'The confirmed promotion did not pass all artifact checks; inspect llm-wiki before retrying.',
      createdPaths: survivingCreated,
      updatedPaths: survivingUpdated,
      auditPath: partialAuditPath,
      blockers: [
        'A canonical write or post-write verifier failed.',
        ...(releaseFailed ? ['The writer lease may still be held.'] : [])
      ],
      startedAt: handle.preparedAt,
      completedAt
    })
  }
}

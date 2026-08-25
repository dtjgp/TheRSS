import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import type { DiscoveryItem } from '../../shared/discovery'
import type { LlmWikiPromotionReceipt } from '../../shared/llmWikiPromotion'
import type { LlmWikiPromotionAdapter, PreparedLlmWikiPromotion } from './llmWikiPromotionService'
import { confirmLlmWikiPromotion } from './llmWikiVaultConfirm'
import { prepareLlmWikiPromotion } from './llmWikiVaultPrepare'
import {
  appendPromotionEntry,
  buildPaths,
  buildSidecar,
  handleFrom,
  mergeSidecarArchiveLinks,
  safeFilenamePart
} from './llmWikiVaultSupport'
import {
  TRUSTED_AUTOMATION_RUNTIME_SHA256,
  llmWikiPromotionAnalysisSchema,
  type LlmWikiVaultAdapterOptions,
  type LlmWikiVaultRuntime
} from './llmWikiVaultTypes'

export {
  llmWikiPromotionAnalysisSchema,
  type LlmWikiVaultAdapterOptions,
  type PdfInspection,
  type PromotionAnalysis
} from './llmWikiVaultTypes'

export class LlmWikiVaultAdapter implements LlmWikiPromotionAdapter {
  readonly #runtime: LlmWikiVaultRuntime

  constructor(options: LlmWikiVaultAdapterOptions) {
    this.#runtime = {
      vaultRoot:
        options.vaultRoot ??
        process.env.THERSS_LLM_WIKI_PATH ??
        join(homedir(), 'Obsidian', 'llm-wiki'),
      tempRoot: options.tempRoot ?? tmpdir(),
      trustedRuntimeHash: options.trustedRuntimeHash ?? TRUSTED_AUTOMATION_RUNTIME_SHA256,
      now: options.now ?? (() => new Date()),
      idFactory: options.idFactory ?? randomUUID,
      codexAvailable: options.codexAvailable,
      fetchPdf: options.fetchPdf,
      inspectPdf: options.inspectPdf,
      runCodex: options.runCodex,
      runRuntime: options.runRuntime
    }
  }

  prepare(
    item: DiscoveryItem,
    context: { readonly previewId: string; readonly expiresAt: string }
  ): Promise<PreparedLlmWikiPromotion> {
    return prepareLlmWikiPromotion(this.#runtime, item, context)
  }

  confirm(prepared: PreparedLlmWikiPromotion): Promise<LlmWikiPromotionReceipt> {
    return confirmLlmWikiPromotion(this.#runtime, prepared)
  }

  async dispose(prepared: PreparedLlmWikiPromotion): Promise<void> {
    const handle = handleFrom(prepared)
    if (!handle.stageDirectory) return
    const stageRoot = resolve(this.#runtime.tempRoot)
    const stageDirectory = resolve(handle.stageDirectory)
    const stageFromRoot = relative(stageRoot, stageDirectory)
    if (
      stageFromRoot.startsWith('..') ||
      isAbsolute(stageFromRoot) ||
      !basename(stageDirectory).startsWith('therss-llm-wiki-promotion-')
    ) {
      throw new Error('Refusing to remove an unsafe promotion staging directory')
    }
    await rm(stageDirectory, { recursive: true, force: true })
  }
}

export const llmWikiVaultAdapterInternals = {
  appendPromotionEntry,
  buildPaths,
  buildSidecar,
  mergeSidecarArchiveLinks,
  promotionAnalysisSchema: llmWikiPromotionAnalysisSchema,
  safeFilenamePart
}

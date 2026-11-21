import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, relative, resolve } from 'node:path'
import type { DiscoveryItem } from '../../shared/discovery'
import type { LlmWikiPromotionReceipt } from '../../shared/llmWikiPromotion'
import type { LlmWikiPromotionAdapter, PreparedLlmWikiPromotion } from './llmWikiPromotionService'
import { confirmLlmWikiPromotion } from './llmWikiVaultConfirm'
import { vaultRootResolver } from './llmWikiVaultPaths'
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
  readonly #runtime: Omit<LlmWikiVaultRuntime, 'vaultRoot'>
  readonly #resolveVaultRoot: () => string

  /**
   * `resolveVaultRoot` is read when a runtime is needed. Confirmation writes only to the root
   * recorded in the previewed handle, so a later folder change cannot redirect a confirmed write.
   */
  constructor(options: LlmWikiVaultAdapterOptions & { readonly resolveVaultRoot?: () => string }) {
    this.#resolveVaultRoot = vaultRootResolver(options)
    this.#runtime = {
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
    return prepareLlmWikiPromotion(this.#currentRuntime(), item, context)
  }

  confirm(prepared: PreparedLlmWikiPromotion): Promise<LlmWikiPromotionReceipt> {
    return confirmLlmWikiPromotion(this.#currentRuntime(), prepared)
  }

  #currentRuntime(): LlmWikiVaultRuntime {
    return { ...this.#runtime, vaultRoot: this.#resolveVaultRoot() }
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

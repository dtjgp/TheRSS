import { createHash, randomUUID } from 'node:crypto'
import type { DiscoveryItem } from '../../shared/discovery'
import {
  LLM_WIKI_PROMOTION_PROMPT_VERSION,
  LLM_WIKI_PROMOTION_RECEIPT_VERSION,
  llmWikiPromotionPreviewSchema,
  llmWikiPromotionReceiptSchema,
  type LlmWikiPromotionPreview,
  type LlmWikiPromotionReceipt
} from '../../shared/llmWikiPromotion'

interface PromotionRepository {
  getDiscoveryRecord(itemId: string): DiscoveryItem | null
  saveLlmWikiPromotionReceipt(receipt: LlmWikiPromotionReceipt): void
  getLatestLlmWikiPromotionReceipt(itemId: string): LlmWikiPromotionReceipt | null
}

export interface PreparedLlmWikiPromotion {
  readonly preview: LlmWikiPromotionPreview
  readonly opaqueHandle: unknown
}

export interface LlmWikiPromotionAdapter {
  prepare(
    item: DiscoveryItem,
    context: { readonly previewId: string; readonly expiresAt: string }
  ): Promise<PreparedLlmWikiPromotion>
  confirm(prepared: PreparedLlmWikiPromotion): Promise<LlmWikiPromotionReceipt>
  dispose(prepared: PreparedLlmWikiPromotion): Promise<void>
}

interface ServiceOptions {
  readonly now?: () => Date
  readonly previewIdFactory?: () => string
  readonly receiptIdFactory?: () => string
}

interface ActivePreview {
  readonly prepared: PreparedLlmWikiPromotion
  readonly sourceHash: string
  readonly expiresAt: string
  readonly itemId: string
  readonly ownerId: string
  readonly expirationTimer: ReturnType<typeof setTimeout>
}

const MAX_ACTIVE_PREVIEWS = 4

function canonicalArxivId(item: DiscoveryItem): string {
  if (item.source !== 'arxiv' || item.kind !== 'paper') {
    throw new Error('Only arXiv papers can be promoted to llm-wiki')
  }
  const match = /^(\d{4}\.\d{4,5})(?:v\d+)?$/u.exec(item.externalId)
  if (!match) throw new Error('The stored paper has no canonical arXiv identifier')
  let url: URL
  try {
    url = new URL(item.url)
  } catch {
    throw new Error('The stored paper has no canonical arXiv URL')
  }
  if (
    url.protocol !== 'https:' ||
    (url.hostname !== 'arxiv.org' && url.hostname !== 'www.arxiv.org') ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    (url.pathname !== `/abs/${item.externalId}` && url.pathname !== `/abs/${item.externalId}/`)
  ) {
    throw new Error('The stored paper has no canonical arXiv URL')
  }
  return match[1]!
}

export function hashPromotionSource(item: DiscoveryItem): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        id: item.id,
        source: item.source,
        kind: item.kind,
        externalId: item.externalId,
        title: item.title,
        summary: item.summary,
        url: item.url,
        publishedAt: item.publishedAt,
        updatedAt: item.updatedAt,
        authors: item.authors,
        categories: item.categories,
        topics: item.topics,
        language: item.language
      })
    )
    .digest('hex')
}

function baseReceipt(
  id: string,
  preview: LlmWikiPromotionPreview,
  status: LlmWikiPromotionReceipt['status'],
  now: string
): LlmWikiPromotionReceipt {
  return {
    version: LLM_WIKI_PROMOTION_RECEIPT_VERSION,
    id,
    itemId: preview.itemId,
    arxivId: preview.arxivId,
    status,
    runner: 'codex',
    promptVersion: LLM_WIKI_PROMOTION_PROMPT_VERSION,
    sourceHash: preview.sourceHash,
    contractHash: preview.contractHash,
    evidenceTier: status === 'running' ? 'pending' : 'partial',
    summary:
      status === 'running'
        ? 'Preparing the confirmed local llm-wiki write transaction.'
        : 'The prepared llm-wiki promotion was cancelled before writing.',
    createdPaths: [],
    updatedPaths: [],
    pdfPath: null,
    sidecarPath: null,
    notePath: null,
    auditPath: null,
    blockers: [],
    startedAt: now,
    completedAt: status === 'running' ? null : now
  }
}

export class LlmWikiPromotionService {
  readonly #repository: PromotionRepository
  readonly #adapter: LlmWikiPromotionAdapter
  readonly #now: () => Date
  readonly #previewIdFactory: () => string
  readonly #receiptIdFactory: () => string
  readonly #activePreviews = new Map<string, ActivePreview>()
  readonly #preparingItems = new Set<string>()
  readonly #inFlightOperations = new Set<Promise<unknown>>()
  #shuttingDown = false

  constructor(
    repository: PromotionRepository,
    adapter: LlmWikiPromotionAdapter,
    options: ServiceOptions = {}
  ) {
    this.#repository = repository
    this.#adapter = adapter
    this.#now = options.now ?? (() => new Date())
    this.#previewIdFactory = options.previewIdFactory ?? randomUUID
    this.#receiptIdFactory = options.receiptIdFactory ?? randomUUID
  }

  async preview(itemId: string, ownerId = 'local'): Promise<LlmWikiPromotionPreview> {
    this.#assertAcceptingOperations()
    const operation = this.#preparePreview(itemId, ownerId)
    this.#inFlightOperations.add(operation)
    try {
      return await operation
    } finally {
      this.#inFlightOperations.delete(operation)
    }
  }

  async #preparePreview(itemId: string, ownerId: string): Promise<LlmWikiPromotionPreview> {
    if (this.#preparingItems.has(itemId)) {
      throw new Error('A promotion preview is already being prepared for this paper')
    }
    const item = this.#repository.getDiscoveryRecord(itemId)
    if (!item) throw new Error(`Unknown discovery item: ${itemId}`)
    canonicalArxivId(item)
    this.#preparingItems.add(itemId)
    for (const [id, active] of this.#activePreviews) {
      if (active.itemId === itemId) await this.#disposeActive(id, active)
    }
    const previewId = this.#previewIdFactory()
    const expiresAt = new Date(this.#now().getTime() + 30 * 60_000).toISOString()
    try {
      const prepared = await this.#adapter.prepare(item, { previewId, expiresAt })
      const sourceHash = hashPromotionSource(item)
      const preview = llmWikiPromotionPreviewSchema.parse({
        ...prepared.preview,
        previewId: prepared.preview.ready ? previewId : null,
        itemId: item.id,
        arxivId: canonicalArxivId(item),
        title: item.title,
        sourceHash,
        expiresAt
      })
      const normalized = { ...prepared, preview }
      if (preview.ready && preview.previewId) {
        while (this.#activePreviews.size >= MAX_ACTIVE_PREVIEWS) {
          const oldest = this.#activePreviews.entries().next().value as
            [string, ActivePreview] | undefined
          if (!oldest) break
          await this.#disposeActive(oldest[0], oldest[1])
        }
        const expirationTimer = setTimeout(
          () => {
            const active = this.#activePreviews.get(preview.previewId!)
            if (active) void this.#disposeActive(preview.previewId!, active)
          },
          Math.max(0, new Date(expiresAt).getTime() - this.#now().getTime())
        )
        expirationTimer.unref?.()
        this.#activePreviews.set(preview.previewId, {
          prepared: normalized,
          sourceHash,
          expiresAt,
          itemId,
          ownerId,
          expirationTimer
        })
      } else {
        await this.#adapter.dispose(normalized)
      }
      return preview
    } finally {
      this.#preparingItems.delete(itemId)
    }
  }

  async confirm(previewId: string, ownerId = 'local'): Promise<LlmWikiPromotionReceipt> {
    this.#assertAcceptingOperations()
    const active = this.#activePreviews.get(previewId)
    if (!active || active.ownerId !== ownerId) {
      throw new Error('Promotion preview is missing, expired, or already used')
    }
    this.#activePreviews.delete(previewId)
    clearTimeout(active.expirationTimer)
    if (new Date(active.expiresAt).getTime() <= this.#now().getTime()) {
      await this.#adapter.dispose(active.prepared)
      throw new Error('Promotion preview is missing, expired, or already used')
    }
    const item = this.#repository.getDiscoveryRecord(active.prepared.preview.itemId)
    if (!item || hashPromotionSource(item) !== active.sourceHash) {
      await this.#adapter.dispose(active.prepared)
      throw new Error('The paper changed after preview; create a new promotion preview')
    }

    const operation = this.#completeConfirmation(active)
    this.#inFlightOperations.add(operation)
    try {
      return await operation
    } finally {
      this.#inFlightOperations.delete(operation)
    }
  }

  async #completeConfirmation(active: ActivePreview): Promise<LlmWikiPromotionReceipt> {
    const startedAt = this.#now().toISOString()
    try {
      this.#repository.saveLlmWikiPromotionReceipt(
        baseReceipt(
          `running:${this.#receiptIdFactory()}`,
          active.prepared.preview,
          'running',
          startedAt
        )
      )
      try {
        const receipt = llmWikiPromotionReceiptSchema.parse(
          await this.#adapter.confirm(active.prepared)
        )
        this.#repository.saveLlmWikiPromotionReceipt(receipt)
        return receipt
      } catch {
        const partial = {
          ...baseReceipt(
            `partial:${this.#receiptIdFactory()}`,
            active.prepared.preview,
            'partial',
            startedAt
          ),
          summary:
            'The vault write may have started, but TheRSS could not verify a valid terminal receipt.',
          blockers: ['Inspect the llm-wiki audit and writer lease before retrying.']
        } satisfies LlmWikiPromotionReceipt
        const validated = llmWikiPromotionReceiptSchema.parse(partial)
        try {
          this.#repository.saveLlmWikiPromotionReceipt(validated)
        } catch {
          // The conservative receipt is still returned when local receipt persistence is unavailable.
        }
        return validated
      }
    } finally {
      await this.#adapter.dispose(active.prepared)
    }
  }

  async cancel(previewId: string, ownerId = 'local'): Promise<LlmWikiPromotionReceipt> {
    this.#assertAcceptingOperations()
    const operation = this.#cancelPreview(previewId, ownerId)
    this.#inFlightOperations.add(operation)
    try {
      return await operation
    } finally {
      this.#inFlightOperations.delete(operation)
    }
  }

  async #cancelPreview(previewId: string, ownerId: string): Promise<LlmWikiPromotionReceipt> {
    const active = this.#activePreviews.get(previewId)
    if (!active || active.ownerId !== ownerId) {
      throw new Error('Promotion preview is missing, expired, or already used')
    }
    this.#activePreviews.delete(previewId)
    clearTimeout(active.expirationTimer)
    await this.#adapter.dispose(active.prepared)
    const receipt = baseReceipt(
      `skipped:${this.#receiptIdFactory()}`,
      active.prepared.preview,
      'skipped',
      this.#now().toISOString()
    )
    this.#repository.saveLlmWikiPromotionReceipt(receipt)
    return receipt
  }

  getLatest(itemId: string): LlmWikiPromotionReceipt | null {
    return this.#repository.getLatestLlmWikiPromotionReceipt(itemId)
  }

  async disposeAll(): Promise<void> {
    this.#shuttingDown = true
    while (this.#inFlightOperations.size > 0) {
      await Promise.allSettled([...this.#inFlightOperations])
    }
    const previews = [...this.#activePreviews.entries()]
    this.#activePreviews.clear()
    await Promise.allSettled(
      previews.map(async ([, active]) => {
        clearTimeout(active.expirationTimer)
        await this.#adapter.dispose(active.prepared)
      })
    )
  }

  #assertAcceptingOperations(): void {
    if (this.#shuttingDown) throw new Error('The llm-wiki promotion service is shutting down')
  }

  async #disposeActive(id: string, active: ActivePreview): Promise<void> {
    if (this.#activePreviews.get(id) === active) this.#activePreviews.delete(id)
    clearTimeout(active.expirationTimer)
    await this.#adapter.dispose(active.prepared)
  }
}

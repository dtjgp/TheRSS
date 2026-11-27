import { randomUUID } from 'node:crypto'
import type { DiscoveryItem } from '../../shared/discovery'
import {
  LLM_WIKI_INBOX_RECEIPT_VERSION,
  llmWikiInboxPreviewSchema,
  llmWikiInboxReceiptSchema,
  type LlmWikiInboxPreview,
  type LlmWikiInboxReceipt
} from '../../shared/llmWikiInbox'
import { hashPromotionSource } from './llmWikiPromotionService'

export interface LlmWikiInboxRepository {
  getDiscoveryRecord(itemId: string): DiscoveryItem | null
  saveReceipt(receipt: LlmWikiInboxReceipt): void
  getLatestReceipt(itemId: string): LlmWikiInboxReceipt | null
}

export interface PreparedLlmWikiInboxCapture {
  readonly preview: LlmWikiInboxPreview
  readonly opaqueHandle: unknown
}

export interface LlmWikiInboxAdapterPort {
  prepare(
    item: DiscoveryItem,
    context: { readonly previewId: string; readonly expiresAt: string; readonly sourceHash: string }
  ): Promise<PreparedLlmWikiInboxCapture>
  confirm(prepared: PreparedLlmWikiInboxCapture): Promise<LlmWikiInboxReceipt>
  dispose?(prepared: PreparedLlmWikiInboxCapture): Promise<void>
}

interface InboxServiceOptions {
  readonly now?: () => Date
  readonly previewIdFactory?: () => string
  readonly receiptIdFactory?: () => string
}

interface ActiveInboxPreview {
  readonly prepared: PreparedLlmWikiInboxCapture
  readonly sourceHash: string
  readonly expiresAt: string
  readonly itemId: string
  readonly ownerId: string
  readonly expirationTimer: ReturnType<typeof setTimeout>
}

const MAX_ACTIVE_PREVIEWS = 4

function assertEligibleInboxItem(item: DiscoveryItem): void {
  if (item.kind === 'paper') {
    throw new Error(
      'Papers use the full-text llm-wiki promotion workflow; Inbox capture is for repositories, models, and news items.'
    )
  }
  let parsed: URL
  try {
    parsed = new URL(item.url)
  } catch {
    throw new Error('The stored record has no valid HTTPS URL for llm-wiki Inbox capture')
  }
  if (parsed.protocol !== 'https:' || parsed.username !== '' || parsed.password !== '') {
    throw new Error('Only clean https:// records can be captured into llm-wiki Inbox')
  }
}

function baseInboxReceipt(
  id: string,
  preview: LlmWikiInboxPreview,
  status: LlmWikiInboxReceipt['status'],
  now: string
): LlmWikiInboxReceipt {
  return {
    version: LLM_WIKI_INBOX_RECEIPT_VERSION,
    id,
    itemId: preview.itemId,
    source: preview.source,
    kind: preview.kind,
    status,
    sourceHash: preview.sourceHash,
    contractHash: preview.contractHash,
    evidenceTier: status === 'running' ? 'pending' : 'partial',
    summary:
      status === 'running'
        ? 'Preparing the confirmed local llm-wiki Inbox write transaction.'
        : 'The prepared llm-wiki Inbox capture was cancelled before writing.',
    createdPaths: [],
    updatedPaths: [],
    notePath: null,
    auditPath: null,
    blockers: [],
    startedAt: now,
    completedAt: status === 'running' ? null : now
  }
}

export class LlmWikiInboxService {
  readonly #repository: LlmWikiInboxRepository
  readonly #adapter: LlmWikiInboxAdapterPort
  readonly #now: () => Date
  readonly #previewIdFactory: () => string
  readonly #receiptIdFactory: () => string
  readonly #activePreviews = new Map<string, ActiveInboxPreview>()
  readonly #preparingItems = new Set<string>()
  readonly #inFlightOperations = new Set<Promise<unknown>>()
  #shuttingDown = false

  constructor(
    repository: LlmWikiInboxRepository,
    adapter: LlmWikiInboxAdapterPort,
    options: InboxServiceOptions = {}
  ) {
    this.#repository = repository
    this.#adapter = adapter
    this.#now = options.now ?? (() => new Date())
    this.#previewIdFactory = options.previewIdFactory ?? randomUUID
    this.#receiptIdFactory = options.receiptIdFactory ?? randomUUID
  }

  async preview(itemId: string, ownerId = 'local'): Promise<LlmWikiInboxPreview> {
    this.#assertAcceptingOperations()
    const operation = this.#preparePreview(itemId, ownerId)
    this.#inFlightOperations.add(operation)
    try {
      return await operation
    } finally {
      this.#inFlightOperations.delete(operation)
    }
  }

  async #preparePreview(itemId: string, ownerId: string): Promise<LlmWikiInboxPreview> {
    if (this.#preparingItems.has(itemId)) {
      throw new Error('An Inbox capture preview is already being prepared for this item')
    }
    const item = this.#repository.getDiscoveryRecord(itemId)
    if (!item) throw new Error(`Unknown discovery item: ${itemId}`)
    assertEligibleInboxItem(item)
    this.#preparingItems.add(itemId)
    for (const [id, active] of this.#activePreviews) {
      if (active.itemId === itemId) await this.#disposeActive(id, active)
    }
    const previewId = this.#previewIdFactory()
    const expiresAt = new Date(this.#now().getTime() + 30 * 60_000).toISOString()
    const sourceHash = hashPromotionSource(item)
    try {
      const prepared = await this.#adapter.prepare(item, { previewId, expiresAt, sourceHash })
      const preview = llmWikiInboxPreviewSchema.parse({
        ...prepared.preview,
        previewId: prepared.preview.ready ? previewId : null,
        itemId: item.id,
        source: item.source,
        kind: item.kind,
        title: item.title,
        url: item.url,
        sourceHash,
        expiresAt
      })
      const normalized = { ...prepared, preview }
      if (preview.ready && preview.previewId) {
        while (this.#activePreviews.size >= MAX_ACTIVE_PREVIEWS) {
          const oldest = this.#activePreviews.entries().next().value as
            [string, ActiveInboxPreview] | undefined
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
        await this.#adapter.dispose?.(normalized)
      }
      return preview
    } finally {
      this.#preparingItems.delete(itemId)
    }
  }

  async confirm(previewId: string, ownerId = 'local'): Promise<LlmWikiInboxReceipt> {
    this.#assertAcceptingOperations()
    const active = this.#activePreviews.get(previewId)
    if (!active || active.ownerId !== ownerId) {
      throw new Error('Inbox capture preview is missing, expired, or already used')
    }
    this.#activePreviews.delete(previewId)
    clearTimeout(active.expirationTimer)
    if (new Date(active.expiresAt).getTime() <= this.#now().getTime()) {
      await this.#adapter.dispose?.(active.prepared)
      throw new Error('Inbox capture preview is missing, expired, or already used')
    }
    const item = this.#repository.getDiscoveryRecord(active.prepared.preview.itemId)
    if (!item || hashPromotionSource(item) !== active.sourceHash) {
      await this.#adapter.dispose?.(active.prepared)
      throw new Error('The record changed after preview; create a new Inbox capture preview')
    }
    const operation = this.#completeConfirmation(active)
    this.#inFlightOperations.add(operation)
    try {
      return await operation
    } finally {
      this.#inFlightOperations.delete(operation)
    }
  }

  async #completeConfirmation(active: ActiveInboxPreview): Promise<LlmWikiInboxReceipt> {
    const startedAt = this.#now().toISOString()
    try {
      this.#repository.saveReceipt(
        baseInboxReceipt(
          `running:${this.#receiptIdFactory()}`,
          active.prepared.preview,
          'running',
          startedAt
        )
      )
      try {
        const receipt = llmWikiInboxReceiptSchema.parse(
          await this.#adapter.confirm(active.prepared)
        )
        this.#repository.saveReceipt(receipt)
        return receipt
      } catch {
        const partial = llmWikiInboxReceiptSchema.parse({
          ...baseInboxReceipt(
            `partial:${this.#receiptIdFactory()}`,
            active.prepared.preview,
            'partial',
            startedAt
          ),
          summary:
            'The Inbox capture write may have started, but TheRSS could not verify a valid terminal receipt.',
          blockers: [
            'Inspect llm-wiki/Inbox, Automation_Conversations, and log.md before retrying.'
          ]
        })
        try {
          this.#repository.saveReceipt(partial)
        } catch {
          // Conservative receipt still returns when local persistence is unavailable.
        }
        return partial
      }
    } finally {
      await this.#adapter.dispose?.(active.prepared)
    }
  }

  async cancel(previewId: string, ownerId = 'local'): Promise<LlmWikiInboxReceipt> {
    this.#assertAcceptingOperations()
    const operation = this.#cancelPreview(previewId, ownerId)
    this.#inFlightOperations.add(operation)
    try {
      return await operation
    } finally {
      this.#inFlightOperations.delete(operation)
    }
  }

  async #cancelPreview(previewId: string, ownerId: string): Promise<LlmWikiInboxReceipt> {
    const active = this.#activePreviews.get(previewId)
    if (!active || active.ownerId !== ownerId) {
      throw new Error('Inbox capture preview is missing, expired, or already used')
    }
    this.#activePreviews.delete(previewId)
    clearTimeout(active.expirationTimer)
    await this.#adapter.dispose?.(active.prepared)
    const receipt = baseInboxReceipt(
      `skipped:${this.#receiptIdFactory()}`,
      active.prepared.preview,
      'skipped',
      this.#now().toISOString()
    )
    this.#repository.saveReceipt(receipt)
    return receipt
  }

  getLatest(itemId: string): LlmWikiInboxReceipt | null {
    return this.#repository.getLatestReceipt(itemId)
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
        await this.#adapter.dispose?.(active.prepared)
      })
    )
  }

  async disposeOwner(ownerId: string): Promise<void> {
    const owned = [...this.#activePreviews.entries()].filter(
      ([, active]) => active.ownerId === ownerId
    )
    await Promise.allSettled(owned.map(([id, active]) => this.#disposeActive(id, active)))
  }

  #assertAcceptingOperations(): void {
    if (this.#shuttingDown) throw new Error('The llm-wiki Inbox capture service is shutting down')
  }

  async #disposeActive(id: string, active: ActiveInboxPreview): Promise<void> {
    if (this.#activePreviews.get(id) === active) this.#activePreviews.delete(id)
    clearTimeout(active.expirationTimer)
    await this.#adapter.dispose?.(active.prepared)
  }
}

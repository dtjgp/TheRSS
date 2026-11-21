import {
  LLM_WIKI_BATCH_MAX_IDS,
  llmWikiArxivId,
  llmWikiArxivIdSchema,
  llmWikiBatchStatusResponseSchema,
  type LlmWikiLibraryStatus,
  type LlmWikiListFilter
} from '../../shared/llmWikiLibrary'
import { llmWikiListBadge, matchesLlmWikiListFilter } from '../../shared/llmWikiListFilter'
import { readableError, type NativeContext } from './common'

export interface WikiListItemLike {
  readonly source: string
  readonly kind?: string
  readonly url: string
}

function unavailableStatus(
  arxivId: string,
  checkedAt: string,
  reason: string
): LlmWikiLibraryStatus {
  return {
    arxivId,
    status: 'unavailable',
    checkedAt,
    recordPath: null,
    notePath: null,
    level: null,
    readStatus: null,
    reason
  }
}

export interface WikiListSummary {
  readonly eligible: number
  readonly pending: number
  readonly unavailable: number
}

/**
 * Bounded list-level llm-wiki status cache for Discover and Saved tables.
 * Fetches missing arXiv paper statuses in a single batch per list and degrades
 * cleanly to a no-op when the optional batch IPC method is absent.
 */
export class WikiListState {
  private readonly statuses = new Map<string, LlmWikiLibraryStatus>()
  private readonly inFlight = new Set<string>()
  private readonly idSeq = new Map<string, number>()
  private nextSeq = 0
  private generation = 0
  private forceNextRefresh = false
  private disposed = false

  constructor(private readonly context: NativeContext) {}

  sync(items: readonly WikiListItemLike[]): void {
    if (this.disposed || !this.context.api.getLlmWikiStatuses) return
    const missing: string[] = []
    const seen = new Set<string>()
    for (const item of items) {
      const arxivId = llmWikiArxivId(item)
      if (!arxivId || seen.has(arxivId)) continue
      seen.add(arxivId)
      if (!this.statuses.has(arxivId) && !this.inFlight.has(arxivId)) missing.push(arxivId)
    }
    if (!missing.length) return
    const refresh = this.forceNextRefresh
    this.forceNextRefresh = false
    for (let offset = 0; offset < missing.length; offset += LLM_WIKI_BATCH_MAX_IDS) {
      void this.fetchBatch(missing.slice(offset, offset + LLM_WIKI_BATCH_MAX_IDS), refresh)
    }
  }

  refreshOne(arxivId: string): void {
    if (this.disposed || !this.context.api.getLlmWikiStatuses) return
    const parsed = llmWikiArxivIdSchema.safeParse(arxivId)
    if (!parsed.success) return
    void this.fetchBatch([parsed.data], true)
  }

  invalidateAll(): void {
    this.generation++
    this.statuses.clear()
    this.inFlight.clear()
    this.idSeq.clear()
    this.forceNextRefresh = true
    if (!this.disposed) this.context.redraw()
  }

  summarize(items: readonly WikiListItemLike[]): WikiListSummary {
    if (!this.context.api.getLlmWikiStatuses) return { eligible: 0, pending: 0, unavailable: 0 }
    let eligible = 0
    let pending = 0
    let unavailable = 0
    for (const item of items) {
      const arxivId = llmWikiArxivId(item)
      if (!arxivId) continue
      eligible += 1
      const observed = this.statuses.get(arxivId)
      if (!observed) pending += 1
      else if (observed.status === 'unavailable') unavailable += 1
    }
    return { eligible, pending, unavailable }
  }

  badge(item: WikiListItemLike): string | null {
    if (!this.context.api.getLlmWikiStatuses) return null
    const arxivId = llmWikiArxivId(item)
    return llmWikiListBadge(arxivId ? this.statuses.get(arxivId) : undefined, Boolean(arxivId))
  }

  subtitle(item: WikiListItemLike, baseSubtitle: string): string {
    const badge = this.badge(item)
    return badge ? `${baseSubtitle} · ${badge}` : baseSubtitle
  }

  matches(item: WikiListItemLike, filter: LlmWikiListFilter): boolean {
    const arxivId = llmWikiArxivId(item)
    return matchesLlmWikiListFilter(
      arxivId ? this.statuses.get(arxivId) : undefined,
      Boolean(arxivId),
      filter
    )
  }

  dispose(): void {
    this.disposed = true
    this.generation++
    this.inFlight.clear()
    this.idSeq.clear()
  }

  private async fetchBatch(arxivIds: readonly string[], refresh: boolean): Promise<void> {
    const getStatuses = this.context.api.getLlmWikiStatuses
    if (this.disposed || !getStatuses || !arxivIds.length) return
    const generation = this.generation
    const seq = ++this.nextSeq
    for (const id of arxivIds) {
      this.inFlight.add(id)
      this.idSeq.set(id, seq)
    }
    try {
      const response = llmWikiBatchStatusResponseSchema.parse(
        await getStatuses({ arxivIds: [...arxivIds], refresh })
      )
      if (this.disposed || generation !== this.generation) return
      let changed = false
      for (const id of arxivIds) {
        if (this.idSeq.get(id) !== seq) continue
        this.inFlight.delete(id)
        this.statuses.set(
          id,
          response.statuses[id] ??
            unavailableStatus(
              id,
              response.checkedAt,
              'Status omitted from llm-wiki batch response.'
            )
        )
        changed = true
      }
      if (changed) this.context.redraw()
    } catch (error) {
      if (this.disposed || generation !== this.generation) return
      const checkedAt = new Date().toISOString()
      const reason = readableError(error, 'llm-wiki status could not be checked.')
      let changed = false
      for (const id of arxivIds) {
        if (this.idSeq.get(id) !== seq) continue
        this.inFlight.delete(id)
        this.statuses.set(id, unavailableStatus(id, checkedAt, reason))
        changed = true
      }
      if (changed) this.context.redraw()
    }
  }
}

import type { LlmWikiLibraryStatus, LlmWikiListFilter } from './llmWikiLibrary'

export const LLM_WIKI_LIST_FILTER_OPTIONS: ReadonlyArray<{
  readonly id: LlmWikiListFilter
  readonly title: string
}> = [
  { id: 'all', title: 'All llm-wiki' },
  { id: 'collected', title: 'In llm-wiki' },
  { id: 'uncollected', title: 'Not in llm-wiki' }
]

/**
 * Concise, truthful list-row badge for an item's local llm-wiki membership.
 * Never invents note presence or hides unchecked/unavailable states.
 */
export function llmWikiListBadge(
  status: LlmWikiLibraryStatus | undefined,
  eligible: boolean
): string | null {
  if (!eligible) return null
  if (!status) return 'llm-wiki: Pending'
  if (status.status === 'recorded') {
    if (status.notePath)
      return status.level ? `In llm-wiki · ${status.level}` : 'In llm-wiki · Note'
    return 'In llm-wiki · Record only'
  }
  if (status.status === 'note-missing') return 'llm-wiki · Note missing'
  if (status.status === 'ambiguous') return 'llm-wiki · Ambiguous'
  if (status.status === 'unavailable') return 'llm-wiki · Unavailable'
  return null
}

/**
 * Partition-complete list filter (`collected` ∪ `uncollected` = `all`).
 * Pending/unavailable/non-paper items stay visible under `all` and `uncollected`
 * so slow or unavailable vaults never hide results silently.
 */
export function matchesLlmWikiListFilter(
  status: LlmWikiLibraryStatus | undefined,
  eligible: boolean,
  filter: LlmWikiListFilter
): boolean {
  if (filter === 'all') return true
  const collected = eligible && status?.status === 'recorded'
  return filter === 'collected' ? collected : !collected
}

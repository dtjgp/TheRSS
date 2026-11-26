import type { DiscoverResultItem, DiscoverSortOrder, DiscoverTimeRange } from './discover'
import { hasPublicationMonthOnly, publicationIntervalEnd } from './sourceDate'

export type DiscoverKindFilter = 'all' | 'paper' | 'repository' | 'other'

export interface DiscoverViewFilterOptions {
  readonly kind: DiscoverKindFilter
  readonly timeRange: DiscoverTimeRange
  readonly sortOrder: DiscoverSortOrder
  readonly referenceTime?: number
}

const DAY_MS = 86_400_000

const TIME_RANGE_DAYS: Record<Exclude<DiscoverTimeRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30
}

function parsedTimestamp(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.NaN
}

/**
 * Effective sort timestamp for a Discover result:
 * - NCPSD month-only entries keep their stored month-start sorting anchor so a month-only
 *   publication never falsely outranks an exact-day record later in the same month.
 * - All other records use the newer of publishedAt / updatedAt (e.g. GitHub pushes or arXiv
 *   revisions), falling back to whichever timestamp is valid.
 */
export function discoverItemSortTimestamp(item: DiscoverResultItem): number {
  const published = parsedTimestamp(item.publishedAt)
  if (hasPublicationMonthOnly(item)) {
    return published
  }
  const updated = parsedTimestamp(item.updatedAt)
  if (Number.isFinite(published) && Number.isFinite(updated)) {
    return Math.max(published, updated)
  }
  return Number.isFinite(updated) ? updated : published
}

/**
 * Checks whether an item falls within a bounded time window (`7d` or `30d`) relative to
 * `referenceTime`. Month-only NCPSD items use month-interval overlap (`publicationIntervalEnd`)
 * without claiming exact publication-day precision.
 */
export function matchesDiscoverTimeRange(
  item: DiscoverResultItem,
  timeRange: DiscoverTimeRange,
  referenceTime: number
): boolean {
  if (timeRange === 'all') return true
  const cutoff = referenceTime - TIME_RANGE_DAYS[timeRange] * DAY_MS
  if (hasPublicationMonthOnly(item)) {
    const end = publicationIntervalEnd(item)
    return Number.isFinite(end) && end >= cutoff
  }
  const timestamp = discoverItemSortTimestamp(item)
  return Number.isFinite(timestamp) && timestamp >= cutoff
}

export function matchesDiscoverKind(item: DiscoverResultItem, kind: DiscoverKindFilter): boolean {
  if (kind === 'all') return true
  if (kind === 'other') return item.kind !== 'paper' && item.kind !== 'repository'
  return item.kind === kind
}

export function filterAndSortDiscoverItems(
  items: readonly DiscoverResultItem[],
  options: DiscoverViewFilterOptions
): DiscoverResultItem[] {
  const referenceTime = options.referenceTime ?? Date.now()
  const filtered = items
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        matchesDiscoverKind(item, options.kind) &&
        matchesDiscoverTimeRange(item, options.timeRange, referenceTime)
    )

  if (options.sortOrder === 'relevance') {
    return filtered.map(({ item }) => item)
  }

  return filtered
    .sort((left, right) => {
      const leftTs = discoverItemSortTimestamp(left.item)
      const rightTs = discoverItemSortTimestamp(right.item)
      const leftValid = Number.isFinite(leftTs)
      const rightValid = Number.isFinite(rightTs)
      if (leftValid !== rightValid) return leftValid ? -1 : 1
      if (leftValid && rightValid && leftTs !== rightTs) return rightTs - leftTs
      if (left.item.score !== right.item.score) return right.item.score - left.item.score
      return left.index - right.index
    })
    .map(({ item }) => item)
}

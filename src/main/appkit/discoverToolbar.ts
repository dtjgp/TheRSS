import { formatDisplayDate } from '../../shared/sourceDate'
import {
  DISCOVER_SOURCE_IDS,
  type DiscoverSnapshot,
  type DiscoverSortOrder,
  type DiscoverSource,
  type DiscoverTimeRange
} from '../../shared/discover'
import type { DiscoverKindFilter } from '../../shared/discoverViewFilter'
import { Controls, emptyState, label, row } from './common'
import type { NativeNode, NativeOption } from './presentation'

const KIND_NAMES: Record<Exclude<DiscoverKindFilter, 'all'>, string> = {
  paper: 'papers',
  repository: 'repositories',
  other: 'other results'
}

const TIME_RANGE_NAMES: Record<Exclude<DiscoverTimeRange, 'all'>, string> = {
  '7d': 'the last 7 days',
  '30d': 'the last 30 days'
}

const TIME_RANGE_OPTIONS: readonly NativeOption[] = [
  { id: 'all', title: 'All dates' },
  { id: '7d', title: 'Last 7 days' },
  { id: '30d', title: 'Last 30 days' }
]

const SORT_OPTIONS: readonly NativeOption[] = [
  { id: 'relevance', title: 'Relevance' },
  { id: 'newest', title: 'Newest' }
]

export const DISCOVER_STATUS_TITLES: Record<DiscoverSnapshot['status'], string> = {
  completed: 'Complete',
  partial: 'Partial results',
  no_results: 'No results',
  failed: 'Search failed',
  canceled: 'Canceled'
}

/** Plain-language session outcome derived only from persisted per-source outcomes. */
export function discoverResultStatus(snapshot: DiscoverSnapshot, locale: string): string {
  const searched = DISCOVER_SOURCE_IDS.map((source) => snapshot.sourceOutcomes[source]).filter(
    (outcome): outcome is DiscoverSnapshot['sourceOutcomes'][DiscoverSource] =>
      !!outcome && outcome.status !== 'not_searched'
  )
  const complete = searched.filter(
    (outcome) => outcome.status === 'healthy' || outcome.status === 'no_results'
  ).length
  return `${DISCOVER_STATUS_TITLES[snapshot.status]} · ${complete} of ${searched.length} sources succeeded · ${formatDisplayDate(snapshot.createdAt, locale)}`
}

export function discoverResultCount(visibleCount: number, totalCount: number): string {
  if (visibleCount !== totalCount) return `${visibleCount} of ${totalCount} results`
  return `${visibleCount} ${visibleCount === 1 ? 'result' : 'results'}`
}

export interface DiscoverToolbarOptions {
  readonly controls: Controls
  readonly snapshot: DiscoverSnapshot
  readonly locale: string
  readonly filter: DiscoverKindFilter
  readonly timeRange: DiscoverTimeRange
  readonly sortOrder: DiscoverSortOrder
  readonly retryCount: number
  readonly busy: boolean
  readonly onFilter: (filter: DiscoverKindFilter) => void
  readonly onTimeRange: (timeRange: DiscoverTimeRange) => void
  readonly onSort: (sortOrder: DiscoverSortOrder) => void
  readonly onDetails: () => void
  readonly onRetry: () => void | Promise<void>
}

export function discoverResultsToolbar(options: DiscoverToolbarOptions): NativeNode {
  const { controls: b, snapshot } = options
  const otherCount = snapshot.items.filter(
    (item) => item.kind !== 'paper' && item.kind !== 'repository'
  ).length
  return row('discover-results-toolbar', [
    b.segmented(
      'discover-kind',
      'Result kind',
      options.filter,
      [
        { id: 'all', title: `All (${snapshot.items.length})` },
        { id: 'paper', title: `Papers (${snapshot.counts.byKind.paper})` },
        { id: 'repository', title: `Repositories (${snapshot.counts.byKind.repository})` },
        { id: 'other', title: `Other (${otherCount})` }
      ],
      (value) => options.onFilter(value as DiscoverKindFilter)
    ),
    b.select(
      'discover-time-range',
      'Time range',
      options.timeRange,
      TIME_RANGE_OPTIONS,
      (value) => options.onTimeRange(value as DiscoverTimeRange),
      { help: 'Filter results by publication or update date' }
    ),
    b.segmented(
      'discover-sort',
      'Sort results',
      options.sortOrder,
      SORT_OPTIONS,
      (value) => options.onSort(value as DiscoverSortOrder),
      { help: 'Order visible results by relevance or newest date' }
    ),
    label('discover-result-status', discoverResultStatus(snapshot, options.locale), { flex: 1 }),
    b.button('discover-details', 'Search details', options.onDetails),
    ...(options.retryCount
      ? [
          b.button(
            'discover-retry',
            `Retry ${options.retryCount} incomplete`,
            options.onRetry,
            !options.busy
          )
        ]
      : [])
  ])
}

export interface DiscoverEmptyOptions {
  readonly controls: Controls
  readonly snapshot: DiscoverSnapshot | null
  readonly filter: DiscoverKindFilter
  readonly timeRange: DiscoverTimeRange
  readonly onShowAll: () => void
}

export function discoverEmptyState(options: DiscoverEmptyOptions): NativeNode {
  const { controls: b, snapshot, filter, timeRange } = options
  if (!snapshot) {
    return emptyState(
      'discover-empty',
      'sparkle.magnifyingglass',
      'Start a research search',
      'Search research sources and keep the results on this Mac.'
    )
  }
  const filtered = filter !== 'all' || timeRange !== 'all'
  // An empty session keeps its outcome: failed and canceled are not "no results".
  const title = filtered
    ? filter !== 'all' && timeRange !== 'all'
      ? `No ${KIND_NAMES[filter]} in ${TIME_RANGE_NAMES[timeRange]}`
      : filter !== 'all'
        ? `No ${KIND_NAMES[filter]} in this session`
        : `No results in ${TIME_RANGE_NAMES[timeRange as Exclude<DiscoverTimeRange, 'all'>]}`
    : snapshot.status === 'failed'
      ? 'Search failed'
      : snapshot.status === 'canceled'
        ? 'Search canceled'
        : 'No results'
  return emptyState(
    'discover-empty',
    'sparkle.magnifyingglass',
    title,
    'No results match this view. Source outcomes remain available in Search details.',
    filtered ? [b.button('discover-show-all', 'Show all results', options.onShowAll)] : []
  )
}

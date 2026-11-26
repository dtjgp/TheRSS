import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiscoverResultItem, DiscoverSnapshot } from '../../shared/discover'
import { DiscoverScreen } from './discover'
import { TriageHistory } from './reading'
import { nativeDiscoverFixture, nativeHarness } from './testSupport'

function makeItem(overrides: Partial<DiscoverResultItem>): DiscoverResultItem {
  return {
    ...nativeDiscoverFixture.items[0]!,
    id: 'arxiv:sample',
    title: 'Sample item',
    publishedAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
    score: 50,
    ...overrides
  }
}

function mixedSnapshot(): DiscoverSnapshot {
  const items: DiscoverResultItem[] = [
    makeItem({
      id: 'old-high',
      title: 'Old high-relevance paper',
      kind: 'paper',
      publishedAt: '2026-09-10T00:00:00.000Z',
      updatedAt: '2026-09-10T00:00:00.000Z',
      score: 95
    }),
    makeItem({
      id: 'recent-paper',
      title: 'Recent arXiv paper',
      kind: 'paper',
      publishedAt: '2026-11-18T00:00:00.000Z',
      updatedAt: '2026-11-18T00:00:00.000Z',
      score: 70
    }),
    makeItem({
      id: 'pushed-repo',
      title: 'Recently pushed repository',
      source: 'github',
      kind: 'repository',
      publishedAt: '2025-02-01T00:00:00.000Z',
      updatedAt: '2026-11-19T08:00:00.000Z',
      score: 60
    }),
    makeItem({
      id: 'two-week-paper',
      title: 'Two-week-old paper',
      kind: 'paper',
      publishedAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
      score: 50
    }),
    makeItem({
      id: 'ncpssd-nov',
      title: 'NCPSD November issue',
      source: 'folo:611',
      kind: 'paper',
      publishedAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
      summary: '2026年11月刊发研究综述',
      score: 40
    }),
    makeItem({
      id: 'ncpssd-sep',
      title: 'NCPSD September issue',
      source: 'folo:611',
      kind: 'paper',
      publishedAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      summary: '2026年9月刊发研究综述',
      score: 35
    })
  ]

  return {
    ...nativeDiscoverFixture,
    items,
    counts: {
      ...nativeDiscoverFixture.counts,
      total: items.length,
      arxiv: 3,
      github: 1,
      byKind: { paper: 5, repository: 1, article: 0, model: 0, dataset: 0, post: 0 }
    }
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('AppKit Discover I3 time range and newest sort controls', () => {
  it('renders time range and sort controls in the results toolbar when a session is present', async () => {
    const emptyHarness = nativeHarness({ getLatestDiscover: vi.fn(async () => null) })
    const emptyScreen = new DiscoverScreen(
      emptyHarness.context,
      new TriageHistory(emptyHarness.context)
    )
    await emptyScreen.load()
    const emptyScene = emptyHarness.render(emptyScreen)
    expect(emptyHarness.find(emptyScene, 'discover-time-range')).toBeUndefined()
    expect(emptyHarness.find(emptyScene, 'discover-sort')).toBeUndefined()
    emptyScreen.dispose()

    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => mixedSnapshot()) })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    const scene = h.render(screen)

    const timeRange = h.find(scene, 'discover-time-range')
    expect(timeRange).toMatchObject({ selected: 'all' })
    expect(timeRange?.options).toEqual([
      { id: 'all', title: 'All dates' },
      { id: '7d', title: 'Last 7 days' },
      { id: '30d', title: 'Last 30 days' }
    ])

    const sort = h.find(scene, 'discover-sort')
    expect(sort).toMatchObject({ selected: 'relevance' })
    expect(sort?.options).toEqual([
      { id: 'relevance', title: 'Relevance' },
      { id: 'newest', title: 'Newest' }
    ])
    screen.dispose()
  })

  it('filters locally by 7d/30d including NCPSD month overlap with zero API calls and updates selection cleanly', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-20T12:00:00.000Z'))

    const searchDiscover = vi.fn()
    const retryDiscover = vi.fn()
    const getLatestDiscover = vi.fn(async () => mixedSnapshot())
    const h = nativeHarness({ getLatestDiscover, searchDiscover, retryDiscover })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()

    // Initial selection is the highest-relevance old item.
    const initial = h.render(screen)
    expect(h.find(initial, 'discover-results')?.selected).toBe('old-high')

    // Filtering to Last 7 days drops old-high, keeps recent-paper, pushed-repo, and ncpssd-nov overlap.
    await h.act(screen, 'discover-time-range', '7d')
    const last7 = h.render(screen)
    expect(h.find(last7, 'discover-time-range')?.selected).toBe('7d')
    expect(h.find(last7, 'discover-results')?.rows?.map((row) => row.id)).toEqual([
      'recent-paper',
      'pushed-repo',
      'ncpssd-nov'
    ])
    expect(h.find(last7, 'discover-results')?.selected).toBe('recent-paper')
    expect(h.find(last7, 'discover-reading-title')?.text).toBe('Recent arXiv paper')
    expect(h.find(last7, 'discover-pagination')?.text).toBe('3 of 6 results')

    // Preserves selection when widening to Last 30 days and the selected item remains visible.
    await h.act(screen, 'discover-results', 'pushed-repo')
    await h.act(screen, 'discover-time-range', '30d')
    const last30 = h.render(screen)
    expect(h.find(last30, 'discover-results')?.rows?.map((row) => row.id)).toEqual([
      'recent-paper',
      'pushed-repo',
      'two-week-paper',
      'ncpssd-nov'
    ])
    expect(h.find(last30, 'discover-results')?.selected).toBe('pushed-repo')
    expect(h.find(last30, 'discover-pagination')?.text).toBe('4 of 6 results')

    expect(searchDiscover).not.toHaveBeenCalled()
    expect(retryDiscover).not.toHaveBeenCalled()
    expect(getLatestDiscover).toHaveBeenCalledTimes(1)
    screen.dispose()
  })

  it('reorders visible results by newest without losing relevance order when switched back', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-20T12:00:00.000Z'))

    const searchDiscover = vi.fn()
    const h = nativeHarness({
      getLatestDiscover: vi.fn(async () => mixedSnapshot()),
      searchDiscover
    })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()

    const relevanceOrder = h.find(h.render(screen), 'discover-results')?.rows?.map((row) => row.id)
    expect(relevanceOrder).toEqual([
      'old-high',
      'recent-paper',
      'pushed-repo',
      'two-week-paper',
      'ncpssd-nov',
      'ncpssd-sep'
    ])

    await h.act(screen, 'discover-sort', 'newest')
    const newestOrder = h.find(h.render(screen), 'discover-results')?.rows?.map((row) => row.id)
    expect(newestOrder).toEqual([
      'pushed-repo',
      'recent-paper',
      'two-week-paper',
      'ncpssd-nov',
      'old-high',
      'ncpssd-sep'
    ])

    await h.act(screen, 'discover-sort', 'relevance')
    const restoredOrder = h.find(h.render(screen), 'discover-results')?.rows?.map((row) => row.id)
    expect(restoredOrder).toEqual(relevanceOrder)
    expect(searchDiscover).not.toHaveBeenCalled()
    screen.dispose()
  })

  it('recovers from empty kind + time range filter via Show all results while keeping sourceOutcomes intact', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-20T12:00:00.000Z'))

    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => nativeDiscoverFixture) })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()

    const initialStatus = h.find(h.render(screen), 'discover-result-status')?.text

    // nativeDiscoverFixture items are all from 2026-09-06 -> hidden under 7d.
    await h.act(screen, 'discover-time-range', '7d')
    let empty = h.render(screen)
    expect(h.find(empty, 'discover-results')).toBeUndefined()
    expect(h.find(empty, 'discover-empty-title')?.text).toBe('No results in the last 7 days')
    expect(h.find(empty, 'discover-empty-message')?.text).toContain('Search details')
    expect(h.find(empty, 'discover-show-all')?.title).toBe('Show all results')
    expect(h.find(empty, 'discover-result-status')?.text).toBe(initialStatus)

    // Combine kind + time range filter.
    await h.act(screen, 'discover-kind', 'paper')
    empty = h.render(screen)
    expect(h.find(empty, 'discover-empty-title')?.text).toBe('No papers in the last 7 days')
    expect(h.find(empty, 'discover-show-all')).toBeDefined()

    // Show all results resets BOTH kind and timeRange while preserving sourceOutcomes.
    await h.act(screen, 'discover-show-all')
    const recovered = h.render(screen)
    expect(h.find(recovered, 'discover-kind')?.selected).toBe('all')
    expect(h.find(recovered, 'discover-time-range')?.selected).toBe('all')
    expect(h.find(recovered, 'discover-results')?.rows).toHaveLength(
      nativeDiscoverFixture.items.length
    )
    expect(h.find(recovered, 'discover-result-status')?.text).toBe(initialStatus)

    await h.act(screen, 'discover-details')
    expect(h.context.showDocument).toHaveBeenCalledWith(
      'Search details',
      expect.stringContaining('Fixture failure')
    )
    screen.dispose()
  })

  it('checkpoints and restores timeRange and sortOrder across openLocal while resetting for historical visibility', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-20T12:00:00.000Z'))

    const current = mixedSnapshot()
    const historicalRepo = makeItem({
      id: 'historical-repo',
      title: 'Historical archived repository',
      source: 'github',
      kind: 'repository',
      publishedAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
      score: 42
    })
    const historical: DiscoverSnapshot = {
      ...nativeDiscoverFixture,
      id: 'session-historical',
      intent: 'historical query',
      items: [historicalRepo, ...nativeDiscoverFixture.items.slice(0, 2)],
      counts: {
        ...nativeDiscoverFixture.counts,
        total: 3,
        arxiv: 2,
        github: 1,
        byKind: { paper: 2, repository: 1, article: 0, model: 0, dataset: 0, post: 0 }
      }
    }

    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => current) })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()

    // Apply narrow filters & newest sort on the live session.
    await h.act(screen, 'discover-kind', 'paper')
    await h.act(screen, 'discover-time-range', '7d')
    await h.act(screen, 'discover-sort', 'newest')
    expect(h.find(h.render(screen), 'discover-results')?.rows?.map((row) => row.id)).toEqual([
      'recent-paper',
      'ncpssd-nov'
    ])

    // Open an old repository in a historical session -> filters and sort reset so target is visible.
    const restore = screen.openLocal(historical, 'historical-repo')
    const opened = h.render(screen)
    expect(h.find(opened, 'discover-results')?.selected).toBe('historical-repo')
    expect(h.find(opened, 'discover-reading-title')?.text).toBe('Historical archived repository')
    expect(h.find(opened, 'discover-kind')?.selected).toBe('all')
    expect(h.find(opened, 'discover-time-range')?.selected).toBe('all')
    expect(h.find(opened, 'discover-sort')?.selected).toBe('relevance')

    // Restoring returns the prior session's kind, timeRange, and sortOrder intact.
    restore()
    const restored = h.render(screen)
    expect(h.find(restored, 'discover-kind')?.selected).toBe('paper')
    expect(h.find(restored, 'discover-time-range')?.selected).toBe('7d')
    expect(h.find(restored, 'discover-sort')?.selected).toBe('newest')
    expect(h.find(restored, 'discover-results')?.rows?.map((row) => row.id)).toEqual([
      'recent-paper',
      'ncpssd-nov'
    ])
    screen.dispose()
  })

  it('resets timeRange and sortOrder when a new search completes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-20T12:00:00.000Z'))

    const h = nativeHarness({
      getLatestDiscover: vi.fn(async () => mixedSnapshot()),
      searchDiscover: vi.fn(async () => nativeDiscoverFixture)
    })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()

    await h.act(screen, 'discover-time-range', '7d')
    await h.act(screen, 'discover-sort', 'newest')
    await h.act(screen, 'discover-search')

    const afterSearch = h.render(screen)
    expect(h.find(afterSearch, 'discover-time-range')?.selected).toBe('all')
    expect(h.find(afterSearch, 'discover-sort')?.selected).toBe('relevance')
    expect(h.find(afterSearch, 'discover-results')?.rows).toHaveLength(
      nativeDiscoverFixture.items.length
    )
    screen.dispose()
  })
})

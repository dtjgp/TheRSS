import { describe, expect, it, vi } from 'vitest'
import { DISCOVER_SOURCE_IDS, type DiscoverSnapshot } from '../../shared/discover'
import { DiscoverScreen } from './discover'
import { TriageHistory } from './reading'
import { nativeHarness, nativeDiscoverFixture } from './testSupport'

describe('AppKit Discover', () => {
  it('uses the persisted item state for Saved markers beyond the bounded dashboard list', async () => {
    const snapshot = {
      ...nativeDiscoverFixture,
      items: nativeDiscoverFixture.items.map((item) => ({ ...item, saved: true }))
    }
    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => snapshot) })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    expect(h.find(h.render(screen), 'discover-results')?.rows?.[0]?.subtitle).toContain(' · Saved')
  })
  it('filters result kinds with a segmented control that shows every count', async () => {
    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => nativeDiscoverFixture) })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    const filter = h.find(h.render(screen), 'discover-kind')
    expect(filter).toMatchObject({ kind: 'segmented', title: 'Result kind', selected: 'all' })
    expect(filter?.options?.map((option) => option.id)).toEqual([
      'all',
      'paper',
      'repository',
      'other'
    ])
    expect(filter?.options?.every((option) => /\(\d+\)$/u.test(option.title))).toBe(true)
    await h.act(screen, 'discover-kind', 'other')
    const empty = h.render(screen)
    expect(h.find(empty, 'discover-kind')?.selected).toBe('other')
    expect(h.find(empty, 'discover-results')).toBeUndefined()
    expect(h.find(empty, 'discover-empty-message')?.text).toContain('No results')
    await h.act(screen, 'discover-kind', 'paper')
    expect(h.find(h.render(screen), 'discover-results')?.rows).toHaveLength(
      nativeDiscoverFixture.items.filter((item) => item.kind === 'paper').length
    )
    screen.dispose()
  })
  it('summarizes the persisted session outcome in plain language with source counts', async () => {
    const [empty, skipped] = DISCOVER_SOURCE_IDS.filter((source) => source !== 'arxiv')
    const outcomes = {
      ...nativeDiscoverFixture.sourceOutcomes,
      [empty!]: { status: 'no_results', resultCount: 0, error: null },
      [skipped!]: { status: 'not_searched', resultCount: 0, error: null }
    } as DiscoverSnapshot['sourceOutcomes']
    const h = nativeHarness({
      getLatestDiscover: vi.fn(async () => ({ ...nativeDiscoverFixture, sourceOutcomes: outcomes }))
    })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    expect(h.find(h.render(screen), 'discover-result-status')?.text).toBe(
      'Partial results · 20 of 21 sources complete · 2026-09-06'
    )
  })

  it('restores the persisted session, lists every result and opens all source/provenance details', async () => {
    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => nativeDiscoverFixture) })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    expect(h.find(h.render(screen), 'discover-results')?.rows).toHaveLength(30)
    expect(h.find(h.render(screen), 'discover-more')).toBeUndefined()
    expect(h.find(h.render(screen), 'discover-pagination')?.text).toBe('30 results')
    await h.act(screen, 'discover-details')
    expect(h.context.showDocument).toHaveBeenCalledWith(
      'Search details',
      expect.stringContaining('Fixture failure')
    )
    expect(h.context.showDocument).toHaveBeenCalledWith(
      'Search details',
      expect.stringContaining('semantic-discover-v2')
    )
  })

  it('keeps the old snapshot when a new run fails and retries only unsuccessful sources', async () => {
    const search = vi.fn().mockRejectedValue(new Error('Fixture network failure'))
    const retry = vi.fn(async () => ({ ...nativeDiscoverFixture, status: 'completed' as const }))
    const h = nativeHarness({
      getLatestDiscover: vi.fn(async () => nativeDiscoverFixture),
      searchDiscover: search,
      retryDiscover: retry
    })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    await h.act(screen, 'discover-query', 'A new query')
    await h.act(screen, 'discover-search')
    expect(h.find(h.render(screen), 'discover-results')?.rows?.[0]?.title).toBe('Paper 0')
    await h.act(screen, 'discover-retry')
    expect(retry).toHaveBeenCalledWith('session-1', ['arxiv'], expect.any(String))
  })

  it('shows the three-stage run with native progress and the latest source outcome', async () => {
    let finish!: (snapshot: DiscoverSnapshot) => void
    let report: (progress: import('../../shared/discover').DiscoverRunProgress) => void = () =>
      undefined
    const search = vi.fn<import('../../shared/api').TheRSSApi['searchDiscover']>(
      () =>
        new Promise<DiscoverSnapshot>((resolve) => {
          finish = resolve
        })
    )
    const h = nativeHarness({
      getLatestDiscover: vi.fn(async () => nativeDiscoverFixture),
      searchDiscover: search,
      onDiscoverProgress: vi.fn((listener) => {
        report = listener
        return () => undefined
      })
    })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    const running = h.act(screen, 'discover-search')
    const planning = h.render(screen)
    expect(h.find(planning, 'discover-run-headline')?.text).toBe('Expanding research intent')
    expect(h.find(planning, 'discover-run-stage')?.text).toBe('Step 1 of 3: Plan query')
    expect(h.find(planning, 'discover-run-progress')).toMatchObject({
      kind: 'progress',
      title: 'Discover run progress'
    })
    expect(h.find(planning, 'discover-run-progress')?.total).toBeUndefined()
    const runId = search.mock.calls[0]![1]
    report({
      runId,
      phase: 'searching',
      completedSources: 3,
      totalSources: 22,
      source: 'arxiv',
      outcome: { status: 'healthy', resultCount: 1, error: null }
    })
    const searching = h.render(screen)
    expect(h.find(searching, 'discover-run-stage')?.text).toBe(
      'Step 2 of 3: Search selected sources'
    )
    expect(h.find(searching, 'discover-run-progress')).toMatchObject({ completed: 3, total: 22 })
    expect(h.find(searching, 'discover-progress')?.text).toBe('arXiv complete · 1 result')
    report({
      runId: 'another-run',
      phase: 'planning',
      completedSources: 0,
      totalSources: 1,
      source: null,
      outcome: null
    })
    expect(h.find(h.render(screen), 'discover-run-progress')).toMatchObject({ completed: 3 })
    finish(nativeDiscoverFixture)
    await running
    expect(h.find(h.render(screen), 'discover-run')).toBeUndefined()
  })
  it('submits Discover with Command-Return without taking plain Return from the question', async () => {
    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => nativeDiscoverFixture) })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    expect(h.find(h.render(screen), 'discover-search')).toMatchObject({
      shortcut: 'command-return',
      help: expect.stringContaining('Command-Return')
    })
    expect(h.find(h.render(screen), 'discover-query')?.multiline).toBe(true)
  })
  it('cancels only its run and keeps Canceling until the actual search settles', async () => {
    let finish!: (snapshot: DiscoverSnapshot) => void
    const search = vi.fn<import('../../shared/api').TheRSSApi['searchDiscover']>(
      () =>
        new Promise<DiscoverSnapshot>((resolve) => {
          finish = resolve
        })
    )
    const cancel = vi.fn(async (runId: string) => ({ runId, canceled: true }))
    const h = nativeHarness({
      getLatestDiscover: vi.fn(async () => nativeDiscoverFixture),
      searchDiscover: search,
      cancelDiscover: cancel
    })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    const running = h.act(screen, 'discover-search')
    await h.act(screen, 'discover-cancel')
    expect(cancel).toHaveBeenCalledWith(search.mock.calls[0]?.[1])
    expect(h.find(h.render(screen), 'discover-cancel')?.title).toBe('Canceling…')
    expect(h.find(h.render(screen), 'discover-run-headline')?.text).toBe(
      'Canceling Discover search'
    )
    expect(h.find(h.render(screen), 'discover-search')?.enabled).toBe(false)
    finish({ ...nativeDiscoverFixture, status: 'canceled' })
    await running
    expect(h.find(h.render(screen), 'discover-search')?.enabled).toBe(true)
  })
})

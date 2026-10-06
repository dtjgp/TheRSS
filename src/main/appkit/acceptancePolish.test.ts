import { describe, expect, it, vi } from 'vitest'
import type { AnalyticsSnapshot } from '../../shared/analytics'
import { DISCOVER_SOURCE_IDS, type DiscoverSnapshot } from '../../shared/discover'
import { AnalyticsScreen } from './analytics'
import { DiscoverScreen } from './discover'
import { NativePresenter } from './presenter'
import { defaultNativePreferences } from './preferences'
import { TriageHistory } from './reading'
import { SourcesScreen } from './sources'
import { nativeDiscoverFixture, nativeHarness } from './testSupport'

/** Findings A3-A7 of the 2026-10-06 appearance acceptance pass. */
describe('acceptance polish', () => {
  it('explains search details in plain language and keeps the recorded time', async () => {
    const [empty, skipped] = DISCOVER_SOURCE_IDS.filter((source) => source !== 'arxiv')
    const snapshot: DiscoverSnapshot = {
      ...nativeDiscoverFixture,
      status: 'completed',
      createdAt: '2026-10-06T19:44:57.405Z',
      sourceOutcomes: {
        ...nativeDiscoverFixture.sourceOutcomes,
        [empty!]: { status: 'no_results', resultCount: 0, error: null },
        [skipped!]: { status: 'not_searched', resultCount: 0, error: null }
      }
    }
    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => snapshot) })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    await h.act(screen, 'discover-details')
    const document = vi.mocked(h.context.showDocument).mock.calls.at(-1)![1]
    expect(document).toContain('Complete\nRecorded: 2026-10-06T19:44:57.405Z')
    expect(document).toContain('complete · 1 result\n')
    expect(document).toContain('no results · 0 results')
    expect(document).toContain('Fixture failure')
    expect(document).toMatch(/\nnot searched\n/u)
    expect(document).not.toMatch(/\b(?:healthy|no_results|completed)\b/u)
    expect(document).not.toContain('Excluded keywords:')
    expect(document).not.toContain('Topics:')
    expect(document).toContain('Languages: Python')
    expect(document).toContain('Prompt: semantic-discover-v2')
  })

  it('reports how many sources succeeded without repeating the outcome word', async () => {
    const h = nativeHarness({
      getLatestDiscover: vi.fn(async () => ({
        ...nativeDiscoverFixture,
        status: 'completed' as const
      }))
    })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    expect(h.find(h.render(screen), 'discover-result-status')?.text).toMatch(
      /^Complete · \d+ of \d+ sources succeeded · Sep 6, 2026$/u
    )
  })

  it('shows only the empty state before the first search', async () => {
    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => null) })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    const scene = h.render(screen)
    expect(h.find(scene, 'discover-empty-title')?.text).toBe('Start a research search')
    expect(h.find(scene, 'discover-readiness')).toBeUndefined()
  })

  it('states that a source has no recorded outcome instead of a contradictory line', () => {
    const h = nativeHarness({ getSourceContent: vi.fn() })
    // The harness default: arXiv and GitHub idle, with no recorded observation.
    expect(h.dashboard.sourceHealth.arxiv).toBe('idle')
    h.context.data.dashboard = h.dashboard
    const root = h.render(new SourcesScreen(h.context))
    expect(h.find(root, 'source-detail-health')?.text).toBe('No outcome recorded yet.')
    expect(h.find(root, 'source-observation-boundary')).toBeUndefined()
    // A recorded outcome keeps its label, time and the observation boundary.
    h.context.data.dashboard = {
      ...h.dashboard,
      sourceHealth: { arxiv: 'failed', github: 'idle' },
      sourceHealthDetails: {
        ...h.dashboard.sourceHealthDetails,
        arxiv: {
          status: 'failed',
          observedAt: '2026-09-07T14:35:34.199Z',
          errorMessage: 'Timed out',
          context: 'discover'
        }
      }
    }
    const recorded = h.render(new SourcesScreen(h.context))
    expect(h.find(recorded, 'source-detail-health')?.text).toBe(
      'Failed · Latest search · 2026-09-07 14:35 UTC'
    )
    expect(h.find(recorded, 'source-observation-boundary')).toBeDefined()
  })

  it('explains an empty analysis history and pairs the metrics', async () => {
    const snapshot: AnalyticsSnapshot = {
      generatedAt: 'now',
      windowDays: 7,
      trackingStartedAt: '2026-09-01',
      totals: {
        searchResults: 0,
        todayResults: 0,
        discoverResults: 0,
        deepAnalyses: 0,
        analyzedPapers: 0
      },
      daily: [],
      analyzedItems: []
    }
    const h = nativeHarness({ getAnalytics: vi.fn(async () => snapshot) })
    const screen = new AnalyticsScreen(h.context)
    await screen.load()
    const scene = h.render(screen)
    expect(h.find(scene, 'analytics-analyses')).toBeUndefined()
    expect(h.find(scene, 'analytics-analyses-empty-title')?.text).toBe('No stored analyses')
    const metrics = h.find(scene, 'analytics-metrics')
    expect(metrics?.children?.map((pair) => pair.children?.length)).toEqual([2, 2])
  })

  it('keeps an error notice across navigation', async () => {
    const h = nativeHarness({
      getLocalAgentStatuses: vi.fn(async () => h.context.data.agents),
      getLatestDiscover: vi.fn(async () => nativeDiscoverFixture),
      saveDiscoverResult: vi.fn(async () => {
        throw new Error('Fixture save failure')
      })
    })
    let json = ''
    const presenter = new NativePresenter(h.api, {
      preferences: { ...defaultNativePreferences },
      present: (scene) => {
        json = scene
      },
      persist: vi.fn(async () => undefined),
      openExternal: vi.fn()
    })
    try {
      await presenter.start()
      await presenter.command('save-selected')
      expect(h.find(JSON.parse(json).root, 'native-notice')?.text).toContain('Fixture save failure')
      await presenter.command('show-analytics')
      expect(h.find(JSON.parse(json).root, 'native-notice')?.text).toContain('Fixture save failure')
    } finally {
      presenter.dispose()
    }
  })

  it('selects no workspace during a local search and clears a success notice on navigation', async () => {
    vi.useFakeTimers()
    const h = nativeHarness({
      getLocalAgentStatuses: vi.fn(async () => h.context.data.agents),
      getLatestDiscover: vi.fn(async () => nativeDiscoverFixture),
      saveDiscoverResult: vi.fn(async () => h.dashboard),
      searchLocal: vi.fn(async () => ({ query: 'edge', results: [] }))
    })
    let json = ''
    const presenter = new NativePresenter(h.api, {
      preferences: { ...defaultNativePreferences },
      present: (scene) => {
        json = scene
      },
      persist: vi.fn(async () => undefined),
      openExternal: vi.fn()
    })
    const scene = () => JSON.parse(json)
    const navigation = () => h.find(scene().root, 'native-navigation')
    try {
      await presenter.start()
      expect(navigation()?.selected).toBe('discover')
      await presenter.command('save-selected')
      expect(h.find(scene().root, 'native-notice')?.text).toContain('Saved:')
      await presenter.command('show-analytics')
      expect(h.find(scene().root, 'native-notice')?.text ?? '').toBe('')
      await presenter.command('open-local-search')
      const field = scene().toolbar.items.find(
        (item: { id: string }) => item.id === 'local-search-query'
      )
      await presenter.presentation.dispatch(JSON.stringify({ action: field.action, value: 'edge' }))
      await vi.advanceTimersByTimeAsync(500)
      expect(h.find(scene().root, 'local-search-page')).toBeDefined()
      expect(navigation()?.selected).toBeUndefined()
      await presenter.command('show-analytics')
      expect(h.find(scene().root, 'local-search-page')).toBeUndefined()
      expect(navigation()?.selected).toBe('analytics')
    } finally {
      presenter.dispose()
      vi.useRealTimers()
    }
  })
})

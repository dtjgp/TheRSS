import { describe, expect, it, vi } from 'vitest'
import type { SourceContentSnapshot } from '../../shared/api'
import { DiscoverScreen } from './discover'
import { ResearchReader, TriageHistory } from './reading'
import { localSearchHarness, nativeDiscoverFixture, nativeHarness } from './testSupport'

describe('native display dates in the system language', () => {
  it('localizes the reading header and Discover rows but keeps evidence and citations ISO', async () => {
    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => nativeDiscoverFixture) })
    Object.assign(h.context, { locale: 'zh-CN' })
    const discover = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await discover.load()
    const view = h.render(discover)
    const item = nativeDiscoverFixture.items[0]!
    expect(h.find(view, 'discover-reading-meta')?.text).toBe('arXiv · 2026年9月6日')
    const row = h.find(view, 'discover-results')?.rows?.[0]
    expect(row?.subtitle).toBe('arXiv · 2026年9月6日')
    // The citation leaving the app keeps the machine-readable ISO day.
    expect(row?.drag?.text).toContain(`. arXiv. ${item.publishedAt.slice(0, 10)}. https:`)
    expect(h.find(view, 'discover-result-status')?.text).toMatch(/年\d{1,2}月\d{1,2}日$/u)
    await h.act(discover, 'discover-metadata-toggle')
    expect(h.find(h.render(discover), 'discover-provenance')?.text).toContain(
      `Published: ${item.publishedAt}`
    )
    discover.dispose()
  })
  it('localizes local search results', async () => {
    const results = [
      {
        id: 'saved-1',
        kind: 'saved' as const,
        itemId: 'arxiv:1',
        title: 'Paper',
        detail: 'saved',
        source: 'arxiv' as const,
        url: 'https://arxiv.org/abs/1',
        createdAt: '2026-10-04T08:00:00.000Z',
        target: { kind: 'saved' as const, itemId: 'arxiv:1' }
      }
    ]
    const h = nativeHarness({ searchLocal: vi.fn(async () => ({ query: 'paper', results })) })
    Object.assign(h.context, { locale: 'de-DE' })
    const screen = localSearchHarness(h.context)
    await h.act(screen, 'local-search-query', 'paper')
    await h.context.presentation.dispatch(
      JSON.stringify({ action: h.find(h.render(screen), 'local-search-query')!.activate })
    )
    expect(h.find(h.render(screen), 'local-search-results')?.rows?.[0]?.subtitle).toBe(
      'Saved item · arXiv · 04.10.2026'
    )
  })
  it('lets a record window use the same locale', () => {
    const h = nativeHarness()
    const reader = new ResearchReader(h.context, 'saved', new TriageHistory(h.context), {
      readOnly: true
    })
    reader.select({ ...nativeDiscoverFixture.items[0]!, triageState: 'saved' })
    expect(h.find(reader.render(), 'saved-reading-meta')?.text).toBe('arXiv · Sep 6, 2026 · Saved')
  })
})

describe('more native date sites in the system language', () => {
  it('localizes the Sources content list and the Data Analytics analysis list', async () => {
    const { SourcesScreen } = await import('./sources')
    const { AnalyticsScreen } = await import('./analytics')
    const item = { ...nativeDiscoverFixture.items[0]!, triageState: 'new' as const }
    const content: SourceContentSnapshot = {
      source: 'arxiv' as const,
      status: 'cached' as const,
      windowDays: 1,
      windowStart: '2026-09-01',
      windowEnd: '2026-09-06',
      lastIndexedAt: null,
      returnedCount: 1,
      rejectedCount: 0,
      items: [item]
    }
    const h = nativeHarness({ getSourceContent: vi.fn(async () => content) })
    const sources = new SourcesScreen(h.context)
    await sources.activate('official:arxiv')
    expect(h.find(h.render(sources), 'source-content-items')?.rows?.[0]?.subtitle).toBe(
      'Sep 6, 2026 · paper'
    )
    const analytics = nativeHarness({
      getAnalytics: vi.fn(async () => ({
        generatedAt: 'now',
        windowDays: 30,
        trackingStartedAt: '2026-09-01',
        totals: {
          searchResults: 0,
          todayResults: 0,
          discoverResults: 0,
          deepAnalyses: 1,
          analyzedPapers: 1
        },
        daily: [],
        analyzedItems: [
          {
            analysisId: 'analysis-1',
            itemId: 'arxiv:1',
            source: 'arxiv' as const,
            title: 'Selected paper',
            url: 'https://arxiv.org/abs/1',
            providerName: 'Fixture',
            model: 'fixture',
            createdAt: '2026-10-04T08:00:00.000Z'
          }
        ]
      }))
    })
    const screen = new AnalyticsScreen(analytics.context)
    await screen.load()
    const rows = analytics.find(analytics.render(screen), 'analytics-analyses')?.rows
    expect(rows?.[0]?.subtitle).toBe('Fixture · fixture · Oct 4, 2026')
  })
})

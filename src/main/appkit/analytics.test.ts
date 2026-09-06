import { describe, expect, it, vi } from 'vitest'
import type { AnalyticsSnapshot } from '../../shared/analytics'
import { AnalyticsScreen } from './analytics'
import { nativeHarness } from './testSupport'

const snapshot: AnalyticsSnapshot = {
  generatedAt: 'now',
  windowDays: 30,
  trackingStartedAt: '2026-09-01',
  totals: {
    searchResults: 12,
    todayResults: 2,
    discoverResults: 10,
    deepAnalyses: 3,
    analyzedPapers: 2
  },
  daily: [
    { date: '2026-09-06', searchResults: 12, todayResults: 2, discoverResults: 10, deepAnalyses: 3 }
  ],
  analyzedItems: [
    {
      analysisId: 'analysis-1',
      itemId: 'arxiv:1',
      source: 'arxiv',
      title: 'Selected paper',
      url: 'https://arxiv.org/abs/1',
      providerName: 'Fixture',
      model: 'fixture',
      createdAt: 'now'
    }
  ]
}
const state = {
  freshness: 'stale' as const,
  currentSourceHash: 'new',
  artifact: {
    id: 'analysis-1',
    itemId: 'arxiv:1',
    providerId: 'fixture',
    providerName: 'Fixture',
    model: 'fixture',
    promptVersion: 'fixture-v1',
    sourceHash: 'old',
    content: '## Full persisted result\n\n' + 'Complete analysis paragraph. '.repeat(200),
    createdAt: 'now'
  }
}

describe('AppKit analytics', () => {
  it('charts only the selected persisted series and exposes exact daily values on request', async () => {
    const h = nativeHarness({ getAnalytics: vi.fn(async () => snapshot) })
    const screen = new AnalyticsScreen(h.context)
    await screen.load()
    expect(h.find(h.render(screen), 'analytics-trend')?.points).toEqual([
      { date: '2026-09-06', value: 10 }
    ])
    await h.act(screen, 'analytics-trend-kind', 'today')
    expect(h.find(h.render(screen), 'analytics-trend')?.points?.[0]?.value).toBe(2)
    await h.act(screen, 'analytics-trend-kind', 'analysis')
    expect(h.find(h.render(screen), 'analytics-trend')?.points?.[0]?.value).toBe(3)
    expect(h.find(h.render(screen), 'analytics-daily')).toBeUndefined()
    await h.act(screen, 'analytics-toggle-values')
    expect(h.find(h.render(screen), 'analytics-daily')?.rows?.[0]?.subtitle).toContain(
      'Discover 10'
    )
    await h.act(screen, 'analytics-toggle-values')
    expect(h.find(h.render(screen), 'analytics-daily')).toBeUndefined()
  })

  it('shows no recorded activity without inventing a trend', async () => {
    const empty = {
      ...snapshot,
      daily: [
        {
          date: '2026-09-06',
          searchResults: 0,
          todayResults: 0,
          discoverResults: 0,
          deepAnalyses: 0
        }
      ],
      analyzedItems: []
    }
    const h = nativeHarness({ getAnalytics: vi.fn(async () => empty) })
    const screen = new AnalyticsScreen(h.context)
    await screen.load()
    expect(h.find(h.render(screen), 'analytics-trend')).toBeUndefined()
    expect(h.find(h.render(screen), 'analytics-trend-empty')?.text).toContain('No Discover records')
  })
  it('displays stored metrics and opens a complete persisted artifact with freshness', async () => {
    const get = vi.fn(async () => state)
    const h = nativeHarness({ getAnalytics: vi.fn(async () => snapshot), getAnalysisArtifact: get })
    const screen = new AnalyticsScreen(h.context)
    await screen.load()
    expect(get).not.toHaveBeenCalled()
    expect(JSON.stringify(h.render(screen))).toContain('12')
    await h.act(screen, 'analytics-analyses', 'analysis-1')
    expect(get).toHaveBeenCalledWith('analysis-1')
    expect(h.find(h.render(screen), 'analytics-analysis-content')?.text).toContain(
      state.artifact.content
    )
    expect(JSON.stringify(h.render(screen))).toContain('stale')
  })

  it('shows retry and preserves prior metrics if reloading fails', async () => {
    const get = vi.fn(async () => snapshot)
    const h = nativeHarness({ getAnalytics: get })
    const screen = new AnalyticsScreen(h.context)
    await screen.load()
    get.mockRejectedValueOnce(new Error('Fixture database failure'))
    await screen.load()
    expect(JSON.stringify(h.render(screen))).toContain('Fixture database failure')
    expect(h.find(h.render(screen), 'analytics-retry')?.enabled).toBe(true)
    expect(h.find(h.render(screen), 'analytics-analyses')?.rows).toHaveLength(1)
  })
})

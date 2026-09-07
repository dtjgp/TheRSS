import { describe, expect, it, vi } from 'vitest'
import { DiscoverScreen } from './discover'
import { NativeModals } from './modals'
import { ResearchReader, TriageHistory } from './reading'
import { SourcesScreen } from './sources'
import { nativeDiscoverFixture, nativeHarness } from './testSupport'

describe('direct native interaction', () => {
  it('keeps local typing responsive and discards obsolete or closed-query responses', async () => {
    vi.useFakeTimers()
    try {
      const complete = new Map<string, (value: { query: string; results: [] }) => void>()
      const search = vi.fn(
        (query: string) =>
          new Promise<{ query: string; results: [] }>((resolve) => complete.set(query, resolve))
      )
      const h = nativeHarness({ searchLocal: search })
      const modal = new NativeModals(h.context)
      modal.openSearch()
      const screen = { render: () => modal.render()! }
      await h.act(screen, 'local-search-query', 'first')
      await vi.advanceTimersByTimeAsync(250)
      expect(h.find(h.render(screen), 'local-search-query')?.enabled).toBe(true)
      await h.act(screen, 'local-search-query', 'second')
      await vi.advanceTimersByTimeAsync(250)
      complete.get('second')!({ query: 'second', results: [] })
      await vi.advanceTimersByTimeAsync(0)
      complete.get('first')!({ query: 'first', results: [] })
      await vi.advanceTimersByTimeAsync(0)
      expect(h.find(h.render(screen), 'local-search-result-count')?.text).toContain('second')
      await h.act(screen, 'local-search-query', 'x')
      expect(h.find(h.render(screen), 'local-search-result-count')).toBeUndefined()
      await h.act(screen, 'local-search-query', 'closing')
      await modal.close()
      await vi.advanceTimersByTimeAsync(500)
      expect(search).toHaveBeenCalledTimes(2)
      expect(modal.render()).toBeUndefined()
      modal.dispose()
    } finally {
      vi.useRealTimers()
    }
  })
  it('keeps the restored query directly editable and separates an unsubmitted draft from old results', async () => {
    const h = nativeHarness({
      getLatestDiscover: async () => nativeDiscoverFixture,
      searchDiscover: vi.fn()
    })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    expect(h.find(h.render(screen), 'discover-query')?.value).toBe(nativeDiscoverFixture.intent)
    expect(h.find(h.render(screen), 'discover-edit-search')).toBeUndefined()
    expect(h.find(h.render(screen), 'discover-done-editing')).toBeUndefined()
    await h.act(screen, 'discover-query', 'A changed question')
    expect(h.api.searchDiscover).not.toHaveBeenCalled()
    expect(h.find(h.render(screen), 'discover-results')?.rows).toHaveLength(24)
    expect(h.find(h.render(screen), 'discover-draft-status')?.text).toContain(
      nativeDiscoverFixture.intent
    )
    screen.dispose()
  })

  it('opens and returns from a narrow result list without a Read selected button', async () => {
    const h = nativeHarness({ getLatestDiscover: async () => nativeDiscoverFixture })
    h.context.compact = () => true
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    expect(h.find(h.render(screen), 'discover-open-reader')).toBeUndefined()
    const table = h.find(h.render(screen), 'discover-results')!
    await h.context.presentation.dispatch(
      JSON.stringify({ action: table.activate, value: 'arxiv:3' })
    )
    expect(h.find(h.render(screen), 'discover-reading-title')?.text).toBe('Paper 3')
    await h.act(screen, 'discover-back-to-results')
    expect(h.find(h.render(screen), 'discover-query')?.value).toBe(nativeDiscoverFixture.intent)
    expect(h.find(h.render(screen), 'discover-results')?.selected).toBe('arxiv:3')
    screen.dispose()
  })

  it.each(['discover', 'saved'] as const)(
    'shows the complete %s summary in its existing scroll area',
    (scope) => {
      const h = nativeHarness()
      const reader = new ResearchReader(h.context, scope, new TriageHistory(h.context))
      const summary = 'A long source summary. '.repeat(100) + 'Visible final sentence.'
      reader.select({ ...nativeDiscoverFixture.items[0]!, summary, triageState: 'saved' })
      expect(h.find(h.render(reader), `${scope}-summary`)?.text).toBe(summary)
      expect(h.find(h.render(reader), `${scope}-expand`)).toBeUndefined()
      reader.dispose()
    }
  )

  it('opens source content from the list without another cached-content button', async () => {
    const h = nativeHarness()
    const screen = new SourcesScreen(h.context)
    await screen.activate('folo:302')
    expect(h.find(h.render(screen), 'sources-load')).toBeUndefined()
    expect(h.find(h.render(screen), 'sources-refresh')).toBeDefined()
    expect(h.find(h.render(screen), 'sources-open-site')).toBeDefined()
    screen.dispose()
  })

  it('debounces local typing and opens the exact result directly', async () => {
    vi.useFakeTimers()
    try {
      const target = { kind: 'analysis' as const, analysisId: 'historical-analysis' }
      const result = {
        id: 'historical-analysis',
        kind: 'analysis' as const,
        itemId: 'arxiv:1',
        title: 'Stored analysis',
        detail: 'Existing content',
        source: 'arxiv' as const,
        url: 'https://arxiv.org/abs/1',
        createdAt: '2026-09-07',
        target
      }
      const h = nativeHarness({
        searchLocal: vi.fn(async (query) => ({ query, results: [result] }))
      })
      const modal = new NativeModals(h.context)
      modal.openSearch()
      const screen = { render: () => modal.render()! }
      await h.act(screen, 'local-search-query', 'edge')
      await vi.advanceTimersByTimeAsync(249)
      expect(h.api.searchLocal).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(h.api.searchLocal).toHaveBeenCalledExactlyOnceWith('edge')
      expect(h.find(h.render(screen), 'local-search-submit')).toBeUndefined()
      expect(h.find(h.render(screen), 'local-search-open-in-app')).toBeUndefined()
      const table = h.find(h.render(screen), 'local-search-results')!
      await h.context.presentation.dispatch(
        JSON.stringify({ action: table.activate, value: 'analysis:historical-analysis' })
      )
      expect(h.context.openLocal).toHaveBeenCalledWith(target, expect.any(Function))
      expect(h.context.openExternal).not.toHaveBeenCalled()
      modal.dispose()
    } finally {
      vi.useRealTimers()
    }
  })
})

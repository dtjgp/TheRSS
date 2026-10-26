import { describe, expect, it, vi } from 'vitest'
import { NativePresentation, type NativeNode } from './presentation'
import { DiscoverScreen } from './discover'
import { SavedScreen } from './saved'
import { TriageHistory } from './reading'
import { localSearchHarness, nativeDiscoverFixture, nativeHarness } from './testSupport'

const parts = (node: NativeNode | undefined) =>
  Object.fromEntries((node?.children ?? []).map((child) => [child.id, child]))

describe('native empty states', () => {
  it('bounds symbol nodes and centered alignment at the presentation boundary', () => {
    const view = new NativePresentation()
    const symbol = { id: 'glyph', kind: 'symbol', symbol: 'star', title: 'Saved', size: 40 }
    const centered = {
      id: 'empty',
      kind: 'column',
      align: 'center',
      children: [symbol, { id: 'title', kind: 'label', text: 'No saved research', align: 'center' }]
    } as NativeNode
    expect(JSON.parse(view.finish(centered)).root).toMatchObject({ align: 'center' })
    for (const invalid of [
      { ...centered, children: [{ ...symbol, symbol: undefined }] },
      { ...centered, children: [{ ...symbol, size: 80 }] },
      { ...centered, children: [{ ...symbol, size: 12 }] },
      { ...centered, children: [{ id: 'go', kind: 'button', title: 'Go', align: 'center' }] }
    ])
      expect(() => view.finish(invalid as NativeNode)).toThrow()
  })

  it('explains an empty Discover workspace and recovers a filtered-out view', async () => {
    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => null) })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    let empty = h.find(h.render(screen), 'discover-empty')
    expect(empty).toMatchObject({ kind: 'column', align: 'center' })
    expect(parts(empty)['discover-empty-symbol']).toMatchObject({
      kind: 'symbol',
      symbol: 'sparkle.magnifyingglass'
    })
    expect(parts(empty)['discover-empty-title']?.text).toBe('Start a research search')
    expect(parts(empty)['discover-empty-message']?.text).toContain('keep the results on this Mac')
    screen.dispose()

    const loaded = nativeHarness({ getLatestDiscover: vi.fn(async () => nativeDiscoverFixture) })
    const discover = new DiscoverScreen(loaded.context, new TriageHistory(loaded.context))
    await discover.load()
    await loaded.act(discover, 'discover-kind', 'repository')
    empty = loaded.find(loaded.render(discover), 'discover-empty')
    expect(parts(empty)['discover-empty-title']?.text).toBe('No repositories in this session')
    expect(parts(empty)['discover-empty-message']?.text).toContain('Search details')
    await loaded.act(discover, 'discover-show-all')
    expect(loaded.find(loaded.render(discover), 'discover-kind')?.selected).toBe('all')
    expect(loaded.find(loaded.render(discover), 'discover-results')?.rows).toHaveLength(
      nativeDiscoverFixture.items.length
    )
    discover.dispose()
  })

  it('titles an empty session by its outcome, keeping failed and canceled distinct', async () => {
    for (const [status, title] of [
      ['failed', 'Search failed'],
      ['canceled', 'Search canceled'],
      ['no_results', 'No results']
    ] as const) {
      const h = nativeHarness({
        getLatestDiscover: vi.fn(async () => ({ ...nativeDiscoverFixture, status, items: [] }))
      })
      const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
      await screen.load()
      const empty = h.find(h.render(screen), 'discover-empty')
      expect(parts(empty)['discover-empty-title']?.text).toBe(title)
      expect(parts(empty)['discover-empty-message']?.text).toContain('Search details')
      screen.dispose()
    }
  })
  it('titles empty Saved views and keeps their recovery actions', async () => {
    const h = nativeHarness()
    const screen = new SavedScreen(h.context, new TriageHistory(h.context))
    let empty = h.find(h.render(screen), 'saved-empty')
    expect(empty).toMatchObject({ align: 'center' })
    expect(parts(empty)['saved-empty-symbol']).toMatchObject({ symbol: 'star' })
    expect(parts(empty)['saved-empty-title']?.text).toBe('No saved research')
    expect(h.find(empty!, 'saved-open-discover')).toBeDefined()
    h.context.data.dashboard = {
      ...h.dashboard,
      savedItems: [{ ...nativeDiscoverFixture.items[0]!, triageState: 'saved' }]
    }
    await h.act(screen, 'saved-source-filter', 'github')
    empty = h.find(h.render(screen), 'saved-empty')
    expect(parts(empty)['saved-empty-title']?.text).toBe('No items from GitHub')
    expect(parts(empty)['saved-empty-message']?.text).toMatch(/^No saved items from this source\./u)
    expect(h.find(empty!, 'saved-reset-filter')).toBeDefined()
  })

  it('names the query when local search finds nothing', async () => {
    const h = nativeHarness({ searchLocal: vi.fn(async () => ({ query: 'pruning', results: [] })) })
    const screen = localSearchHarness(h.context)
    await h.act(screen, 'local-search-query', 'pruning')
    await h.context.presentation.dispatch(
      JSON.stringify({ action: h.find(h.render(screen), 'local-search-query')!.activate })
    )
    const empty = h.find(h.render(screen), 'local-search-empty')
    expect(parts(empty)['local-search-empty-symbol']).toMatchObject({ symbol: 'magnifyingglass' })
    expect(parts(empty)['local-search-empty-title']?.text).toBe('No results for “pruning”')
    expect(parts(empty)['local-search-empty-message']?.text).toContain('No matching local records')
  })
})

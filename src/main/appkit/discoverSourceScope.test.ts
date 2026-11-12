import { describe, expect, it, vi } from 'vitest'
import { DISCOVER_SOURCE_IDS, type DiscoverSnapshot } from '../../shared/discover'
import type { DiscoverSourcePreference } from '../../shared/discoverSourcePreference'
import { DiscoverScreen } from './discover'
import { TriageHistory } from './reading'
import { sourcePreferences } from './sourcePreferences'
import { nativeDiscoverFixture, nativeHarness } from './testSupport'

const preference = (sources: DiscoverSourcePreference['sources']): DiscoverSourcePreference => ({
  sources,
  unavailable: [],
  origin: 'user',
  updatedAt: '2026-11-12T00:00:00.000Z'
})
// The latest stored session searched only arXiv.
const latest: DiscoverSnapshot = {
  ...nativeDiscoverFixture,
  sourceOutcomes: Object.fromEntries(
    Object.entries(nativeDiscoverFixture.sourceOutcomes).map(([source, outcome]) => [
      source,
      source === 'arxiv' ? outcome : { ...outcome, status: 'not_searched' as const }
    ])
  ) as DiscoverSnapshot['sourceOutcomes']
}

function setup(overrides: Parameters<typeof nativeHarness>[0] = {}) {
  const h = nativeHarness({
    getLatestDiscover: vi.fn(async () => latest),
    getDiscoverSourcePreference: vi.fn(async () => preference(['github', 'folo:84'])),
    searchDiscover: vi.fn(async () => latest),
    retryDiscover: vi.fn(async () => latest),
    ...overrides
  })
  const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
  const node = (id: string) => h.find(h.render(screen), id)
  const act = (id: string, value?: string | boolean) => h.act(screen, id, value)
  return { h, screen, node, act }
}

describe('Discover sources for this search', () => {
  it('starts from the stored default, not from the loaded session, and names both scopes', async () => {
    const f = setup()
    await f.screen.load()
    expect(f.node('discover-source-picker')?.title).toBe('Sources for this search · 2/22')
    expect(f.node('discover-source-mode')?.text).toBe('Using your default sources')
    expect(f.node('discover-source-scope-note')?.text).toBe(
      'These results searched 1 of 22 sources. The next search uses 2 of 22 sources.'
    )
    f.screen.dispose()
  })

  it('applies, cancels and restores a separate draft without saving the default', async () => {
    const f = setup()
    await f.screen.load()
    await f.act('discover-source-picker')
    expect(f.node('discover-source-sheet-title')?.text).toBe('Sources for this search')
    await f.act('discover-source-arxiv', true)
    // Closing the popover is Cancel: the search sources do not change.
    await f.h.context.presentation.dispatch(
      JSON.stringify({ action: f.h.popover(f.screen)!.close })
    )
    expect(f.node('discover-source-picker')?.title).toBe('Sources for this search · 2/22')
    await f.act('discover-source-picker')
    expect(f.node('discover-source-arxiv')?.checked).toBe(false)
    await f.act('discover-source-arxiv', true)
    await f.act('discover-source-apply')
    expect(f.h.popover(f.screen)).toBeUndefined()
    expect(f.node('discover-source-picker')?.title).toBe('Sources for this search · 3/22')
    expect(f.node('discover-source-mode')?.text).toBe('Custom for this search · default 2/22')
    expect(f.h.api.saveDiscoverSourcePreference).not.toHaveBeenCalled()

    await f.act('discover-runner', 'codex')
    await f.act('discover-query', 'edge pruning')
    await f.act('discover-search')
    expect(f.h.api.searchDiscover).toHaveBeenCalledWith(
      { intent: 'edge pruning', runner: 'codex', sources: ['arxiv', 'github', 'folo:84'] },
      expect.any(String)
    )
    // A finished search does not jump back to the default.
    expect(f.node('discover-source-picker')?.title).toBe('Sources for this search · 3/22')
    await f.act('discover-source-picker')
    await f.act('discover-source-use-defaults')
    expect(f.node('discover-source-arxiv')?.checked).toBe(false)
    await f.act('discover-source-apply')
    expect(f.node('discover-source-mode')?.text).toBe('Using your default sources')
    f.screen.dispose()
  })

  it('blocks applying an empty choice with a nearby reason', async () => {
    const f = setup()
    await f.screen.load()
    await f.act('discover-source-picker')
    await f.act('discover-source-clear-shown')
    expect(f.node('discover-source-apply')?.enabled).toBe(false)
    expect(f.node('discover-source-zero')?.text).toBe('Select at least one source to apply.')
    f.screen.dispose()
  })

  it('keeps the draft when a historical session is opened from local search and restored', async () => {
    const f = setup()
    await f.screen.load()
    const restore = f.screen.openLocal(nativeDiscoverFixture, nativeDiscoverFixture.items[0]!.id)
    expect(f.node('discover-source-picker')?.title).toBe('Sources for this search · 2/22')
    restore()
    expect(f.node('discover-source-picker')?.title).toBe('Sources for this search · 2/22')
    f.screen.dispose()
  })

  it('retries a stored session with its own incomplete sources and keeps the draft', async () => {
    const f = setup({ getLatestDiscover: vi.fn(async () => nativeDiscoverFixture) })
    await f.screen.load()
    await f.act('discover-retry')
    expect(f.h.api.retryDiscover).toHaveBeenCalledWith('session-1', ['arxiv'], expect.any(String))
    expect(f.node('discover-source-picker')?.title).toBe('Sources for this search · 2/22')
    f.screen.dispose()
  })

  it('follows a new default only when the draft still equals the old one and no run is active', async () => {
    const f = setup()
    await f.screen.load()
    await sourcePreferences(f.h.context).save(['folo:84'])
    expect(f.node('discover-source-picker')?.title).toBe('Sources for this search · 1/22')
    expect(f.node('discover-source-note')).toBeUndefined()

    await f.act('discover-source-picker')
    await f.act('discover-source-github', true)
    await f.act('discover-source-apply')
    await sourcePreferences(f.h.context).save(['arxiv'])
    expect(f.node('discover-source-picker')?.title).toBe('Sources for this search · 2/22')
    expect(f.node('discover-source-note')?.text).toBe(
      'Default sources saved. This search keeps its current sources; choose Use defaults to switch.'
    )
    f.screen.dispose()
  })

  it('keeps an active run and its draft when the default changes', async () => {
    let finish!: (snapshot: DiscoverSnapshot) => void
    const f = setup({
      searchDiscover: vi.fn(
        () =>
          new Promise<DiscoverSnapshot>((resolve) => {
            finish = resolve
          })
      )
    })
    await f.screen.load()
    await f.act('discover-runner', 'codex')
    await f.act('discover-query', 'edge')
    const running = f.act('discover-search')
    await sourcePreferences(f.h.context).save(['arxiv'])
    expect(f.node('discover-source-picker')?.title).toBe('Sources for this search · 2/22')
    expect(f.node('discover-source-note')?.text).toMatch(/^Default sources saved/u)
    finish(latest)
    await running
    expect(f.h.api.searchDiscover).toHaveBeenCalledWith(
      expect.objectContaining({ sources: ['github', 'folo:84'] }),
      expect.any(String)
    )
    f.screen.dispose()
  })

  it('blocks search with Retry when the default cannot be read, without selecting all', async () => {
    const read = vi
      .fn<() => Promise<DiscoverSourcePreference>>()
      .mockRejectedValueOnce(new Error('database busy'))
      .mockResolvedValue(preference(['github']))
    const f = setup({ getDiscoverSourcePreference: read })
    await f.screen.load()
    await f.act('discover-runner', 'codex')
    expect(f.node('discover-source-picker')?.title).toBe('Sources for this search · 0/22')
    expect(f.node('discover-search')?.enabled).toBe(false)
    expect(f.node('discover-readiness')?.text).toBe(
      'Your default sources could not be read. Retry, or choose sources for this search.'
    )
    await f.act('discover-sources-retry')
    expect(f.node('discover-source-picker')?.title).toBe('Sources for this search · 1/22')
    f.screen.dispose()
  })

  it('does not let a late default read replace a saved default', async () => {
    let finish!: (value: DiscoverSourcePreference) => void
    const f = setup({
      getDiscoverSourcePreference: vi.fn(
        () =>
          new Promise<DiscoverSourcePreference>((resolve) => {
            finish = resolve
          })
      )
    })
    const loading = f.screen.load()
    await sourcePreferences(f.h.context).save(['folo:84'])
    finish(preference(DISCOVER_SOURCE_IDS))
    await loading
    expect(sourcePreferences(f.h.context).value?.sources).toEqual(['folo:84'])
    expect(f.node('discover-source-picker')?.title).toBe('Sources for this search · 1/22')
    f.screen.dispose()
  })

  it('warns about stored sources that are no longer available and blocks an empty set', async () => {
    const f = setup({
      getDiscoverSourcePreference: vi.fn(async () => ({
        ...preference([]),
        unavailable: ['folo:999999']
      }))
    })
    await f.screen.load()
    await f.act('discover-runner', 'codex')
    expect(f.node('discover-source-note')?.text).toBe(
      '1 saved default source is no longer available. Review My sources in Sources.'
    )
    expect(f.node('discover-search')?.enabled).toBe(false)
    f.screen.dispose()
  })

  it('cancels the draft on Escape and returns focus to the source button', async () => {
    const f = setup()
    await f.screen.load()
    await f.act('discover-source-picker')
    await f.act('discover-source-arxiv', true)
    const popover = f.h.popover(f.screen)!
    expect(popover.cancel).toBeDefined()
    await f.h.context.presentation.dispatch(JSON.stringify({ action: popover.cancel }))
    expect(f.h.popover(f.screen)).toBeUndefined()
    expect(f.h.context.focus).toHaveBeenLastCalledWith('discover-source-picker')
    expect(f.node('discover-source-picker')?.title).toBe('Sources for this search · 2/22')
    f.screen.dispose()
  })
})

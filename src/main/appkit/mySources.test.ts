import { describe, expect, it, vi } from 'vitest'
import { DISCOVER_SOURCE_IDS } from '../../shared/discover'
import type { DiscoverSourcePreference } from '../../shared/discoverSourcePreference'
import { column, type NativeSheet } from './common'
import { SourcesScreen } from './sources'
import { nativeHarness } from './testSupport'

const preference = (
  sources: DiscoverSourcePreference['sources'],
  unavailable: string[] = []
): DiscoverSourcePreference => ({
  sources,
  unavailable,
  origin: 'user',
  updatedAt: '2026-11-12T00:00:00.000Z'
})

function setup(overrides: Parameters<typeof nativeHarness>[0] = {}) {
  const h = nativeHarness({
    getDiscoverSourcePreference: vi.fn(async () => preference(['arxiv', 'github'])),
    ...overrides
  })
  let sheet: NativeSheet | null = null
  Object.assign(h.context, {
    openSheet: vi.fn((next: NativeSheet) => {
      sheet = next
    }),
    closeSheet: vi.fn(() => {
      const closing = sheet
      sheet = null
      closing?.dismissed()
    })
  })
  const screen = new SourcesScreen(h.context)
  const sheetView = { render: () => column('sheet', sheet ? sheet.render() : []) }
  return {
    h,
    screen,
    sheet: () => sheet,
    node: (id: string) => h.find(h.render(screen), id),
    sheetNode: (id: string) => h.find(sheetView.render(), id),
    actSheet: (id: string, value?: string | boolean) => h.act(sheetView, id, value)
  }
}

describe('My sources in Sources', () => {
  it('shows the default count and edits a draft that Cancel discards', async () => {
    const f = setup()
    await f.screen.load()
    expect(f.node('sources-my-sources')?.title).toBe('My sources · 2/22')
    await f.h.act(f.screen, 'sources-my-sources')
    expect(f.sheet()?.title).toBe('Default search sources')
    expect(f.sheet()?.returnFocus).toBe('sources-my-sources')
    expect(f.sheetNode('my-sources-count')?.text).toBe('2 of 22 selected')
    expect(f.sheetNode('my-sources-folo:64-role')?.text).toBeTruthy()
    await f.actSheet('my-sources-restore')
    expect(f.sheetNode('my-sources-count')?.text).toBe('22 of 22 selected')
    await f.actSheet('my-sources-cancel')
    expect(f.sheet()).toBeNull()
    expect(f.h.api.saveDiscoverSourcePreference).not.toHaveBeenCalled()
    await f.h.act(f.screen, 'sources-my-sources')
    expect(f.sheetNode('my-sources-count')?.text).toBe('2 of 22 selected')
    // Escape (the sheet's cancel) also discards the draft.
    await f.actSheet('my-sources-clear-shown')
    f.sheet()!.dismissed()
    expect(f.h.api.saveDiscoverSourcePreference).not.toHaveBeenCalled()
    f.screen.dispose()
  })

  it('finds by role or group, changes only shown sources and keeps hidden choices', async () => {
    const f = setup()
    await f.screen.load()
    await f.h.act(f.screen, 'sources-my-sources')
    await f.actSheet('my-sources-query', 'Business & policy')
    expect(f.sheetNode('my-sources-arxiv')).toBeUndefined()
    await f.actSheet('my-sources-select-shown')
    await f.actSheet('my-sources-query', '')
    expect(f.sheetNode('my-sources-arxiv')?.checked).toBe(true)
    expect(f.sheetNode('my-sources-folo:84')?.checked).toBe(true)
    expect(f.sheetNode('my-sources-group-business-title')?.text).toBe(
      'Business & policy · 3/3 selected'
    )
    await f.actSheet('my-sources-only-selected', true)
    expect(f.sheetNode('my-sources-shown-count')?.text).toBe('5 of 22 shown · 5 selected')
    f.screen.dispose()
  })

  it('blocks saving zero sources with a nearby reason', async () => {
    const f = setup()
    await f.screen.load()
    await f.h.act(f.screen, 'sources-my-sources')
    await f.actSheet('my-sources-clear-shown')
    expect(f.sheetNode('my-sources-save')?.enabled).toBe(false)
    expect(f.sheetNode('my-sources-zero')?.text).toBe('Select at least one source to save.')
    f.screen.dispose()
  })

  it('keeps the draft after a failed save and saves on retry without starting a search', async () => {
    const save = vi
      .fn<(sources: readonly string[]) => Promise<DiscoverSourcePreference>>()
      .mockRejectedValueOnce(new Error('disk full'))
      .mockImplementation(async (sources) => preference(sources as never))
    const f = setup({ saveDiscoverSourcePreference: save as never, searchDiscover: vi.fn() })
    await f.screen.load()
    await f.h.act(f.screen, 'sources-my-sources')
    await f.actSheet('my-sources-folo:84', true)
    await f.actSheet('my-sources-save')
    expect(f.sheetNode('my-sources-error')?.text).toBe(
      'The default sources could not be saved. Your choice is kept; try again.'
    )
    expect(f.sheetNode('my-sources-count')?.text).toBe('3 of 22 selected')
    await f.actSheet('my-sources-save')
    expect(save).toHaveBeenLastCalledWith(['arxiv', 'github', 'folo:84'])
    expect(f.sheet()).toBeNull()
    expect(f.h.context.notify).toHaveBeenCalledWith(
      'Default sources saved. New Discover searches start with them.'
    )
    expect(f.node('sources-my-sources')?.title).toBe('My sources · 3/22')
    expect(f.h.api.searchDiscover).not.toHaveBeenCalled()
    f.screen.dispose()
  })

  it('names unavailable stored sources and recovers from a failed read', async () => {
    const read = vi
      .fn<() => Promise<DiscoverSourcePreference>>()
      .mockRejectedValueOnce(new Error('busy'))
      .mockResolvedValue(preference([...DISCOVER_SOURCE_IDS], ['folo:999999']))
    const f = setup({ getDiscoverSourcePreference: read })
    await f.screen.load()
    expect(f.node('sources-my-sources')?.title).toBe('My sources · not loaded')
    expect(f.node('sources-my-sources-error')?.text).toBe(
      'Your default sources could not be read. Choose My sources to try again.'
    )
    await f.h.act(f.screen, 'sources-my-sources')
    expect(f.sheet()).toBeNull()
    expect(f.node('sources-my-sources')?.title).toBe('My sources · 22/22')
    await f.h.act(f.screen, 'sources-my-sources')
    expect(f.sheetNode('my-sources-unavailable')?.text).toBe(
      '1 saved source is no longer available and is not used.'
    )
    f.screen.dispose()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { DiscoverScreen } from './discover'
import { SavedScreen } from './saved'
import { ResearchReader, TriageHistory } from './reading'
import { NativeRecordPresenter } from './recordPresenter'
import { nativeDiscoverFixture, nativeHarness } from './testSupport'
import type { NativeNode } from './presentation'

const item = { ...nativeDiscoverFixture.items[0]!, triageState: 'new' as const }

describe('records in their own window', () => {
  it('reads a record without data-changing actions', () => {
    const h = nativeHarness()
    const reader = new ResearchReader(h.context, 'discover', new TriageHistory(h.context), {
      readOnly: true
    })
    reader.select(item, 'session-1')
    const view = reader.render()
    expect(h.find(view, 'discover-reading-title')?.text).toBe(item.title)
    expect(h.find(view, 'discover-open')).toBeDefined()
    expect(h.find(view, 'discover-share')).toBeDefined()
    expect(h.find(view, 'discover-metadata-toggle')).toBeDefined()
    expect(h.find(view, 'discover-reading-meta')?.text).not.toContain('Saved')
    for (const id of [
      'discover-save',
      'discover-analyze',
      'discover-dismiss',
      'discover-analysis-readiness',
      'discover-promote'
    ])
      expect(h.find(view, id), id).toBeUndefined()
  })

  it('presents the record with its title and ignores app commands', async () => {
    const h = nativeHarness()
    let scene = ''
    const presenter = new NativeRecordPresenter(h.api, {
      record: { item, sessionId: 'session-1', scope: 'discover' },
      present: (next) => {
        scene = next
      },
      openExternal: vi.fn()
    })
    await presenter.start()
    let parsed = JSON.parse(scene) as { root: NativeNode; toolbar: { title: string }; zoom: number }
    expect(parsed.toolbar.title).toBe(item.title)
    expect(h.find(parsed.root, 'discover-reading-title')?.text).toBe(item.title)
    expect(h.find(parsed.root, 'discover-save')).toBeUndefined()
    presenter.zoom('in')
    parsed = JSON.parse(scene)
    expect(parsed.zoom).toBeGreaterThan(1)
    await presenter.command('open-local-search')
    expect(h.find(JSON.parse(scene).root, 'discover-reading-title')).toBeDefined()
    presenter.dispose()
  })

  it('opens Discover and Saved records in a window by double-click and context menu', async () => {
    const h = nativeHarness({
      getLatestDiscover: vi.fn(async () => nativeDiscoverFixture),
      showContextMenu: vi.fn(async () => ({
        action: 'open-window' as const,
        itemId: nativeDiscoverFixture.items[0]!.id,
        sessionId: nativeDiscoverFixture.id
      }))
    })
    const discover = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await discover.load()
    const results = h.find(h.render(discover), 'discover-results')!
    expect(results.openWindow).toBeDefined()
    await h.context.presentation.dispatch(
      JSON.stringify({ action: results.openWindow, value: nativeDiscoverFixture.items[1]!.id })
    )
    expect(h.context.openRecord).toHaveBeenLastCalledWith(
      expect.objectContaining({
        item: expect.objectContaining({ id: nativeDiscoverFixture.items[1]!.id }),
        sessionId: nativeDiscoverFixture.id,
        scope: 'discover',
        // Source details keep the Discover provenance in the record window.
        extra: expect.stringContaining('## Source details')
      })
    )
    await h.context.presentation.dispatch(
      JSON.stringify({ action: results.context, value: nativeDiscoverFixture.items[0]!.id })
    )
    expect(h.api.showContextMenu).toHaveBeenLastCalledWith(
      expect.objectContaining({ canOpenWindow: true })
    )
    expect(h.context.openRecord).toHaveBeenLastCalledWith(
      expect.objectContaining({
        item: expect.objectContaining({ id: nativeDiscoverFixture.items[0]!.id })
      })
    )
    discover.dispose()
    h.context.data.dashboard = { ...h.dashboard, savedItems: [{ ...item, triageState: 'saved' }] }
    const saved = new SavedScreen(h.context, new TriageHistory(h.context))
    const rows = h.find(h.render(saved), 'saved-items')!
    await h.context.presentation.dispatch(
      JSON.stringify({ action: rows.openWindow, value: item.id })
    )
    expect(h.context.openRecord).toHaveBeenLastCalledWith(
      expect.objectContaining({ scope: 'saved', item: expect.objectContaining({ id: item.id }) })
    )
  })
  it('hands the record window the current Saved state, not the session snapshot', async () => {
    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => nativeDiscoverFixture) })
    Object.assign(h.api, { saveDiscoverResult: vi.fn(async () => h.dashboard) })
    const discover = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await discover.load()
    const first = nativeDiscoverFixture.items[0]!
    expect(first.saved).toBe(false)
    await h.act(discover, 'discover-save')
    expect(h.api.saveDiscoverResult).toHaveBeenCalledWith(nativeDiscoverFixture.id, first.id)
    const results = h.find(h.render(discover), 'discover-results')!
    await h.context.presentation.dispatch(
      JSON.stringify({ action: results.openWindow, value: first.id })
    )
    expect(h.context.openRecord).toHaveBeenLastCalledWith(
      expect.objectContaining({
        item: expect.objectContaining({ id: first.id, triageState: 'saved' })
      })
    )
    discover.dispose()
  })
})

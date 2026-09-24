import { describe, expect, it, vi } from 'vitest'
import { NativePresenter } from './presenter'
import { defaultNativePreferences } from './preferences'
import { nativeHarness } from './testSupport'
import type { NativeNode } from './presentation'

describe('AppKit application shell', () => {
  it('renders workspaces as a source list and window commands in the toolbar', async () => {
    const h = nativeHarness({ getLocalAgentStatuses: vi.fn(async () => []) })
    let scene = ''
    const presenter = new NativePresenter(h.api, {
      preferences: { ...defaultNativePreferences },
      present: (next) => {
        scene = next
      },
      persist: vi.fn(async () => undefined),
      openExternal: vi.fn()
    })
    await presenter.start()
    let parsed = JSON.parse(scene)
    expect(h.find(parsed.root, 'native-brand')).toBeUndefined()
    expect(h.find(parsed.root, 'native-sidebar-caption')).toBeUndefined()
    expect(h.find(parsed.root, 'navigate-discover')).toBeUndefined()
    const navigation = h.find(parsed.root, 'native-navigation')!
    expect(navigation).toMatchObject({ kind: 'sidebar', title: 'Workspaces', selected: 'discover' })
    expect(navigation.rows!.map((row) => [row.id, row.title, row.symbol])).toEqual([
      ['discover', 'Discover', 'sparkle.magnifyingglass'],
      ['saved', 'Saved', 'star'],
      ['analytics', 'Data Analytics', 'chart.bar'],
      ['sources', 'Sources', 'square.stack'],
      ['settings', 'Settings', 'gearshape']
    ])
    expect(parsed.toolbar.title).toBe('Discover')
    expect(parsed.toolbar.items.map((item: { id: string }) => item.id)).toEqual([
      'sidebar-toggle',
      'open-local-search',
      'undo-triage'
    ])
    expect(parsed.toolbar.items[1]).toMatchObject({
      title: 'Find local research',
      symbol: 'magnifyingglass',
      enabled: true
    })
    await presenter.presentation.dispatch(
      JSON.stringify({ action: navigation.action, value: 'saved' })
    )
    parsed = JSON.parse(scene)
    expect(parsed.toolbar.title).toBe('Saved')
    expect(h.find(parsed.root, 'native-navigation')?.selected).toBe('saved')
    expect(scene).toContain('saved-page')
    presenter.dispose()
  })
  it('names each workspace once, in the window title, not again as a content heading', async () => {
    const h = nativeHarness({
      getLocalAgentStatuses: vi.fn(async () => []),
      confirmDiscardSettings: vi.fn(async () => true)
    })
    let scene = ''
    const presenter = new NativePresenter(h.api, {
      preferences: { ...defaultNativePreferences },
      present: (next) => {
        scene = next
      },
      persist: vi.fn(async () => undefined),
      openExternal: vi.fn()
    })
    await presenter.start()
    const headings = (node: NativeNode): string[] => [
      ...(node.kind === 'label' && node.weight === 'title' ? [node.text ?? ''] : []),
      ...(node.children ?? []).flatMap(headings)
    ]
    for (const route of ['discover', 'saved', 'analytics', 'sources', 'settings'] as const) {
      await presenter.navigate(route)
      const parsed = JSON.parse(scene)
      expect(headings(h.find(parsed.root, 'native-main')!)).not.toContain(parsed.toolbar.title)
    }
    presenter.dispose()
  })
  it('keeps source failures on Sources without a global attention action', async () => {
    const h = nativeHarness({ getLocalAgentStatuses: vi.fn(async () => []) })
    h.context.data.dashboard = { ...h.dashboard, sourceHealth: { arxiv: 'failed', github: 'idle' } }
    vi.mocked(h.api.getDashboard).mockResolvedValue(h.context.data.dashboard)
    let scene = ''
    const presenter = new NativePresenter(h.api, {
      preferences: { ...defaultNativePreferences },
      present: (next) => {
        scene = next
      },
      persist: vi.fn(async () => undefined),
      openExternal: vi.fn()
    })
    await presenter.start()
    await presenter.navigate('sources')
    expect(h.find(JSON.parse(scene).root, 'source-health-attention')).toBeUndefined()
    expect(h.find(JSON.parse(scene).root, 'sources-attention')).toMatchObject({
      title: 'Failed or partial',
      checked: false
    })
    presenter.dispose()
  })
  it('guards settings navigation and keeps the original route when edits are retained', async () => {
    const confirm = vi.fn(async () => false)
    const h = nativeHarness({
      getLocalAgentStatuses: vi.fn(async () => []),
      confirmDiscardSettings: confirm
    })
    const output: string[] = []
    const presenter = new NativePresenter(h.api, {
      preferences: { ...defaultNativePreferences },
      present: (scene) => output.push(scene),
      persist: vi.fn(async () => undefined),
      openExternal: vi.fn()
    })
    await presenter.start()
    await presenter.navigate('settings')
    await presenter.navigate('saved')
    expect(confirm).toHaveBeenCalledOnce()
    expect(output.at(-1)).toContain('settings-page')
    confirm.mockResolvedValue(true)
    await presenter.navigate('saved')
    expect(output.at(-1)).toContain('saved-page')
    presenter.dispose()
  })
  it('changes native zoom and sidebar preferences, with no renderer zoom or geometry API', async () => {
    const h = nativeHarness({ getLocalAgentStatuses: vi.fn(async () => []) })
    const present = vi.fn(),
      persist = vi.fn(async () => undefined)
    const presenter = new NativePresenter(h.api, {
      preferences: { ...defaultNativePreferences },
      present,
      persist,
      openExternal: vi.fn()
    })
    await presenter.start()
    presenter.zoom('in')
    await presenter.command('toggle-sidebar')
    await Promise.resolve()
    const scene = JSON.parse(present.mock.calls.at(-1)![0])
    expect(scene.zoom).toBe(1.1)
    expect(scene.root.compactPane).toBe('detail')
    expect(scene.toolbar.items[0]).toMatchObject({ id: 'sidebar-toggle', title: 'Show Sidebar' })
    await presenter.flushPreferences()
    expect(persist).toHaveBeenLastCalledWith(
      expect.objectContaining({ zoom: 1.1, collapsed: true })
    )
    presenter.dispose()
  })
})

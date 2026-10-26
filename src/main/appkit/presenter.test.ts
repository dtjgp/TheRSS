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
    // The workspace split hosts the window sidebar so the title sits over the content column.
    expect(h.find(parsed.root, 'native-workspace')).toMatchObject({
      kind: 'split',
      windowSidebar: true
    })
    expect(navigation.rows!.map((row) => [row.id, row.title, row.symbol])).toEqual([
      ['discover', 'Discover', 'sparkle.magnifyingglass'],
      ['saved', 'Saved', 'star'],
      ['analytics', 'Data Analytics', 'chart.bar'],
      ['sources', 'Sources', 'square.stack']
    ])
    expect(parsed.toolbar.title).toBe('Discover')
    expect(parsed.toolbar.items.map((item: { id: string }) => item.id)).toEqual([
      'sidebar-toggle',
      'local-search-query',
      'undo-triage'
    ])
    expect(parsed.toolbar.items[1]).toMatchObject({
      kind: 'search',
      title: 'Search local research',
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
  it('shows the workspace popover in the scene and closes it on navigation', async () => {
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
    expect(parsed.popover).toBeUndefined()
    const picker = h.find(parsed.root, 'discover-source-picker')!
    await presenter.presentation.dispatch(JSON.stringify({ action: picker.action }))
    parsed = JSON.parse(scene)
    expect(parsed.popover).toMatchObject({ anchor: 'discover-source-picker' })
    expect(h.find(parsed.popover.root, 'discover-source-controls')).toBeDefined()
    const navigation = h.find(parsed.root, 'native-navigation')!
    await presenter.presentation.dispatch(
      JSON.stringify({ action: navigation.action, value: 'saved' })
    )
    expect(JSON.parse(scene).popover).toBeUndefined()
    await presenter.presentation.dispatch(
      JSON.stringify({ action: navigation.action, value: 'discover' })
    )
    expect(JSON.parse(scene).popover, 'Returning to Discover keeps it closed').toBeUndefined()
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
    for (const route of ['discover', 'saved', 'analytics', 'sources'] as const) {
      await presenter.navigate(route)
      const parsed = JSON.parse(scene)
      expect(headings(h.find(parsed.root, 'native-main')!)).not.toContain(parsed.toolbar.title)
    }
    presenter.dispose()
  })
  it('shows toolbar search results in the content area and ends search on clear or navigation', async () => {
    const h = nativeHarness({
      getLocalAgentStatuses: vi.fn(async () => []),
      searchLocal: vi.fn(async (query: string) => ({ query, results: [] }))
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
    const field = () =>
      JSON.parse(scene).toolbar.items.find(
        (item: { id: string }) => item.id === 'local-search-query'
      )
    const type = (value: string) =>
      presenter.presentation.dispatch(JSON.stringify({ action: field().action, value }))
    await type('edge')
    expect(JSON.parse(scene).toolbar.title).toBe('Search')
    expect(h.find(JSON.parse(scene).root, 'local-search-page')).toBeDefined()
    expect(h.find(JSON.parse(scene).root, 'discover-page')).toBeUndefined()
    expect(field().value).toBe('edge')
    await type('')
    expect(JSON.parse(scene).toolbar.title).toBe('Discover')
    expect(h.find(JSON.parse(scene).root, 'discover-page')).toBeDefined()
    await type('pruning')
    await presenter.navigate('saved')
    expect(h.find(JSON.parse(scene).root, 'local-search-page')).toBeUndefined()
    expect(JSON.parse(scene).toolbar.title).toBe('Saved')
    expect(field().value).toBe('')
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
  it('opens Settings in its own window and reloads settings saved there', async () => {
    const provider = {
      id: 'default',
      name: 'Saved provider',
      protocol: 'openai-compatible' as const,
      baseUrl: 'https://model.invalid/v1',
      model: 'research',
      hasCredential: false,
      updatedAt: '2026-10-05'
    }
    const h = nativeHarness({ getLocalAgentStatuses: vi.fn(async () => []) })
    const openSettings = vi.fn()
    let scene = ''
    const presenter = new NativePresenter(h.api, {
      preferences: { ...defaultNativePreferences },
      present: (next) => {
        scene = next
      },
      persist: vi.fn(async () => undefined),
      openExternal: vi.fn(),
      openSettings
    })
    await presenter.start()
    await presenter.command('open-settings')
    expect(openSettings).toHaveBeenCalledExactlyOnceWith()
    expect(JSON.parse(scene).toolbar.title).toBe('Discover')
    expect(h.find(JSON.parse(scene).root, 'native-navigation')?.selected).toBe('discover')
    const runner = () =>
      h
        .find(JSON.parse(scene).root, 'discover-runner')
        ?.options?.find((option) => option.id === 'model-provider')
    expect(runner()).toMatchObject({ title: 'Model provider', enabled: false })
    expect(h.find(JSON.parse(scene).root, 'discover-personalization')?.text).toContain(
      'No personal context saved'
    )
    // Another window saved a provider and personal context: the workspace reloads them.
    vi.mocked(h.api.getModelProvider).mockResolvedValue(provider)
    vi.mocked(h.api.getDiscoverPersonalizationSettings).mockResolvedValue({
      prompt: 'Edge AI',
      updatedAt: '2026-10-05'
    })
    await presenter.settingsChanged()
    await Promise.resolve()
    expect(runner()).toMatchObject({ title: 'Saved provider', enabled: true })
    expect(h.find(JSON.parse(scene).root, 'discover-personalization')?.text).toContain(
      'Personal context active'
    )
    expect(h.api.getLocalAgentStatuses).toHaveBeenCalledTimes(2)
    presenter.dispose()
  })
  it('keeps a settings reload requested during startup and applies only the latest reload', async () => {
    const provider = (name: string) => ({
      id: 'default',
      name,
      protocol: 'openai-compatible' as const,
      baseUrl: 'https://model.invalid/v1',
      model: 'research',
      hasCredential: false,
      updatedAt: '2026-10-05'
    })
    let finishDashboard!: () => void
    const h = nativeHarness({ getLocalAgentStatuses: vi.fn(async () => []) })
    const dashboard = await h.api.getDashboard()
    vi.mocked(h.api.getDashboard).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishDashboard = () => resolve(dashboard)
        })
    )
    let scene = ''
    const presenter = new NativePresenter(h.api, {
      preferences: { ...defaultNativePreferences },
      present: (next) => {
        scene = next
      },
      persist: vi.fn(async () => undefined),
      openExternal: vi.fn()
    })
    const runner = () =>
      h
        .find(JSON.parse(scene).root, 'discover-runner')
        ?.options?.find((option) => option.id === 'model-provider')?.title
    const starting = presenter.start()
    // Startup already read the old provider; a save lands before startup finishes.
    await Promise.resolve()
    vi.mocked(h.api.getModelProvider).mockResolvedValue(provider('Saved during startup'))
    await presenter.settingsChanged()
    finishDashboard()
    await starting
    await vi.waitFor(() => expect(runner()).toBe('Saved during startup'))
    // Two quick saves: the older, slower reload must not overwrite the newer one.
    let finishOld!: () => void
    vi.mocked(h.api.getModelProvider).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = () => resolve(provider('Older'))
        })
    )
    const older = presenter.settingsChanged()
    vi.mocked(h.api.getModelProvider).mockResolvedValue(provider('Newer'))
    await presenter.settingsChanged()
    finishOld()
    await older
    await Promise.resolve()
    expect(runner()).toBe('Newer')
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

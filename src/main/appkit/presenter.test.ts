import { describe, expect, it, vi } from 'vitest'
import { NativePresenter } from './presenter'
import { defaultNativePreferences } from './preferences'
import { nativeHarness } from './testSupport'

describe('AppKit application shell', () => {
  it('redraws the attention filter when the Sources route is already open', async () => {
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
    const button = h.find(JSON.parse(scene).root, 'source-health-attention')!
    presenter.receive(JSON.stringify({ action: button.action }))
    await Promise.resolve()
    await Promise.resolve()
    expect(h.find(JSON.parse(scene).root, 'sources-attention')?.checked).toBe(true)
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
    expect(scene.root.width).toBe(84)
    await presenter.flushPreferences()
    expect(persist).toHaveBeenLastCalledWith(
      expect.objectContaining({ zoom: 1.1, collapsed: true })
    )
    presenter.dispose()
  })
})

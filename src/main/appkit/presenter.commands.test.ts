import { describe, expect, it, vi } from 'vitest'
import type { AppCommand } from '../../shared/ipc'
import { NativePresenter } from './presenter'
import { defaultNativePreferences } from './preferences'
import { nativeHarness, nativeDiscoverFixture } from './testSupport'

describe('native shell commands and failures', () => {
  it('routes menu commands, modal focus and triage without using WebContents', async () => {
    let commandListener: (command: AppCommand) => void = () => undefined
    const item = { ...nativeDiscoverFixture.items[0]!, triageState: 'saved' as const }
    const h = nativeHarness({
      getLocalAgentStatuses: vi.fn(async () => [
        { runner: 'codex' as const, label: 'Codex CLI', available: true }
      ]),
      getLatestDiscover: vi.fn(async () => nativeDiscoverFixture),
      onAppCommand: (listener) => {
        commandListener = listener
        return () => undefined
      },
      setTriageState: vi.fn(async () => h.dashboard),
      saveDiscoverResult: vi.fn(async () => ({ ...h.dashboard, savedItems: [item] })),
      analyzeDiscoverResult: vi.fn(async () => ({
        id: 'analysis',
        itemId: item.id,
        providerId: 'codex',
        providerName: 'Codex',
        model: 'fixture',
        promptVersion: 'v1',
        sourceHash: 'hash',
        content: 'Analysis result',
        createdAt: 'now'
      })),
      confirmDiscardSettings: vi.fn(async () => true)
    })
    let scene = ''
    const persist = vi.fn(async () => undefined),
      openExternal = vi.fn()
    const presenter = new NativePresenter(h.api, {
      preferences: { ...defaultNativePreferences },
      present: (next) => {
        scene = next
      },
      persist,
      openExternal
    })
    await presenter.start()
    await presenter.command('save-selected')
    expect(h.api.saveDiscoverResult).toHaveBeenCalledWith('session-1', item.id)
    await presenter.command('analyze-selected')
    expect(h.api.analyzeDiscoverResult).toHaveBeenCalledWith('session-1', item.id, 'codex')
    await presenter.command('undo-triage')
    expect(h.api.setTriageState).toHaveBeenCalledWith(item.id, 'new')
    await presenter.command('open-help')
    await Promise.resolve()
    expect(JSON.parse(scene).modal).toBeDefined()
    const close = h.find(JSON.parse(scene).modal, 'modal-close')!
    await presenter.presentation.dispatch(JSON.stringify({ action: close.action }))
    await Promise.resolve()
    await presenter.command('open-local-search')
    await Promise.resolve()
    expect(JSON.parse(scene).focus).toBe('local-search-query')
    await presenter.command('show-saved')
    expect(scene).toContain('saved-page')
    await presenter.command('dismiss-selected')
    await presenter.command('open-settings')
    await presenter.command('show-discover')
    commandListener('toggle-sidebar')
    await Promise.resolve()
    expect(JSON.parse(scene).root.width).toBe(84)
    presenter.zoom('out')
    presenter.zoom('reset')
    await Promise.resolve()
    expect(JSON.parse(scene).zoom).toBe(1)
    await presenter.flushPreferences()
    expect(persist).toHaveBeenCalled()
    presenter.dispose()
    commandListener('show-saved')
  })

  it('recovers from startup failure and reports a failed preference write without losing the UI', async () => {
    vi.useFakeTimers()
    try {
      const get = vi.fn().mockRejectedValueOnce(new Error('database unavailable'))
      const h = nativeHarness({ getDashboard: get, getLocalAgentStatuses: vi.fn(async () => []) })
      let scene = ''
      const presenter = new NativePresenter(h.api, {
        preferences: { ...defaultNativePreferences },
        present: (next) => {
          scene = next
        },
        persist: vi.fn(async () => {
          throw new Error('write failure')
        }),
        openExternal: vi.fn()
      })
      await presenter.start()
      expect(scene).toContain('Workspace unavailable')
      get.mockResolvedValue(h.dashboard)
      const retry = h.find(JSON.parse(scene).root, 'native-load-retry')!
      await presenter.presentation.dispatch(JSON.stringify({ action: retry.action }))
      expect(scene).toContain('discover-page')
      presenter.zoom('in')
      await vi.advanceTimersByTimeAsync(201)
      await presenter.flushPreferences()
      expect(scene).toContain('preferences could not be saved')
      await vi.advanceTimersByTimeAsync(6001)
      expect(h.find(JSON.parse(scene).root, 'native-notice')?.text).toContain(
        'preferences could not be saved'
      )
      const dismiss = h.find(JSON.parse(scene).root, 'dismiss-notice')!
      await presenter.presentation.dispatch(JSON.stringify({ action: dismiss.action }))
      await Promise.resolve()
      expect(h.find(JSON.parse(scene).root, 'native-notice')?.text).toBe('')
      presenter.dispose()
      await presenter.start()
    } finally {
      vi.useRealTimers()
    }
  })
})

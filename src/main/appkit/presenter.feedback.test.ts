import { describe, expect, it, vi } from 'vitest'
import { NativePresenter } from './presenter'
import { defaultNativePreferences } from './preferences'
import { nativeDiscoverFixture, nativeHarness } from './testSupport'

describe('native feedback without reading disruption', () => {
  it('keeps the content structure stable while a success notice appears and expires', async () => {
    vi.useFakeTimers()
    const h = nativeHarness({
      getLocalAgentStatuses: vi.fn(async () => h.context.data.agents),
      getLatestDiscover: vi.fn(async () => nativeDiscoverFixture),
      saveDiscoverResult: vi.fn(async () => h.dashboard)
    })
    let json = ''
    const presenter = new NativePresenter(h.api, {
      preferences: { ...defaultNativePreferences },
      present: (scene) => {
        json = scene
      },
      persist: vi.fn(async () => undefined),
      openExternal: vi.fn()
    })
    try {
      await presenter.start()
      const before = JSON.parse(json)
      const mainChildren = h.find(before.root, 'native-main')!.children!.map((node) => node.id)
      await presenter.command('save-selected')
      const saved = JSON.parse(json)
      expect(h.find(saved.root, 'native-main')!.children!.map((node) => node.id)).toEqual(
        mainChildren
      )
      expect(h.find(h.find(saved.root, 'native-toolbar')!, 'native-notice')?.text).toContain(
        'Saved:'
      )
      expect(saved.announcement.message).toContain('Saved:')
      await presenter.command('toggle-sidebar')
      await Promise.resolve()
      expect(JSON.parse(json).announcement).toEqual(saved.announcement)
      await vi.advanceTimersByTimeAsync(6001)
      const expired = JSON.parse(json)
      expect(h.find(expired.root, 'native-main')!.children!.map((node) => node.id)).toEqual(
        mainChildren
      )
      expect(h.find(expired.root, 'native-notice')?.text).toBe('')
      expect(h.find(expired.root, 'undo-triage')?.enabled).toBe(true)
    } finally {
      presenter.dispose()
      vi.useRealTimers()
    }
  })

  it('keeps an operation error until dismissed and does not announce it again on layout changes', async () => {
    vi.useFakeTimers()
    const h = nativeHarness({
      getLocalAgentStatuses: vi.fn(async () => []),
      getLatestDiscover: vi.fn(async () => nativeDiscoverFixture),
      saveDiscoverResult: vi.fn(async () => {
        throw new Error('The local write failed.')
      })
    })
    let json = ''
    const presenter = new NativePresenter(h.api, {
      preferences: { ...defaultNativePreferences },
      present: (scene) => {
        json = scene
      },
      persist: vi.fn(async () => undefined),
      openExternal: vi.fn()
    })
    try {
      await presenter.start()
      await presenter.command('save-selected')
      const announcement = JSON.parse(json).announcement
      await vi.advanceTimersByTimeAsync(10_000)
      expect(h.find(JSON.parse(json).root, 'native-notice')?.text).toContain('local write failed')
      presenter.zoom('in')
      await Promise.resolve()
      expect(JSON.parse(json).announcement).toEqual(announcement)
      const dismiss = h.find(JSON.parse(json).root, 'dismiss-notice')!
      await presenter.presentation.dispatch(JSON.stringify({ action: dismiss.action }))
      await Promise.resolve()
      expect(h.find(JSON.parse(json).root, 'native-notice')?.text).toBe('')
      expect(h.find(JSON.parse(json).root, 'undo-triage')?.enabled).toBe(false)
    } finally {
      presenter.dispose()
      vi.useRealTimers()
    }
  })
})

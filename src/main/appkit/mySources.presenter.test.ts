import { describe, expect, it, vi } from 'vitest'
import type { DiscoverSourcePreference } from '../../shared/discoverSourcePreference'
import { NativePresenter } from './presenter'
import { defaultNativePreferences } from './preferences'
import { nativeHarness } from './testSupport'

const preference = (sources: DiscoverSourcePreference['sources']): DiscoverSourcePreference => ({
  sources,
  unavailable: [],
  origin: 'user',
  updatedAt: '2026-11-12T00:00:00.000Z'
})

describe('My sources sheet in the native window', () => {
  it('opens as a sheet, cancels with Escape to the entry and updates an unchanged Discover draft', async () => {
    const h = nativeHarness({
      getLocalAgentStatuses: vi.fn(async () => []),
      getDiscoverSourcePreference: vi.fn(async () => preference(['arxiv', 'github']))
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
    const scene = () => JSON.parse(json)
    const act = async (id: string, value?: unknown) => {
      const s = scene()
      const node = h.find(s.modal ?? s.root, id)
      if (!node?.action) throw new Error(`Missing ${id}`)
      await presenter.presentation.dispatch(
        JSON.stringify({ action: node.action, ...(value === undefined ? {} : { value }) })
      )
      await Promise.resolve()
    }
    await presenter.start()
    expect(h.find(scene().root, 'discover-source-picker')?.title).toBe(
      'Sources for this search · 2/22'
    )
    await act('native-navigation', 'sources')
    await act('sources-my-sources')
    expect(scene().modal?.title).toBe('Default search sources')
    expect(scene().focus).toBe('my-sources-query')
    await act('my-sources-folo:84', true)
    // Escape is the sheet's cancel (its context action): nothing is saved, focus returns.
    await presenter.presentation.dispatch(JSON.stringify({ action: scene().modal.context }))
    expect(scene().modal).toBeUndefined()
    expect(scene().focus).toBe('sources-my-sources')
    expect(h.api.saveDiscoverSourcePreference).not.toHaveBeenCalled()

    await act('sources-my-sources')
    await act('my-sources-folo:84', true)
    await act('my-sources-save')
    await vi.waitFor(() => expect(scene().modal).toBeUndefined())
    expect(h.api.saveDiscoverSourcePreference).toHaveBeenCalledWith(['arxiv', 'github', 'folo:84'])
    expect(h.find(scene().root, 'sources-my-sources')?.title).toBe('My sources · 3/22')
    await act('native-navigation', 'discover')
    expect(h.find(scene().root, 'discover-source-picker')?.title).toBe(
      'Sources for this search · 3/22'
    )
    expect(h.api.searchDiscover).toBeUndefined()
    presenter.dispose()
  })
})

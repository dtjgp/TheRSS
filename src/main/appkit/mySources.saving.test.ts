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

async function setup() {
  let settle!: { resolve: (value: DiscoverSourcePreference) => void; reject: (e: Error) => void }
  const h = nativeHarness({
    getLocalAgentStatuses: vi.fn(async () => []),
    getDiscoverSourcePreference: vi.fn(async () => preference(['arxiv'])),
    saveDiscoverSourcePreference: vi.fn(
      () =>
        new Promise<DiscoverSourcePreference>((resolve, reject) => {
          settle = { resolve, reject }
        })
    )
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
  const dispatch = async (action: string, value?: unknown) => {
    await presenter.presentation.dispatch(
      JSON.stringify({ action, ...(value === undefined ? {} : { value }) })
    )
    await Promise.resolve()
  }
  const act = async (id: string, value?: unknown) => {
    const s = scene()
    const node = h.find(s.modal ?? s.root, id)
    if (!node?.action) throw new Error(`Missing ${id}`)
    await dispatch(node.action, value)
  }
  await presenter.start()
  await act('native-navigation', 'sources')
  await act('sources-my-sources')
  await act('my-sources-github', true)
  const saving = act('my-sources-save')
  await vi.waitFor(() => expect(h.api.saveDiscoverSourcePreference).toHaveBeenCalled())
  // Escape (the sheet's cancel) and navigation both try to end the sheet while it saves.
  await dispatch(scene().modal.context)
  await dispatch(h.find(scene().root, 'native-navigation')!.action!, 'discover')
  return { h, presenter, scene, act, dispatch, saving, settle: () => settle }
}

describe('My sources sheet while saving', () => {
  it('stays open until the save succeeds, then closes and reports it', async () => {
    const f = await setup()
    expect(f.scene().modal?.title).toBe('Default search sources')
    expect(f.h.find(f.scene().modal, 'my-sources-save')?.title).toBe('Saving…')
    expect(f.h.find(f.scene().modal, 'my-sources-cancel')?.enabled).toBe(false)
    expect(f.h.find(f.scene().root, 'sources-my-sources')).toBeDefined()
    f.settle().resolve(preference(['arxiv', 'github']))
    await f.saving
    await vi.waitFor(() => expect(f.scene().modal).toBeUndefined())
    expect(f.scene().focus).toBe('sources-my-sources')
    expect(JSON.stringify(f.scene())).toContain(
      'Default sources saved. New Discover searches start with them.'
    )
    expect(f.h.find(f.scene().root, 'sources-my-sources')?.title).toBe('My sources · 2/22')
    f.presenter.dispose()
  })

  it('stays open after a failed save, keeps the draft and allows Cancel and Escape again', async () => {
    const f = await setup()
    f.settle().reject(new Error('disk full'))
    await f.saving
    await vi.waitFor(() =>
      expect(f.h.find(f.scene().modal, 'my-sources-error')?.text).toBe(
        'The default sources could not be saved. Your choice is kept; try again.'
      )
    )
    expect(f.h.find(f.scene().modal, 'my-sources-count')?.text).toBe('2 of 22 selected')
    expect(f.h.find(f.scene().modal, 'my-sources-cancel')?.enabled).toBe(true)
    await f.dispatch(f.scene().modal.context)
    expect(f.scene().modal).toBeUndefined()
    expect(f.scene().focus).toBe('sources-my-sources')
    f.presenter.dispose()
  })

  it('keeps help, local search and another sheet from replacing a saving sheet', async () => {
    for (const outcome of ['success', 'failure'] as const) {
      const f = await setup()
      await f.presenter.command('open-help')
      await f.presenter.command('open-local-search')
      const other = { title: 'Other sheet', render: () => [], dismissed: vi.fn() }
      ;(
        f.presenter as unknown as { context: { openSheet(sheet: unknown): void } }
      ).context.openSheet(other)
      await Promise.resolve()
      expect(f.scene().modal?.title).toBe('Default search sources')
      expect(f.h.find(f.scene().root, 'local-search-page')).toBeUndefined()
      expect(other.dismissed).not.toHaveBeenCalled()
      if (outcome === 'success') {
        f.settle().resolve(preference(['arxiv', 'github']))
        await f.saving
        await vi.waitFor(() => expect(f.scene().modal).toBeUndefined())
      } else {
        f.settle().reject(new Error('disk full'))
        await f.saving
        await vi.waitFor(() => expect(f.h.find(f.scene().modal, 'my-sources-error')).toBeDefined())
        // After the save ends, the sheet is an ordinary sheet again: Help may replace it.
        await f.presenter.command('open-help')
        expect(f.scene().modal?.title).toBe('TheRSS Help')
      }
      f.presenter.dispose()
    }
  })
})

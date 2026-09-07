import { describe, expect, it, vi } from 'vitest'
import type { LocalResearchRecord } from '../../shared/localResearch'
import { NativePresenter } from './presenter'
import { defaultNativePreferences } from './preferences'
import { nativeDiscoverFixture, nativeHarness } from './testSupport'

function setup(resolve: () => Promise<LocalResearchRecord | null>) {
  const h = nativeHarness({
    getLocalAgentStatuses: vi.fn(async () => h.context.data.agents),
    getLatestDiscover: vi.fn(async () => nativeDiscoverFixture),
    getLocalResearch: vi.fn(resolve),
    searchDiscover: vi.fn(),
    searchLocal: vi.fn(async () => ({
      query: 'edge',
      results: [
        {
          id: 'historical:arxiv:29',
          kind: 'discover' as const,
          itemId: 'arxiv:29',
          title: 'Historical paper',
          detail: 'Original search context',
          url: 'https://arxiv.org/abs/1',
          source: 'arxiv' as const,
          createdAt: '2026-08-01',
          target: { kind: 'discover' as const, sessionId: 'historical', itemId: 'arxiv:29' }
        }
      ]
    }))
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
  const act = async (id: string, value?: string, activate = false) => {
    const s = scene(),
      node = h.find(s.modal ?? s.root, id)!
    const action = activate ? node?.activate : node?.action
    if (!action) throw new Error(`Missing ${id}`)
    await presenter.presentation.dispatch(
      JSON.stringify({ action, ...(value === undefined ? {} : { value }) })
    )
    await Promise.resolve()
  }
  const search = async () => {
    await presenter.command('open-local-search')
    await Promise.resolve()
    await act('local-search-query', 'edge')
    await act('local-search-query', undefined, true)
  }
  return { h, presenter, scene, act, search }
}

describe('in-app local research navigation', () => {
  it('keeps the active historical search context intact until its run finishes', async () => {
    const historical = { ...nativeDiscoverFixture, id: 'historical', intent: 'Historical question' }
    const f = setup(async () => ({ kind: 'discover', snapshot: historical, itemId: 'arxiv:29' }))
    let finish!: (value: typeof historical) => void
    vi.mocked(f.h.api.searchDiscover).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    try {
      await f.presenter.start()
      await f.search()
      await f.act('local-search-results', 'discover:historical:arxiv:29', true)
      const work = f.act('discover-search')
      await Promise.resolve()
      expect(f.h.find(f.scene().root, 'return-local-search')?.enabled).toBe(false)
      await f.presenter.command('open-local-search')
      await Promise.resolve()
      expect(f.scene().modal).toBeUndefined()
      expect(f.h.find(f.scene().root, 'discover-query')?.value).toBe('Historical question')
      finish(historical)
      await work
      expect(f.h.find(f.scene().root, 'return-local-search')?.enabled).toBe(true)
      await f.act('return-local-search')
      expect(f.scene().modal).toBeDefined()
    } finally {
      f.presenter.dispose()
    }
  })
  it('opens a historical result beyond the first page and returns without losing an unsubmitted draft', async () => {
    const historical = { ...nativeDiscoverFixture, id: 'historical', intent: 'Historical question' }
    const f = setup(async () => ({ kind: 'discover', snapshot: historical, itemId: 'arxiv:29' }))
    try {
      await f.presenter.start()
      await f.act('discover-query', 'My unsubmitted question')
      await f.search()
      await f.act('local-search-results', 'discover:historical:arxiv:29', true)
      expect(f.scene().modal).toBeUndefined()
      expect(f.h.find(f.scene().root, 'discover-results')?.selected).toBe('arxiv:29')
      expect(f.h.find(f.scene().root, 'discover-reading-title')?.text).toBe('Paper 29')
      expect(f.h.api.searchDiscover).not.toHaveBeenCalled()
      await f.act('return-local-search')
      expect(f.h.find(f.scene().modal, 'local-search-query')?.value).toBe('edge')
      await f.act('modal-close')
      expect(f.h.find(f.scene().root, 'discover-query')?.value).toBe('My unsubmitted question')
      expect(f.h.find(f.scene().root, 'discover-results')?.selected).toBe('arxiv:0')
    } finally {
      f.presenter.dispose()
    }
  })

  it('keeps missing results recoverable in the search sheet', async () => {
    const f = setup(async () => null)
    try {
      await f.presenter.start()
      await f.search()
      await f.act('local-search-results', 'discover:historical:arxiv:29', true)
      expect(f.h.find(f.scene().modal, 'modal-message')?.text).toContain('no longer available')
      expect(f.h.find(f.scene().modal, 'local-search-query')?.value).toBe('edge')
    } finally {
      f.presenter.dispose()
    }
  })

  it('does not navigate when the user closes search before a lookup completes', async () => {
    let finish!: (record: LocalResearchRecord | null) => void
    const f = setup(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    try {
      await f.presenter.start()
      await f.search()
      const pending = f.act('local-search-results', 'discover:historical:arxiv:29', true)
      await Promise.resolve()
      await f.act('modal-close')
      finish({
        kind: 'discover',
        snapshot: { ...nativeDiscoverFixture, id: 'historical' },
        itemId: 'arxiv:29'
      })
      await pending
      expect(f.scene().modal).toBeUndefined()
      expect(f.h.find(f.scene().root, 'discover-results')?.selected).toBe('arxiv:0')
    } finally {
      f.presenter.dispose()
    }
  })
})

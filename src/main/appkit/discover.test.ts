import { describe, expect, it, vi } from 'vitest'
import type { DiscoverSnapshot } from '../../shared/discover'
import { DiscoverScreen } from './discover'
import { TriageHistory } from './reading'
import { nativeHarness, nativeDiscoverFixture } from './testSupport'

describe('AppKit Discover', () => {
  it('uses the persisted item state for Saved markers beyond the bounded dashboard list', async () => {
    const snapshot = {
      ...nativeDiscoverFixture,
      items: nativeDiscoverFixture.items.map((item) => ({ ...item, saved: true }))
    }
    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => snapshot) })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    expect(h.find(h.render(screen), 'discover-results')?.rows?.[0]?.subtitle).toContain(' · Saved')
  })
  it('restores the persisted session, pages 24 items and opens all source/provenance details', async () => {
    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => nativeDiscoverFixture) })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    expect(h.find(h.render(screen), 'discover-results')?.rows).toHaveLength(24)
    await h.act(screen, 'discover-more')
    expect(h.find(h.render(screen), 'discover-results')?.rows).toHaveLength(30)
    await h.act(screen, 'discover-details')
    expect(h.context.showDocument).toHaveBeenCalledWith(
      'Search details',
      expect.stringContaining('Fixture failure')
    )
    expect(h.context.showDocument).toHaveBeenCalledWith(
      'Search details',
      expect.stringContaining('semantic-discover-v2')
    )
  })

  it('keeps the old snapshot when a new run fails and retries only unsuccessful sources', async () => {
    const search = vi.fn().mockRejectedValue(new Error('Fixture network failure'))
    const retry = vi.fn(async () => ({ ...nativeDiscoverFixture, status: 'completed' as const }))
    const h = nativeHarness({
      getLatestDiscover: vi.fn(async () => nativeDiscoverFixture),
      searchDiscover: search,
      retryDiscover: retry
    })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    await h.act(screen, 'discover-query', 'A new query')
    await h.act(screen, 'discover-search')
    expect(h.find(h.render(screen), 'discover-results')?.rows?.[0]?.title).toBe('Paper 0')
    await h.act(screen, 'discover-retry')
    expect(retry).toHaveBeenCalledWith('session-1', ['arxiv'], expect.any(String))
  })

  it('cancels only its run and keeps Canceling until the actual search settles', async () => {
    let finish!: (snapshot: DiscoverSnapshot) => void
    const search = vi.fn<import('../../shared/api').TheRSSApi['searchDiscover']>(
      () =>
        new Promise<DiscoverSnapshot>((resolve) => {
          finish = resolve
        })
    )
    const cancel = vi.fn(async (runId: string) => ({ runId, canceled: true }))
    const h = nativeHarness({
      getLatestDiscover: vi.fn(async () => nativeDiscoverFixture),
      searchDiscover: search,
      cancelDiscover: cancel
    })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    const running = h.act(screen, 'discover-search')
    await h.act(screen, 'discover-cancel')
    expect(cancel).toHaveBeenCalledWith(search.mock.calls[0]?.[1])
    expect(h.find(h.render(screen), 'discover-cancel')?.title).toBe('Canceling…')
    expect(h.find(h.render(screen), 'discover-search')?.enabled).toBe(false)
    finish({ ...nativeDiscoverFixture, status: 'canceled' })
    await running
    expect(h.find(h.render(screen), 'discover-search')?.enabled).toBe(true)
  })
})

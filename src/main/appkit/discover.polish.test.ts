import { describe, expect, it, vi } from 'vitest'
import { SOURCE_GROUPS } from '../../shared/sourceGroups'
import { DiscoverScreen } from './discover'
import { TriageHistory } from './reading'
import { nativeHarness, nativeDiscoverFixture } from './testSupport'

describe('native search workspace hierarchy', () => {
  it('restores results compactly, reopens the exact question with native focus and preserves an unsubmitted draft', async () => {
    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => nativeDiscoverFixture) })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    expect(h.find(h.render(screen), 'discover-query')).toBeUndefined()
    expect(h.find(h.render(screen), 'discover-query-summary')?.text).toBe(
      nativeDiscoverFixture.intent
    )
    await h.act(screen, 'discover-edit-search')
    expect(h.find(h.render(screen), 'discover-query')?.value).toBe(nativeDiscoverFixture.intent)
    expect(h.context.focus).toHaveBeenCalledWith('discover-query')
    await h.act(screen, 'discover-query', 'A different draft')
    await h.act(screen, 'discover-done-editing')
    expect(h.find(h.render(screen), 'discover-query-summary')?.text).toBe('A different draft')
    expect(h.find(h.render(screen), 'discover-draft-status')?.text).toContain(
      nativeDiscoverFixture.intent
    )
    expect(h.find(h.render(screen), 'discover-results')?.rows).toHaveLength(24)
    await h.act(screen, 'discover-edit-search')
    expect(h.find(h.render(screen), 'discover-query')?.value).toBe('A different draft')
  })

  it('collapses completed results but leaves empty, canceled and failed runs editable', async () => {
    const search = vi.fn(async () => nativeDiscoverFixture)
    const h = nativeHarness({ searchDiscover: search })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    await h.act(screen, 'discover-runner', 'codex')
    await h.act(screen, 'discover-query', 'edge intelligence')
    await h.act(screen, 'discover-search')
    expect(h.find(h.render(screen), 'discover-query')).toBeUndefined()
    for (const status of ['canceled', 'failed', 'no_results'] as const) {
      if (!h.find(h.render(screen), 'discover-query')) await h.act(screen, 'discover-edit-search')
      search.mockResolvedValueOnce({ ...nativeDiscoverFixture, status, items: [] })
      await h.act(screen, 'discover-search')
      expect(h.find(h.render(screen), 'discover-query')).toBeDefined()
    }
    screen.dispose()
  })

  it('selects and clears one complete group while preserving every other source choice', async () => {
    const h = nativeHarness()
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    await h.act(screen, 'discover-source-picker')
    for (const group of SOURCE_GROUPS) {
      expect(h.find(h.render(screen), `discover-group-${group.id}-title`)?.text).toContain(
        group.title
      )
    }
    await h.act(screen, 'discover-group-code-toggle')
    expect(h.find(h.render(screen), 'discover-source-github')?.checked).toBe(false)
    expect(h.find(h.render(screen), 'discover-source-folo:64')?.checked).toBe(false)
    expect(h.find(h.render(screen), 'discover-source-arxiv')?.checked).toBe(true)
    expect(h.find(h.render(screen), 'discover-source-picker')?.title).toBe('Sources (20/22)')
    await h.act(screen, 'discover-group-code-toggle')
    expect(h.find(h.render(screen), 'discover-source-picker')?.title).toBe('Sources (22/22)')
    screen.dispose()
  })
})

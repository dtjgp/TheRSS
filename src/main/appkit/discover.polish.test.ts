import { describe, expect, it, vi } from 'vitest'
import { SOURCE_GROUPS } from '../../shared/sourceGroups'
import { DiscoverScreen } from './discover'
import { TriageHistory } from './reading'
import { nativeHarness, nativeDiscoverFixture } from './testSupport'

describe('native search workspace hierarchy', () => {
  it('locates source choices without changing the research question or hidden selections', async () => {
    const h = nativeHarness()
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    await h.act(screen, 'discover-query', 'Keep my research question')
    await h.act(screen, 'discover-source-picker')
    await h.act(screen, 'discover-source-query', 'GitHub')
    expect(h.find(h.render(screen), 'discover-source-github')).toBeDefined()
    expect(h.find(h.render(screen), 'discover-source-arxiv')).toBeUndefined()
    await h.act(screen, 'discover-source-github', false)
    await h.act(screen, 'discover-source-query', '')
    expect(h.find(h.render(screen), 'discover-source-arxiv')?.checked).toBe(true)
    expect(h.find(h.render(screen), 'discover-source-github')?.checked).toBe(false)
    expect(h.find(h.render(screen), 'discover-query')?.value).toBe('Keep my research question')
    screen.dispose()
  })
  it('restores an editable query and preserves an unsubmitted draft without an editing mode', async () => {
    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => nativeDiscoverFixture) })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    expect(h.find(h.render(screen), 'discover-query')?.value).toBe(nativeDiscoverFixture.intent)
    await h.act(screen, 'discover-query', 'A different draft')
    expect(h.find(h.render(screen), 'discover-query')?.value).toBe('A different draft')
    expect(h.find(h.render(screen), 'discover-draft-status')?.text).toContain(
      nativeDiscoverFixture.intent
    )
    expect(h.find(h.render(screen), 'discover-results')?.rows).toHaveLength(
      nativeDiscoverFixture.items.length
    )
    expect(h.find(h.render(screen), 'discover-edit-search')).toBeUndefined()
    await h.act(screen, 'discover-query', nativeDiscoverFixture.intent)
    h.context.data.agents = [
      ...h.context.data.agents,
      { runner: 'claude', label: 'Claude Code', available: true }
    ]
    await h.act(screen, 'discover-runner', 'claude')
    expect(h.find(h.render(screen), 'discover-draft-status')).toBeDefined()
    screen.dispose()
  })

  it('keeps completed, canceled, empty and failed searches directly editable', async () => {
    const search = vi.fn(async () => nativeDiscoverFixture)
    const h = nativeHarness({ searchDiscover: search })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    await h.act(screen, 'discover-runner', 'codex')
    await h.act(screen, 'discover-query', 'edge intelligence')
    await h.act(screen, 'discover-search')
    expect(h.find(h.render(screen), 'discover-query')?.enabled).toBe(true)
    for (const status of ['canceled', 'failed', 'no_results'] as const) {
      search.mockResolvedValueOnce({ ...nativeDiscoverFixture, status, items: [] })
      await h.act(screen, 'discover-search')
      expect(h.find(h.render(screen), 'discover-query')?.value).toBe('edge intelligence')
      expect(h.find(h.render(screen), 'discover-query')?.enabled).toBe(true)
    }
    screen.dispose()
  })

  // 2026-11-12 My sources contract: group toggles are replaced by Select/Clear shown, which act
  // only on the sources a find shows; changes apply with Apply to this search.
  it('clears the shown group only while preserving every other source choice', async () => {
    const h = nativeHarness()
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    await h.act(screen, 'discover-source-picker')
    for (const group of SOURCE_GROUPS) {
      expect(h.find(h.render(screen), `discover-source-group-${group.id}-title`)?.text).toBe(
        `${group.title} · ${group.sources.length}/${group.sources.length} selected`
      )
    }
    await h.act(screen, 'discover-source-query', 'Code & models')
    await h.act(screen, 'discover-source-clear-shown')
    await h.act(screen, 'discover-source-query', '')
    expect(h.find(h.render(screen), 'discover-source-github')?.checked).toBe(false)
    expect(h.find(h.render(screen), 'discover-source-folo:64')?.checked).toBe(false)
    expect(h.find(h.render(screen), 'discover-source-arxiv')?.checked).toBe(true)
    expect(h.find(h.render(screen), 'discover-source-group-code-title')?.text).toBe(
      'Code & models · 0/2 selected'
    )
    await h.act(screen, 'discover-source-apply')
    expect(h.find(h.render(screen), 'discover-source-picker')?.title).toBe(
      'Sources for this search · 20/22'
    )
    await h.act(screen, 'discover-source-picker')
    await h.act(screen, 'discover-source-only-selected', true)
    await h.act(screen, 'discover-source-select-shown')
    expect(h.find(h.render(screen), 'discover-source-github')).toBeUndefined()
    await h.act(screen, 'discover-source-only-selected', false)
    await h.act(screen, 'discover-source-select-shown')
    await h.act(screen, 'discover-source-apply')
    expect(h.find(h.render(screen), 'discover-source-picker')?.title).toBe(
      'Sources for this search · 22/22'
    )
    screen.dispose()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { DiscoverScreen } from './discover'
import { TriageHistory } from './reading'
import { nativeDiscoverFixture, nativeHarness } from './testSupport'

describe('native search readiness and recovery', () => {
  it('explains unavailable execution and opens settings without submitting the question', async () => {
    const h = nativeHarness({ searchDiscover: vi.fn() })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    await h.act(screen, 'discover-query', 'Model compression')
    expect(h.find(h.render(screen), 'discover-search')?.enabled).toBe(false)
    expect(h.find(h.render(screen), 'discover-readiness')?.text).toContain('not configured')
    await h.act(screen, 'discover-configure-runner')
    expect(h.context.openSettings).toHaveBeenCalledWith('provider')
    expect(h.context.navigate).not.toHaveBeenCalled()
    expect(h.api.searchDiscover).not.toHaveBeenCalled()
    await h.act(screen, 'discover-runner', 'codex')
    expect(h.find(h.render(screen), 'discover-search')?.enabled).toBe(true)
    expect(h.find(h.render(screen), 'discover-readiness')).toBeUndefined()
    screen.dispose()
  })

  it('distinguishes an empty question from zero selected sources and restores the picker', async () => {
    const h = nativeHarness({ searchDiscover: vi.fn() })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    await h.act(screen, 'discover-runner', 'codex')
    // Before the first search the empty state explains what to do (acceptance finding A6).
    expect(h.find(h.render(screen), 'discover-readiness')).toBeUndefined()
    expect(h.find(h.render(screen), 'discover-empty-title')?.text).toBe('Start a research search')
    // With a retained session, an empty question is still named.
    const withSession = nativeHarness({
      getLatestDiscover: vi.fn(async () => nativeDiscoverFixture)
    })
    const retained = new DiscoverScreen(withSession.context, new TriageHistory(withSession.context))
    await retained.load()
    await withSession.act(retained, 'discover-runner', 'codex')
    await withSession.act(retained, 'discover-query', '')
    expect(withSession.find(withSession.render(retained), 'discover-readiness')?.text).toContain(
      'Enter a research question'
    )
    retained.dispose()
    await h.act(screen, 'discover-query', 'Efficient inference')
    await h.act(screen, 'discover-source-picker')
    await h.act(screen, 'discover-clear-sources')
    await h.act(screen, 'discover-source-picker')
    expect(h.find(h.render(screen), 'discover-readiness')?.text).toContain('at least one source')
    expect(h.find(h.render(screen), 'discover-select-sources')).toBeUndefined()
    await h.act(screen, 'discover-source-picker')
    expect(h.find(h.render(screen), 'discover-source-controls')).toBeDefined()
    expect(h.api.searchDiscover).not.toHaveBeenCalled()
    screen.dispose()
  })
})

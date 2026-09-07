import { describe, expect, it } from 'vitest'
import { DiscoverScreen } from './discover'
import { SavedScreen } from './saved'
import { TriageHistory } from './reading'
import { nativeDiscoverFixture, nativeHarness } from './testSupport'

describe('compact reading without stacked panes', () => {
  it('opens an explicitly selected result, keeps its identity and returns to the retained list', async () => {
    const h = nativeHarness({ getLatestDiscover: async () => nativeDiscoverFixture })
    h.context.compact = () => true
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    expect(h.find(h.render(screen), 'discover-workspace')?.compactPane).toBe('list')
    const list = h.find(h.render(screen), 'discover-results')!
    await h.context.presentation.dispatch(
      JSON.stringify({ action: list.activate, value: 'arxiv:3' })
    )
    const reading = h.render(screen)
    expect(h.find(reading, 'discover-workspace')?.compactPane).toBe('detail')
    expect(h.find(reading, 'discover-query-summary')).toBeUndefined()
    expect(h.find(reading, 'discover-results')?.selected).toBe('arxiv:3')
    expect(h.find(reading, 'discover-reading-title')?.text).toBe('Paper 3')
    await h.act(screen, 'discover-back-to-results')
    expect(h.find(h.render(screen), 'discover-workspace')?.compactPane).toBe('list')
    expect(h.find(h.render(screen), 'discover-results')?.selected).toBe('arxiv:3')
    expect(h.context.focus).toHaveBeenLastCalledWith('discover-results')
    h.context.compact = () => false
    expect(h.find(h.render(screen), 'discover-workspace')?.compactPane).toBeUndefined()
    screen.dispose()
  })

  it('recovers an empty Saved filter without changing triage or making a network request', async () => {
    const h = nativeHarness()
    h.context.data.dashboard = {
      ...h.dashboard,
      savedItems: [{ ...nativeDiscoverFixture.items[0]!, triageState: 'saved' }]
    }
    const screen = new SavedScreen(h.context, new TriageHistory(h.context))
    await h.act(screen, 'saved-source-filter', 'github')
    expect(h.find(h.render(screen), 'saved-empty-message')?.text).toContain(
      'No saved items from this source'
    )
    await h.act(screen, 'saved-reset-filter')
    expect(h.find(h.render(screen), 'saved-items')?.rows).toHaveLength(1)
    h.context.data.dashboard = h.dashboard
    await h.act(screen, 'saved-open-discover')
    expect(h.context.navigate).toHaveBeenCalledWith('discover')
  })
})

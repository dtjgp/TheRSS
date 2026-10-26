import { describe, expect, it, vi } from 'vitest'
import { NativePresentation, type NativeNode } from './presentation'
import { DiscoverScreen } from './discover'
import { SavedScreen } from './saved'
import { TriageHistory } from './reading'
import { nativeDiscoverFixture, nativeHarness } from './testSupport'

describe('macOS system text styles', () => {
  it('accepts text styles and keeps point sizes for reading text and symbols only', () => {
    const view = new NativePresentation()
    const label = {
      id: 'note',
      kind: 'label',
      text: 'Note',
      textStyle: 'subheadline'
    } as NativeNode
    expect(JSON.parse(view.finish(label)).root.textStyle).toBe('subheadline')
    const reading = { id: 'summary', kind: 'text', text: 'Long reading', size: 14 } as NativeNode
    expect(JSON.parse(view.finish(reading)).root.size).toBe(14)
    for (const invalid of [
      { ...label, textStyle: 'huge' },
      { id: 'note', kind: 'label', text: 'Note', size: 12 },
      { id: 'go', kind: 'button', title: 'Go', size: 15 }
    ])
      expect(() => view.finish(invalid as NativeNode)).toThrow()
  })

  it('maps Discover, empty states and the reader onto system styles; the summary stays 14 pt', async () => {
    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => nativeDiscoverFixture) })
    const discover = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await discover.load()
    const view = h.render(discover)
    expect(h.find(view, 'discover-query-label')).toMatchObject({
      textStyle: 'callout',
      weight: 'bold'
    })
    expect(h.find(view, 'discover-personalization')).toMatchObject({ textStyle: 'subheadline' })
    expect(h.find(view, 'discover-personalization')?.size).toBeUndefined()
    // The user's F13 decision: reading text keeps 14 pt.
    expect(h.find(view, 'discover-summary')).toMatchObject({ kind: 'text', size: 14 })
    expect(h.find(view, 'discover-evidence')).toMatchObject({ textStyle: 'callout' })
    discover.dispose()
    const saved = new SavedScreen(h.context, new TriageHistory(h.context))
    expect(h.find(h.render(saved), 'saved-empty-title')).toMatchObject({
      textStyle: 'title2',
      weight: 'bold'
    })
  })
})

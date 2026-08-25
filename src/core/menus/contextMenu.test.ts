import { describe, expect, it } from 'vitest'
import type { ContextMenuTarget } from '../../shared/contextMenu'
import { buildContextMenuTemplate, buildCopyPayload } from './contextMenu'

function target(overrides: Partial<ContextMenuTarget> = {}): ContextMenuTarget {
  return {
    kind: 'discover-result',
    itemId: 'arxiv:2501.00001v1',
    sessionId: 'session-1',
    title: 'Structured Pruning for Edge Inference',
    url: 'https://arxiv.org/abs/2501.00001v1',
    sourceLabel: 'arXiv',
    publishedAt: '2026-02-14T09:30:00.000Z',
    isSaved: false,
    canAnalyze: true,
    canPromote: true,
    ...overrides
  }
}

function actionsOf(entries: ReturnType<typeof buildContextMenuTemplate>): readonly string[] {
  return entries.flatMap((entry) => (entry.type === 'item' ? [entry.action] : []))
}

function labelFor(
  entries: ReturnType<typeof buildContextMenuTemplate>,
  action: string
): string | undefined {
  const found = entries.find((entry) => entry.type === 'item' && entry.action === action)
  return found?.type === 'item' ? found.label : undefined
}

describe('buildContextMenuTemplate', () => {
  it('offers the full action set for a promotable, analysable arXiv paper', () => {
    expect(actionsOf(buildContextMenuTemplate(target()))).toEqual([
      'open-external',
      'copy-link',
      'copy-title',
      'copy-citation',
      'save',
      'analyze',
      'promote'
    ])
  })

  it('labels the shelf entry by the item current state', () => {
    expect(labelFor(buildContextMenuTemplate(target({ isSaved: false })), 'save')).toBe(
      'Save to Saved'
    )
    expect(labelFor(buildContextMenuTemplate(target({ isSaved: true })), 'unsave')).toBe(
      'Remove from Saved'
    )
    expect(actionsOf(buildContextMenuTemplate(target({ isSaved: true })))).toContain('unsave')
    expect(actionsOf(buildContextMenuTemplate(target({ isSaved: true })))).not.toContain('save')
  })

  it('hides Analyze and Promote when the item does not support them', () => {
    const actions = actionsOf(
      buildContextMenuTemplate(target({ canAnalyze: false, canPromote: false }))
    )
    expect(actions).not.toContain('analyze')
    expect(actions).not.toContain('promote')
    expect(actions).toContain('save')
  })

  it.each([
    ['an http url', 'http://arxiv.org/abs/1'],
    ['a file url', 'file:///etc/passwd'],
    ['a javascript url', 'javascript:alert(1)'],
    ['an empty url', '']
  ])('drops the open and copy-link entries for %s', (_label, url) => {
    const actions = actionsOf(buildContextMenuTemplate(target({ url })))
    expect(actions).not.toContain('open-external')
    expect(actions).not.toContain('copy-link')
    expect(actions).toContain('copy-title')
  })

  it('never emits a leading, trailing, or doubled separator', () => {
    const shapes: Partial<ContextMenuTarget>[] = [
      {},
      { url: '' },
      { canAnalyze: false, canPromote: false },
      { url: '', canAnalyze: false, canPromote: false },
      { isSaved: true, canPromote: false }
    ]
    for (const shape of shapes) {
      const entries = buildContextMenuTemplate(target(shape))
      expect(entries[0]?.type).toBe('item')
      expect(entries.at(-1)?.type).toBe('item')
      for (let index = 1; index < entries.length; index += 1) {
        const doubled =
          entries[index]?.type === 'separator' && entries[index - 1]?.type === 'separator'
        expect(doubled).toBe(false)
      }
    }
  })

  it('separates navigation, copy, and item actions', () => {
    const entries = buildContextMenuTemplate(target())
    expect(entries.filter((entry) => entry.type === 'separator')).toHaveLength(2)
  })
})

describe('buildCopyPayload', () => {
  it('copies the exact link', () => {
    expect(buildCopyPayload(target(), 'copy-link')).toBe('https://arxiv.org/abs/2501.00001v1')
  })

  it('copies the bare title', () => {
    expect(buildCopyPayload(target(), 'copy-title')).toBe('Structured Pruning for Edge Inference')
  })

  it('builds a deterministic citation from discovery metadata only', () => {
    expect(buildCopyPayload(target(), 'copy-citation')).toBe(
      'Structured Pruning for Edge Inference. arXiv. 2026-02-14. https://arxiv.org/abs/2501.00001v1'
    )
  })

  it('omits an unparseable date rather than emitting Invalid Date', () => {
    expect(buildCopyPayload(target({ publishedAt: 'not-a-date' }), 'copy-citation')).toBe(
      'Structured Pruning for Edge Inference. arXiv. https://arxiv.org/abs/2501.00001v1'
    )
  })

  it('omits an unsafe url from the citation', () => {
    expect(buildCopyPayload(target({ url: 'javascript:alert(1)' }), 'copy-citation')).toBe(
      'Structured Pruning for Edge Inference. arXiv. 2026-02-14'
    )
    expect(buildCopyPayload(target({ url: 'javascript:alert(1)' }), 'copy-link')).toBeNull()
  })

  it('returns null for actions that copy nothing', () => {
    expect(buildCopyPayload(target(), 'save')).toBeNull()
    expect(buildCopyPayload(target(), 'analyze')).toBeNull()
    expect(buildCopyPayload(target(), 'open-external')).toBeNull()
  })
})

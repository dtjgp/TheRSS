import { describe, expect, it, vi } from 'vitest'
import { nativeHarness } from './testSupport'
import { WikiStatus } from './wikiStatus'
import type { LlmWikiLibraryStatus } from '../../shared/llmWikiLibrary'

const paper = { source: 'arxiv', kind: 'paper', url: 'https://arxiv.org/abs/2610.11302v1' }
const found: LlmWikiLibraryStatus = {
  arxivId: '2610.11302',
  status: 'recorded',
  checkedAt: '2026-10-28T12:00:00Z',
  recordPath: 'raw/paper_records/Test.md',
  notePath: 'Literature/Paper_Notes/L2_Structured/Test/Test.md',
  level: 'L2',
  readStatus: 'unread',
  reason: null
}
describe('native llm-wiki status', () => {
  it('shows bounded local status, opens through the typed API, and rechecks on request', async () => {
    const get = vi.fn(async () => found),
      open = vi.fn(async () => ({ opened: true as const }))
    const h = nativeHarness({ getLlmWikiStatus: get, openLlmWikiNote: open })
    const widget = new WikiStatus(h.context, 'discover')
    widget.select(paper)
    await vi.waitFor(() => expect(JSON.stringify(h.render(widget))).toContain('In llm-wiki'))
    expect(JSON.stringify(h.render(widget))).toContain('L2')
    await h.act(widget, 'discover-wiki-open')
    expect(open).toHaveBeenCalledWith('2610.11302')
    await h.act(widget, 'discover-wiki-refresh')
    expect(get).toHaveBeenLastCalledWith({ arxivId: '2610.11302', refresh: true })
  })
  it('rejects stale responses after selection changes and hides non-paper states', async () => {
    let finish!: (status: LlmWikiLibraryStatus) => void
    const h = nativeHarness({
      getLlmWikiStatus: vi.fn(
        () =>
          new Promise<LlmWikiLibraryStatus>((resolve) => {
            finish = resolve
          })
      )
    })
    const widget = new WikiStatus(h.context, 'saved')
    widget.select(paper)
    expect(JSON.stringify(h.render(widget))).toContain('Checking llm-wiki')
    widget.select({ ...paper, source: 'github', kind: 'repository' })
    finish(found)
    await Promise.resolve()
    expect(h.render(widget).children).toHaveLength(0)
    widget.dispose()
  })
  it.each(['not-found', 'note-missing', 'ambiguous', 'unavailable'] as const)(
    'shows %s without an unsafe open action',
    async (status) => {
      const h = nativeHarness({
        getLlmWikiStatus: vi.fn(async () => ({ ...found, status, reason: 'Bounded reason' }))
      })
      const widget = new WikiStatus(h.context, 'saved')
      widget.select(paper)
      await vi.waitFor(() => expect(JSON.stringify(h.render(widget))).toContain('Bounded reason'))
      expect(h.find(h.render(widget), 'saved-wiki-open')).toBeUndefined()
    }
  )
  it('rechecks only when it shows the written arXiv ID', async () => {
    const get = vi.fn(async () => found)
    const h = nativeHarness({ getLlmWikiStatus: get })
    const widget = new WikiStatus(h.context, 'discover')
    await widget.refreshIfShowing('2610.11302')
    expect(get).not.toHaveBeenCalled()
    widget.select(paper)
    await vi.waitFor(() => expect(get).toHaveBeenCalledOnce())
    await widget.refreshIfShowing('2609.00001')
    expect(get).toHaveBeenCalledOnce()
    await widget.refreshIfShowing('2610.11302')
    expect(get).toHaveBeenCalledTimes(2)
    expect(get).toHaveBeenLastCalledWith({ arxivId: '2610.11302', refresh: true })
  })
  it('keeps Open and Recheck usable when a write recheck runs during an open', async () => {
    let opened!: () => void
    const h = nativeHarness({
      getLlmWikiStatus: vi.fn(async () => found),
      openLlmWikiNote: vi.fn(
        () =>
          new Promise<{ opened: true }>((resolve) => {
            opened = () => resolve({ opened: true })
          })
      )
    })
    const widget = new WikiStatus(h.context, 'discover')
    widget.select(paper)
    await vi.waitFor(() => expect(JSON.stringify(h.render(widget))).toContain('In llm-wiki'))
    const opening = h.act(widget, 'discover-wiki-open')
    await widget.refreshIfShowing('2610.11302')
    opened()
    await opening
    expect(h.find(h.render(widget), 'discover-wiki-open')?.enabled).toBe(true)
    expect(h.find(h.render(widget), 'discover-wiki-refresh')?.enabled).toBe(true)
  })
  it('makes Open the primary action only when a paper note exists', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(found)
      .mockResolvedValue({ ...found, notePath: null, level: null, readStatus: null })
    const h = nativeHarness({ getLlmWikiStatus: get })
    const widget = new WikiStatus(h.context, 'saved')
    widget.select(paper)
    await vi.waitFor(() =>
      expect(h.find(h.render(widget), 'saved-wiki-open')?.emphasis).toBe('primary')
    )
    expect(h.find(h.render(widget), 'saved-wiki-hint')).toBeUndefined()
    await h.act(widget, 'saved-wiki-refresh')
    expect(h.find(h.render(widget), 'saved-wiki-open')?.emphasis).toBeUndefined()
    expect(h.find(h.render(widget), 'saved-wiki-hint')?.text).toBe(
      'No L1/L2 paper note yet. Preview llm-wiki promotion checks whether one can be added.'
    )
  })
  it('explains record-only state and presents query/open failures honestly', async () => {
    const get = vi
      .fn()
      .mockRejectedValueOnce(new Error('Read failed'))
      .mockResolvedValue({ ...found, notePath: null, level: null })
    const h = nativeHarness({
      getLlmWikiStatus: get,
      openLlmWikiNote: vi.fn(async () => {
        throw new Error('Obsidian is unavailable')
      })
    })
    const widget = new WikiStatus(h.context, 'saved')
    widget.select(paper)
    await vi.waitFor(() => expect(JSON.stringify(h.render(widget))).toContain('Read failed'))
    await h.act(widget, 'saved-wiki-refresh')
    expect(JSON.stringify(h.render(widget))).toContain('Paper record only')
    await h.act(widget, 'saved-wiki-open')
    expect(JSON.stringify(h.render(widget))).toContain('Obsidian is unavailable')
  })
})

import { describe, expect, it, vi } from 'vitest'
import { e2eLlmWikiDaily } from '../e2eFixtures'
import { DiscoverScreen } from './discover'
import { TriageHistory } from './reading'
import { nativeHarness } from './testSupport'
import type { LlmWikiDailyOpenRequest, LlmWikiDailySnapshot } from '../../shared/llmWikiDaily'

function fixture(get = vi.fn<() => Promise<LlmWikiDailySnapshot>>(async () => e2eLlmWikiDaily)) {
  const open = vi.fn(async (_request: LlmWikiDailyOpenRequest) => ({ opened: true as const }))
  const h = nativeHarness({ getLlmWikiDaily: get, openLlmWikiDaily: open })
  const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
  const act = (id: string, value?: string) => h.act(screen, id, value)
  const find = (id: string) => h.find(h.render(screen), id)
  return { ...h, screen, act, find, get, open }
}

describe('Daily Papers in native Discover', () => {
  it('keeps the Discover draft, opens exact targets and preserves a paper selection on reread', async () => {
    const h = fixture()
    await h.act('discover-query', 'Private draft retained locally')
    expect(h.get).not.toHaveBeenCalled()
    await h.act('discover-daily-papers')
    expect(h.find('daily-papers-status')?.text).toMatch(/2026-11-06.*Scan complete.*2 selected/)
    expect(h.find('daily-papers-list')?.rows?.map((entry) => entry.subtitle)).toEqual([
      'Direct · 9/10',
      'Adjacent · 6/10'
    ])
    expect(h.find('daily-papers-reason')?.text).toBe('Fixture match for structured pruning.')
    await h.act('daily-papers-open-note')
    await h.act('daily-papers-open-digest')
    expect(h.open.mock.calls).toEqual([
      [{ date: '2026-11-06', arxivId: '2611.00001' }],
      [{ date: '2026-11-06' }]
    ])
    await h.act('daily-papers-list', '2611.00002')
    await h.act('daily-papers-open-original')
    expect(h.context.openExternal).toHaveBeenCalledWith('https://arxiv.org/abs/2611.00002')
    expect(h.find('daily-papers-open-note')).toBeUndefined()
    await h.act('daily-papers-refresh')
    expect(h.find('daily-papers-list')?.selected).toBe('2611.00002')
    await h.act('daily-papers-back')
    expect(h.find('discover-query')?.value).toBe('Private draft retained locally')
    expect(h.context.focus).toHaveBeenLastCalledWith('discover-daily-papers')
    h.screen.dispose()
  })

  it('drops an old paper action after the selection changes', async () => {
    const h = fixture(
      vi.fn(async () => ({
        ...e2eLlmWikiDaily,
        edition: {
          ...e2eLlmWikiDaily.edition,
          papers: e2eLlmWikiDaily.edition.papers.map((paper) => ({ ...paper, canOpenNote: true }))
        }
      }))
    )
    await h.act('discover-daily-papers')
    const oldNote = h.find('daily-papers-open-note')!.action
    const oldOriginal = h.find('daily-papers-open-original')!.action
    await h.act('daily-papers-list', '2611.00002')
    h.render(h.screen)
    await h.context.presentation.dispatch(JSON.stringify({ action: oldNote }))
    await h.context.presentation.dispatch(JSON.stringify({ action: oldOriginal }))
    expect(h.open).not.toHaveBeenCalled()
    expect(h.context.openExternal).not.toHaveBeenCalled()
  })

  it('shows a recoverable read or open error without claiming zero papers', async () => {
    const h = fixture(
      vi
        .fn<() => Promise<LlmWikiDailySnapshot>>()
        .mockRejectedValueOnce(new Error('vault access failed'))
        .mockResolvedValue(e2eLlmWikiDaily)
    )
    await h.act('discover-daily-papers')
    // A failed read is explained in the shared empty state, not as an empty edition.
    expect(h.find('daily-papers-empty-title')?.text).toContain('could not be loaded')
    expect(h.find('daily-papers-empty-message')?.text).not.toMatch(/no papers/iu)
    expect(h.find('daily-papers-status')).toBeUndefined()
    await h.act('daily-papers-refresh')
    expect(h.find('daily-papers-error')).toBeUndefined()
    h.open.mockRejectedValueOnce(new Error('target changed'))
    await h.act('daily-papers-open-note')
    expect(h.find('daily-papers-error')?.text).toContain('Obsidian could not open')
    await h.act('daily-papers-list', '2611.00002')
    expect(h.find('daily-papers-error')).toBeUndefined()
  })

  it('reports a previous incomplete edition distinctly and discards a late response after Back', async () => {
    const h = fixture(
      vi.fn<() => Promise<LlmWikiDailySnapshot>>().mockResolvedValueOnce({
        requestedDate: '2026-11-07',
        checkedAt: '2026-11-07T11:00:00Z',
        status: 'partial',
        edition: { ...e2eLlmWikiDaily.edition, papers: [], selected: 0 }
      })
    )
    await h.act('discover-daily-papers')
    expect(h.find('daily-papers-status')?.text).toContain(
      'No edition for 2026-11-07 yet. Showing 2026-11-06 · Scan incomplete'
    )
    let resolve!: (snapshot: LlmWikiDailySnapshot) => void
    h.get.mockReturnValueOnce(new Promise((done) => (resolve = done)))
    const reread = h.act('daily-papers-refresh')
    expect(h.find('daily-papers-loading')).toBeDefined()
    await h.act('daily-papers-back')
    resolve(e2eLlmWikiDaily)
    await reread
    expect(h.find('daily-papers-status')).toBeUndefined()
    h.screen.dispose()
  })
})

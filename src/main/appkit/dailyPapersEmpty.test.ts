import { describe, expect, it, vi } from 'vitest'
import { e2eLlmWikiDaily } from '../e2eFixtures'
import { DiscoverScreen } from './discover'
import { TriageHistory } from './reading'
import { nativeHarness } from './testSupport'
import {
  LLM_WIKI_DAILY_REFRESH_NOTE,
  llmWikiDailyEmptyState,
  type LlmWikiDailySnapshot
} from '../../shared/llmWikiDaily'

const base = { requestedDate: '2026-11-12', checkedAt: '2026-11-12T08:00:00Z' } as const
const emptyEdition = { date: '2026-11-12', selected: 0, scanned: 40, papers: [] }
const snapshots: readonly LlmWikiDailySnapshot[] = [
  { ...base, status: 'no-results', edition: emptyEdition },
  { ...base, status: 'no-source', edition: { ...emptyEdition, scanned: null } },
  { ...base, status: 'partial', edition: emptyEdition },
  { ...base, status: 'missing', edition: null },
  { ...base, status: 'unavailable', edition: null }
]

function fixture(get: () => Promise<LlmWikiDailySnapshot>) {
  const h = nativeHarness({
    getLlmWikiDaily: vi.fn(get),
    openLlmWikiDaily: vi.fn(async () => ({ opened: true as const }))
  })
  const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
  const act = (id: string, value?: string) => h.act(screen, id, value)
  const find = (id: string) => h.find(h.render(screen), id)
  return { ...h, screen, act, find }
}

describe('Daily Papers empty states in native Discover', () => {
  it.each(snapshots.map((snapshot) => [snapshot.status, snapshot] as const))(
    'explains %s and keeps the date, counts and recovery actions',
    async (_status, snapshot) => {
      const h = fixture(async () => snapshot)
      await h.act('discover-daily-papers')
      const expected = llmWikiDailyEmptyState(snapshot)!
      expect(h.find('daily-papers-empty-title')?.text).toBe(expected.title)
      expect(h.find('daily-papers-empty-message')?.text).toBe(expected.detail)
      expect(expected.detail).toContain(LLM_WIKI_DAILY_REFRESH_NOTE)
      expect(h.find('daily-papers-status')?.text).toContain('2026-11-12')
      expect(h.find('daily-papers-refresh')?.enabled).not.toBe(false)
      expect(h.find('daily-papers-back')).toBeDefined()
      expect(h.find('daily-papers-list')).toBeUndefined()
      expect(h.find('daily-papers-open-digest') !== undefined).toBe(snapshot.edition !== null)
      if (snapshot.edition) expect(h.find('daily-papers-status')?.text).toContain('0 selected')
      h.screen.dispose()
    }
  )

  it('shows no final empty state while a read or reread is pending', async () => {
    let finish!: (snapshot: LlmWikiDailySnapshot) => void
    const pending = () =>
      new Promise<LlmWikiDailySnapshot>((resolve) => {
        finish = resolve
      })
    const h = fixture(pending)
    const entered = h.act('discover-daily-papers')
    expect(h.find('daily-papers-loading')).toBeDefined()
    expect(h.find('daily-papers-empty')).toBeUndefined()
    finish(snapshots[1]!)
    await entered
    expect(h.find('daily-papers-empty-title')?.text).toBe(
      'Announcement batch unavailable to the scan'
    )
    const reread = h.act('daily-papers-refresh')
    expect(h.find('daily-papers-loading')).toBeDefined()
    expect(h.find('daily-papers-empty')).toBeUndefined()
    finish(e2eLlmWikiDaily)
    await reread
    expect(h.find('daily-papers-empty')).toBeUndefined()
    expect(h.find('daily-papers-list')).toBeDefined()
    h.screen.dispose()
  })

  it('explains a failed read once and clears it after a successful Refresh', async () => {
    const get = vi
      .fn<() => Promise<LlmWikiDailySnapshot>>()
      .mockRejectedValueOnce(new Error('vault access failed'))
      .mockResolvedValue(snapshots[0]!)
    const h = fixture(get)
    await h.act('discover-daily-papers')
    expect(h.find('daily-papers-empty-title')?.text).toBe('Daily Papers could not be loaded')
    expect(h.find('daily-papers-error')).toBeUndefined()
    expect(h.find('daily-papers-status')).toBeUndefined()
    await h.act('daily-papers-refresh')
    expect(h.find('daily-papers-empty-title')?.text).toBe('No papers selected')
    expect(get).toHaveBeenCalledTimes(2)
    h.screen.dispose()
  })
})

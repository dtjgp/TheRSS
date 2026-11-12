// @vitest-environment jsdom

import { act, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  LLM_WIKI_DAILY_REFRESH_NOTE,
  llmWikiDailyEmptyState,
  type LlmWikiDailySnapshot
} from '../../shared/llmWikiDaily'
import { DailyPapersView } from './DailyPapersView'

const base = { requestedDate: '2026-11-12', checkedAt: '2026-11-12T08:00:00Z' } as const
const emptyEdition = { date: '2026-11-12', selected: 0, scanned: 40, papers: [] }
const snapshots: readonly LlmWikiDailySnapshot[] = [
  { ...base, status: 'no-results', edition: emptyEdition },
  { ...base, status: 'no-source', edition: { ...emptyEdition, scanned: null } },
  { ...base, status: 'partial', edition: emptyEdition },
  { ...base, status: 'missing', edition: null },
  { ...base, status: 'unavailable', edition: null }
]

const view = (getLlmWikiDaily: () => Promise<LlmWikiDailySnapshot>) =>
  render(
    <DailyPapersView
      api={{ getLlmWikiDaily: vi.fn(getLlmWikiDaily), openLlmWikiDaily: vi.fn() }}
      onBack={vi.fn()}
    />
  )

describe('DailyPapersView empty states', () => {
  it.each(snapshots.map((snapshot) => [snapshot.status, snapshot] as const))(
    'explains %s with the shared text and keeps the recovery actions',
    async (_status, snapshot) => {
      view(async () => snapshot)
      const expected = llmWikiDailyEmptyState(snapshot)!
      const region = await screen.findByRole('region', { name: 'Daily edition explanation' })
      expect(within(region).getByRole('heading', { name: expected.title })).toBeInTheDocument()
      expect(within(region).getByText(expected.detail)).toBeInTheDocument()
      expect(expected.detail).toContain(LLM_WIKI_DAILY_REFRESH_NOTE)
      expect(screen.getByRole('button', { name: 'Refresh daily papers' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Back to Discover' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Open digest in Obsidian' }) !== null).toBe(
        snapshot.edition !== null
      )
      expect(screen.getByText('Requested date')).toHaveTextContent('2026-11-12')
    }
  )

  it('shows no final explanation while a read is pending and explains a failed read', async () => {
    let fail!: (error: Error) => void
    view(
      () =>
        new Promise<LlmWikiDailySnapshot>((_resolve, reject) => {
          fail = reject
        })
    )
    expect(screen.queryByRole('region', { name: 'Daily edition explanation' })).toBeNull()
    await act(async () => fail(new Error('vault access failed')))
    const region = screen.getByRole('region', { name: 'Daily edition explanation' })
    expect(
      within(region).getByRole('heading', { name: 'Daily Papers could not be loaded' })
    ).toBeInTheDocument()
  })

  it('hides the explanation during a reread and for an edition with papers', async () => {
    let finish!: (snapshot: LlmWikiDailySnapshot) => void
    const get = vi
      .fn<() => Promise<LlmWikiDailySnapshot>>()
      .mockResolvedValueOnce(snapshots[0]!)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          })
      )
    render(
      <DailyPapersView api={{ getLlmWikiDaily: get, openLlmWikiDaily: vi.fn() }} onBack={vi.fn()} />
    )
    await screen.findByRole('region', { name: 'Daily edition explanation' })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh daily papers' }))
    expect(screen.queryByRole('region', { name: 'Daily edition explanation' })).toBeNull()
    await act(async () =>
      finish({
        ...base,
        status: 'completed',
        edition: {
          ...emptyEdition,
          selected: 1,
          papers: [
            {
              arxivId: '2611.00001',
              title: 'Paper',
              priority: 'direct',
              score: 9,
              reason: null,
              canOpenNote: false
            }
          ]
        }
      })
    )
    expect(screen.queryByRole('region', { name: 'Daily edition explanation' })).toBeNull()
    expect(screen.getByRole('list', { name: 'Daily paper shortlist' })).toBeInTheDocument()
  })
})

// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LlmWikiDailySnapshot } from '../../shared/llmWikiDaily'
import { App } from './App'
import { createApi, createDiscoverSnapshot, resetAppTestEnvironment } from './App.testSupport'

const today: LlmWikiDailySnapshot = {
  requestedDate: '2026-11-06',
  checkedAt: '2026-11-06T08:00:00.000Z',
  status: 'completed',
  edition: {
    date: '2026-11-06',
    selected: 2,
    scanned: 20,
    papers: [
      {
        arxivId: '2611.00001',
        title: 'Structured pruning for edge inference',
        priority: 'direct',
        reason: 'Matches structured pruning.',
        score: 9,
        canOpenNote: true
      },
      {
        arxivId: '2611.00002',
        title: 'Quantization for compact models',
        priority: 'adjacent',
        reason: 'Adjacent compression method.',
        score: 7,
        canOpenNote: false
      }
    ]
  }
}

describe('Daily Papers in the compatibility UI', () => {
  beforeEach(resetAppTestEnvironment)

  it('opens the exact digest and note, keeps list selection on refresh, and restores Discover', async () => {
    const api = Object.assign(createApi(), {
      getLlmWikiDaily: vi.fn().mockResolvedValue(today),
      openLlmWikiDaily: vi.fn().mockResolvedValue({ opened: true })
    })
    vi.mocked(api.getLatestDiscover).mockResolvedValue(createDiscoverSnapshot())
    const user = userEvent.setup()
    render(<App api={api} />)

    await screen.findByRole('list', { name: 'Discover result list' })
    const question = screen.getByRole('textbox', { name: 'Research question' })
    await user.clear(question)
    await user.type(question, 'My unsubmitted draft')
    const entry = screen.getByRole('button', { name: 'Daily Papers' })
    expect(api.getLlmWikiDaily).not.toHaveBeenCalled()
    await user.click(entry)

    expect(screen.getByRole('heading', { name: 'Daily Papers' })).toHaveFocus()
    expect(screen.queryByRole('textbox', { name: 'Research question' })).toBeNull()
    const list = await screen.findByRole('list', { name: 'Daily paper shortlist' })
    const [direct, adjacent] = within(list).getAllByRole('button')
    expect(direct).toHaveTextContent('Structured pruning for edge inference')
    expect(adjacent).toHaveTextContent('Quantization for compact models')
    const reader = screen.getByRole('article', { name: 'Selected daily paper' })
    expect(within(reader).getByText('Matches structured pruning.')).toBeVisible()
    expect(within(reader).getByRole('link', { name: 'Open on arXiv' })).toHaveAttribute(
      'href',
      'https://arxiv.org/abs/2611.00001'
    )
    await user.click(within(reader).getByRole('button', { name: 'Open note in Obsidian' }))
    expect(api.openLlmWikiDaily).toHaveBeenCalledWith({ date: '2026-11-06', arxivId: '2611.00001' })
    await user.click(screen.getByRole('button', { name: 'Open digest in Obsidian' }))
    expect(api.openLlmWikiDaily).toHaveBeenCalledWith({ date: '2026-11-06' })
    await user.click(direct!)
    await user.keyboard('{ArrowDown}')
    expect(adjacent).toHaveFocus()
    expect(within(reader).getByText('Adjacent compression method.')).toBeVisible()
    expect(within(reader).queryByRole('button', { name: 'Open note in Obsidian' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Refresh daily papers' }))
    expect(api.getLlmWikiDaily).toHaveBeenCalledTimes(2)
    expect(within(reader).getByText('Adjacent compression method.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Back to Discover' }))
    expect(entry).toHaveFocus()
    expect(question).toHaveValue('My unsubmitted draft')
    expect(screen.getByRole('list', { name: 'Discover result list' })).toBeVisible()
    expect(api.searchDiscover).not.toHaveBeenCalled()
    expect(api.confirmLlmWikiPromotion).not.toHaveBeenCalled()
  })

  it('shows the previous edition date and distinguishes partial from completed zero', async () => {
    const edition = today.edition!
    const api = Object.assign(createApi(), {
      getLlmWikiDaily: vi
        .fn()
        .mockResolvedValueOnce({ ...today, edition: { ...edition, date: '2026-11-05' } })
        .mockResolvedValueOnce({
          ...today,
          status: 'partial',
          edition: { ...edition, selected: 0, papers: [] }
        })
        .mockResolvedValueOnce({
          ...today,
          status: 'no-results',
          edition: { ...edition, selected: 0, papers: [] }
        }),
      openLlmWikiDaily: vi.fn()
    })
    const user = userEvent.setup()
    render(<App api={api} />)
    await user.click(screen.getByRole('button', { name: 'Daily Papers' }))
    expect(await screen.findByText('Displayed edition')).toHaveTextContent('2026-11-05')
    expect(screen.getByText('Requested date')).toHaveTextContent('2026-11-06')
    await user.click(screen.getByRole('button', { name: 'Refresh daily papers' }))
    expect(await screen.findByRole('status', { name: 'Daily scan status' })).toHaveTextContent(
      /scan incomplete/i
    )
    expect(screen.queryByRole('list', { name: 'Daily paper shortlist' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Refresh daily papers' }))
    expect(screen.getByRole('status', { name: 'Daily scan status' })).toHaveTextContent(
      /scan complete.*no papers selected/i
    )
  })

  it('keeps a missing edition when a request from a closed Daily Papers view finishes late', async () => {
    const api = createApi()
    let finish!: (value: LlmWikiDailySnapshot) => void
    vi.mocked(api.getLlmWikiDaily).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const user = userEvent.setup()
    render(<App api={api} />)

    const entry = screen.getByRole('button', { name: 'Daily Papers' })
    await user.click(entry)
    expect(screen.getByRole('status', { name: 'Daily scan status' })).toHaveTextContent(
      'Reading Daily ArXiv Scan'
    )
    await user.keyboard('{Escape}')
    expect(entry).toHaveFocus()
    await user.click(entry)
    await act(async () => finish(today))
    expect(screen.getByRole('status', { name: 'Daily scan status' })).toHaveTextContent(
      /no daily edition found/i
    )
    expect(screen.queryByRole('list', { name: 'Daily paper shortlist' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open digest in Obsidian' })).toBeNull()
  })
})

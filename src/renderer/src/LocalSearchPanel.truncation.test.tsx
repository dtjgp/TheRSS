// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { TheRSSApi } from '../../shared/api'
import type { LocalSearchResult } from '../../shared/localSearch'
import { LocalSearchPanel } from './LocalSearchPanel'

const saved: LocalSearchResult = {
  id: 'arxiv:1',
  kind: 'saved',
  itemId: 'arxiv:1',
  title: 'Saved pruning paper',
  detail: 'Detail',
  url: 'https://arxiv.org/abs/1',
  source: 'arxiv',
  createdAt: '2026-10-01T00:00:00.000Z',
  target: { kind: 'saved', itemId: 'arxiv:1' }
}

describe('LocalSearchPanel truncation', () => {
  it('searches all records and states a truncation only when the response reports one', async () => {
    const user = userEvent.setup()
    const searchLocal = vi
      .fn<TheRSSApi['searchLocal']>()
      .mockResolvedValueOnce({ query: 'pruning', scope: 'all', truncated: false, results: [saved] })
      .mockResolvedValueOnce({ query: 'pruning2', scope: 'all', truncated: true, results: [saved] })
    render(<LocalSearchPanel api={{ searchLocal }} onClose={vi.fn()} />)
    const input = screen.getByRole('searchbox')
    await user.type(input, 'pruning{Enter}')
    await screen.findByRole('link', { name: 'Saved pruning paper' })
    expect(searchLocal).toHaveBeenLastCalledWith('pruning')
    expect(screen.queryByText(/Not every match is shown/u)).toBeNull()

    await user.type(input, '2{Enter}')
    expect(
      await screen.findByText(
        'Not every match is shown. Search lists up to 25 newest matches of each kind and 50 in total. Refine the search to see older matches.'
      )
    ).toBeInTheDocument()
    expect(searchLocal).toHaveBeenLastCalledWith('pruning2')
  })
})

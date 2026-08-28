// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { TheRSSApi } from '../../shared/api'
import { LocalSearchPanel } from './LocalSearchPanel'

describe('LocalSearchPanel', () => {
  it('searches only after submit, labels result kinds, and closes with Escape', async () => {
    const searchLocal = vi.fn<TheRSSApi['searchLocal']>().mockResolvedValue({
      query: 'edge pruning',
      results: [
        {
          id: 'discover-session-1:arxiv:1',
          kind: 'discover',
          itemId: 'arxiv:1',
          title: 'Edge pruning paper',
          detail: 'Bounded Discover result',
          url: 'https://arxiv.org/abs/1',
          source: 'arxiv',
          createdAt: '2026-08-26T10:00:00.000Z'
        }
      ]
    })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<LocalSearchPanel api={{ searchLocal }} onClose={onClose} />)

    const input = screen.getByRole('searchbox', { name: 'Search local research' })
    expect(input).toHaveFocus()
    await user.type(input, 'edge pruning')
    expect(searchLocal).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')

    expect(searchLocal).toHaveBeenCalledWith('edge pruning')
    const results = await screen.findByRole('list', { name: 'Local search results' })
    expect(within(results).getByText('Discover')).toBeVisible()
    expect(within(results).getByText('Edge pruning paper')).toBeVisible()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })
})

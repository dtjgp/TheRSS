// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LocalSearchPanel } from './LocalSearchPanel'
import type { LocalSearchResponse } from '../../shared/localSearch'

describe('direct local lookup in the compatibility UI', () => {
  it('ignores late results and prevents a pending lookup from running after dismissal', async () => {
    vi.useFakeTimers()
    try {
      const complete = new Map<string, (value: LocalSearchResponse) => void>()
      const searchLocal = vi.fn(
        (query: string) =>
          new Promise<LocalSearchResponse>((resolve) => complete.set(query, resolve))
      )
      const view = render(<LocalSearchPanel api={{ searchLocal }} onClose={vi.fn()} />)
      const input = screen.getByRole('searchbox')
      fireEvent.change(input, { target: { value: 'old query' } })
      await act(() => vi.advanceTimersByTimeAsync(250))
      expect(input).toBeEnabled()
      fireEvent.change(input, { target: { value: 'new query' } })
      await act(() => vi.advanceTimersByTimeAsync(250))
      await act(async () => complete.get('new query')!({ query: 'new query', results: [] }))
      await act(async () =>
        complete.get('old query')!({
          query: 'old query',
          results: [
            {
              id: 'obsolete',
              itemId: 'obsolete',
              kind: 'saved',
              source: 'arxiv',
              title: 'Obsolete result',
              detail: 'Prior query',
              url: 'https://arxiv.org/abs/1',
              createdAt: '2026-09-07',
              target: { kind: 'saved', itemId: 'obsolete' }
            }
          ]
        })
      )
      expect(input).toHaveValue('new query')
      expect(screen.queryByRole('link', { name: 'Obsolete result' })).toBeNull()
      expect(screen.getByRole('status')).toHaveTextContent('No local records')
      fireEvent.change(input, { target: { value: 'not submitted' } })
      view.unmount()
      await act(() => vi.advanceTimersByTimeAsync(500))
      expect(searchLocal).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
  it('finds local records after a pause without an extra submit button and clears invalid queries', async () => {
    vi.useFakeTimers()
    try {
      const searchLocal = vi.fn(async (query: string) => ({
        query,
        results: [
          {
            id: 'paper',
            itemId: 'paper',
            kind: 'saved' as const,
            source: 'arxiv' as const,
            title: 'Saved pruning paper',
            detail: 'Existing record',
            url: 'https://arxiv.org/abs/1',
            createdAt: '2026-09-07',
            target: { kind: 'saved' as const, itemId: 'paper' }
          }
        ]
      }))
      const view = render(<LocalSearchPanel api={{ searchLocal }} onClose={vi.fn()} />)
      const input = screen.getByRole('searchbox')
      fireEvent.change(input, { target: { value: 'pruning' } })
      await act(() => vi.advanceTimersByTimeAsync(249))
      expect(searchLocal).not.toHaveBeenCalled()
      await act(() => vi.advanceTimersByTimeAsync(1))
      expect(searchLocal).toHaveBeenCalledExactlyOnceWith('pruning')
      expect(screen.getByRole('link', { name: 'Saved pruning paper' })).toBeVisible()
      expect(screen.queryByRole('button', { name: /^Search$/ })).toBeNull()
      fireEvent.change(input, { target: { value: 'p' } })
      expect(screen.queryByRole('link')).toBeNull()
      await act(() => vi.advanceTimersByTimeAsync(500))
      expect(searchLocal).toHaveBeenCalledTimes(1)
      view.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})

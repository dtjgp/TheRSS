// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { TheRSSApi } from '../../shared/api'
import { LocalSearchPanel } from './LocalSearchPanel'

function SearchHarness({ api }: { readonly api: Pick<TheRSSApi, 'searchLocal'> }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open local research</button>
      <button>Outside action</button>
      {isOpen && <LocalSearchPanel api={api} onClose={() => setIsOpen(false)} />}
    </>
  )
}

describe('LocalSearchPanel', () => {
  it('cycles Tab and Shift-Tab among enabled controls as query validity changes', async () => {
    const user = userEvent.setup()
    render(<SearchHarness api={{ searchLocal: vi.fn() }} />)
    await user.click(screen.getByRole('button', { name: 'Open local research' }))

    const input = screen.getByRole('searchbox')
    const close = screen.getByRole('button', { name: 'Close local search' })
    const submit = screen.getByRole('button', { name: /^Search$/ })
    expect(input).toHaveFocus()
    expect(submit).toBeDisabled()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab()
    expect(input).toHaveFocus()
    await user.tab({ shift: true })
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(input).toHaveFocus()

    await user.type(input, 'edge')
    await user.tab()
    expect(submit).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(submit).toHaveFocus()
  })

  it('includes newly returned links in the focus cycle and skips hidden result groups', async () => {
    const searchLocal = vi.fn<TheRSSApi['searchLocal']>().mockResolvedValue({
      query: 'edge',
      results: ['saved', 'analysis'].map((kind, index) => ({
        target:
          kind === 'saved'
            ? { kind: 'saved' as const, itemId: `arxiv:${index}` }
            : { kind: 'analysis' as const, analysisId: `result-${index}` },
        id: `result-${index}`,
        kind: kind as 'saved' | 'analysis',
        itemId: `arxiv:${index}`,
        title: `Edge result ${index}`,
        detail: 'Local result',
        url: `https://arxiv.org/abs/${index}`,
        source: 'arxiv' as const,
        createdAt: '2026-08-26T10:00:00.000Z'
      }))
    })
    const user = userEvent.setup()
    render(<SearchHarness api={{ searchLocal }} />)
    await user.click(screen.getByRole('button', { name: 'Open local research' }))
    const input = screen.getByRole('searchbox')
    await user.type(input, 'edge{Enter}')

    const links = await screen.findAllByRole('link')
    const close = screen.getByRole('button', { name: 'Close local search' })
    const submit = screen.getByRole('button', { name: /^Search$/ })
    await user.tab()
    expect(submit).toHaveFocus()
    await user.tab()
    expect(links[0]).toHaveFocus()
    await user.tab()
    expect(links[1]).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(links[1]).toHaveFocus()

    screen.getByRole('list', { name: 'Local search results' }).style.display = 'none'
    close.hidden = true
    input.focus()
    await user.tab({ shift: true })
    expect(submit).toHaveFocus()
    await user.tab()
    expect(input).toHaveFocus()
  })

  it.each(['Escape', 'Close', 'backdrop'] as const)(
    'returns focus to the opening control after dismissal with %s',
    async (dismissal) => {
      const user = userEvent.setup()
      render(<SearchHarness api={{ searchLocal: vi.fn() }} />)
      const trigger = screen.getByRole('button', { name: 'Open local research' })
      await user.click(trigger)
      expect(screen.getByRole('searchbox')).toHaveFocus()

      if (dismissal === 'Escape') await user.keyboard('{Escape}')
      else if (dismissal === 'Close')
        await user.click(screen.getByRole('button', { name: 'Close local search' }))
      else await user.click(screen.getByRole('presentation'))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
    }
  )

  it('preserves current dialog focus on parent rerenders and still restores the opener', async () => {
    const searchLocal = vi.fn<TheRSSApi['searchLocal']>()
    const user = userEvent.setup()
    const view = render(<SearchHarness api={{ searchLocal }} />)
    const trigger = screen.getByRole('button', { name: 'Open local research' })
    await user.click(trigger)
    await user.type(screen.getByRole('searchbox'), 'edge')
    await user.tab()
    const submit = screen.getByRole('button', { name: /^Search$/ })
    expect(submit).toHaveFocus()

    view.rerender(<SearchHarness api={{ searchLocal }} />)
    expect(submit).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
  })

  it('searches only after submit, labels result kinds, and closes with Escape', async () => {
    const searchLocal = vi.fn<TheRSSApi['searchLocal']>().mockResolvedValue({
      query: 'edge pruning',
      results: [
        {
          id: 'discover-session-1:arxiv:1',
          kind: 'discover',
          target: { kind: 'discover', sessionId: 'fixture-session', itemId: 'arxiv:1' },
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

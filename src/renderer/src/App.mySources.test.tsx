// @vitest-environment jsdom

import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DiscoverSnapshot } from '../../shared/discover'
import type { DiscoverSourcePreference } from '../../shared/discoverSourcePreference'
import { App } from './App'
import { createApi, createDiscoverSnapshot } from './App.testSupport'

const preference = (sources: DiscoverSourcePreference['sources']): DiscoverSourcePreference => ({
  sources,
  unavailable: [],
  origin: 'user',
  updatedAt: '2026-11-12T00:00:00.000Z'
})

function apiWithLatestArxivOnly() {
  const api = createApi()
  const snapshot = createDiscoverSnapshot()
  vi.mocked(api.getLatestDiscover).mockResolvedValue({
    ...snapshot,
    sourceOutcomes: Object.fromEntries(
      Object.entries(snapshot.sourceOutcomes).map(([source, outcome]) => [
        source,
        source === 'arxiv' ? outcome : { ...outcome, status: 'not_searched' as const }
      ])
    ) as DiscoverSnapshot['sourceOutcomes']
  })
  vi.mocked(api.getDiscoverSourcePreference).mockResolvedValue(preference(['github', 'folo:84']))
  return api
}

describe('Web Discover sources for this search', () => {
  it('starts from the default and applies a separate draft only to this search', async () => {
    const api = apiWithLatestArxivOnly()
    const user = userEvent.setup()
    render(<App api={api} />)
    const trigger = await screen.findByRole('button', { name: 'Choose sources, 2 of 22 selected' })
    expect(screen.getByText(/These results searched 1 of 22 sources/u)).toBeVisible()
    await user.click(trigger)
    const group = screen.getByRole('group', { name: 'Search sources' })
    await user.click(within(group).getByRole('checkbox', { name: 'Search arXiv' }))
    await user.click(within(group).getByRole('button', { name: 'Cancel' }))
    expect(trigger).toHaveAccessibleName('Choose sources, 2 of 22 selected')
    expect(trigger).toHaveFocus()
    await user.click(trigger)
    const reopened = screen.getByRole('group', { name: 'Search sources' })
    expect(within(reopened).getByRole('checkbox', { name: 'Search arXiv' })).not.toBeChecked()
    await user.click(within(reopened).getByRole('checkbox', { name: 'Search arXiv' }))
    await user.click(within(reopened).getByRole('button', { name: 'Apply to this search' }))
    expect(trigger).toHaveAccessibleName('Choose sources, 3 of 22 selected')
    expect(screen.getByText('Custom for this search · default 2/22')).toBeVisible()
    expect(api.saveDiscoverSourcePreference).not.toHaveBeenCalled()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Search with' }), 'codex')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(api.searchDiscover).toHaveBeenCalledWith(
      expect.objectContaining({ sources: ['arxiv', 'github', 'folo:84'] }),
      expect.any(String)
    )
    await user.click(trigger)
    const again = screen.getByRole('group', { name: 'Search sources' })
    await user.click(within(again).getByRole('button', { name: 'Use defaults' }))
    await user.click(within(again).getByRole('button', { name: 'Clear shown' }))
    expect(within(again).getByRole('button', { name: 'Apply to this search' })).toBeDisabled()
    expect(within(again).getByText('Select at least one source to apply.')).toBeVisible()
  })

  it('blocks search with a retry when the default cannot be read', async () => {
    const api = apiWithLatestArxivOnly()
    vi.mocked(api.getDiscoverSourcePreference)
      .mockRejectedValueOnce(new Error('busy'))
      .mockResolvedValue(preference(['github']))
    const user = userEvent.setup()
    render(<App api={api} />)
    expect(
      await screen.findByText(
        'Your default sources could not be read. Retry, or choose sources for this search.'
      )
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Choose sources, 0 of 22 selected' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Retry reading default sources' }))
    expect(
      await screen.findByRole('button', { name: 'Choose sources, 1 of 22 selected' })
    ).toBeVisible()
  })
})

describe('Web My sources', () => {
  it('saves a default from Sources, cancels with Escape and refuses zero sources', async () => {
    const api = createApi()
    vi.mocked(api.getDiscoverSourcePreference).mockResolvedValue(preference(['arxiv', 'github']))
    vi.mocked(api.saveDiscoverSourcePreference)
      .mockRejectedValueOnce(new Error('disk full'))
      .mockImplementation(async (sources) => preference(sources))
    const user = userEvent.setup()
    render(<App api={api} />)
    await user.click(screen.getByRole('button', { name: '04 Sources' }))
    const entry = await screen.findByRole('button', { name: 'My sources · 2/22' })
    await user.click(entry)
    let dialog = screen.getByRole('dialog', { name: 'Default search sources' })
    await user.click(within(dialog).getByRole('checkbox', { name: 'Use GitHub by default' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(entry).toHaveFocus()
    expect(api.saveDiscoverSourcePreference).not.toHaveBeenCalled()

    await user.click(entry)
    dialog = screen.getByRole('dialog', { name: 'Default search sources' })
    await user.click(within(dialog).getByRole('button', { name: 'Clear shown' }))
    expect(within(dialog).getByRole('button', { name: 'Save default sources' })).toBeDisabled()
    expect(within(dialog).getByText('Select at least one source to save.')).toBeVisible()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Use arXiv by default' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save default sources' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'The default sources could not be saved. Your choice is kept; try again.'
    )
    expect(within(dialog).getByRole('checkbox', { name: 'Use arXiv by default' })).toBeChecked()
    await user.click(within(dialog).getByRole('button', { name: 'Save default sources' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.saveDiscoverSourcePreference).toHaveBeenLastCalledWith(['arxiv'])
    expect(screen.getByRole('button', { name: 'My sources · 1/22' })).toBeVisible()
    expect(screen.getByRole('status', { name: 'My sources status' })).toHaveTextContent(
      'Default sources saved. New Discover searches start with them.'
    )
    expect(api.searchDiscover).not.toHaveBeenCalled()
  })
})

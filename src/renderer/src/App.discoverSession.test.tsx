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
const CHANGED =
  'Default sources saved. This search keeps its current sources; choose Use defaults to switch.'

function setup() {
  const api = createApi()
  vi.mocked(api.getDiscoverSourcePreference).mockResolvedValue(preference(['github', 'folo:84']))
  vi.mocked(api.saveDiscoverSourcePreference).mockImplementation(async (sources) =>
    preference(sources)
  )
  const user = userEvent.setup()
  render(<App api={api} />)
  const trigger = (count: number) =>
    screen.findByRole('button', { name: `Choose sources, ${count} of 22 selected` })
  const toSources = () => user.click(screen.getByRole('button', { name: '04 Sources' }))
  const toDiscover = () => user.click(screen.getByRole('button', { name: '01 Discover' }))
  /** Saves a new default of exactly arXiv from the Sources page. */
  const saveArxivDefault = async () => {
    await toSources()
    await user.click(await screen.findByRole('button', { name: /^My sources · / }))
    const dialog = screen.getByRole('dialog', { name: 'Default search sources' })
    await user.click(within(dialog).getByRole('button', { name: 'Clear shown' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Use arXiv by default' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save default sources' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await toDiscover()
  }
  return { api, user, trigger, toSources, toDiscover, saveArxivDefault }
}

describe('Web Discover session across navigation', () => {
  it('keeps the question, runner and custom sources across Sources and a new default', async () => {
    const f = setup()
    await f.user.click(await f.trigger(2))
    const group = screen.getByRole('group', { name: 'Search sources' })
    await f.user.click(within(group).getByRole('checkbox', { name: 'Search arXiv' }))
    await f.user.click(within(group).getByRole('button', { name: 'Apply to this search' }))
    const question = screen.getByRole('textbox', { name: 'Research question' })
    await f.user.clear(question)
    await f.user.type(question, 'unsent question')
    await f.user.selectOptions(screen.getByRole('combobox', { name: 'Search with' }), 'codex')

    await f.toSources()
    await f.toDiscover()
    expect(screen.getByRole('textbox', { name: 'Research question' })).toHaveValue(
      'unsent question'
    )
    expect(screen.getByRole('combobox', { name: 'Search with' })).toHaveValue('codex')
    expect(await f.trigger(3)).toBeVisible()
    expect(screen.getByText('Custom for this search · default 2/22')).toBeVisible()

    await f.saveArxivDefault()
    expect(await f.trigger(3)).toBeVisible()
    expect(screen.getByText(CHANGED)).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Research question' })).toHaveValue(
      'unsent question'
    )
    await f.user.click(await f.trigger(3))
    const again = screen.getByRole('group', { name: 'Search sources' })
    await f.user.click(within(again).getByRole('button', { name: 'Use defaults' }))
    await f.user.click(within(again).getByRole('button', { name: 'Apply to this search' }))
    expect(await f.trigger(1)).toBeVisible()
    expect(screen.getByText('Using your default sources')).toBeVisible()
  })

  it('follows a new default when the search sources were not customized', async () => {
    const f = setup()
    expect(await f.trigger(2)).toBeVisible()
    await f.saveArxivDefault()
    expect(await f.trigger(1)).toBeVisible()
    expect(screen.getByText('Using your default sources')).toBeVisible()
    expect(screen.queryByText(CHANGED)).toBeNull()
  })

  it('keeps an active search and its sources when the default changes during it', async () => {
    const f = setup()
    let finish!: (snapshot: DiscoverSnapshot) => void
    vi.mocked(f.api.searchDiscover).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    expect(await f.trigger(2)).toBeVisible()
    await f.user.type(screen.getByRole('textbox', { name: 'Research question' }), 'edge pruning')
    await f.user.selectOptions(screen.getByRole('combobox', { name: 'Search with' }), 'codex')
    await f.user.click(screen.getByRole('button', { name: 'Search' }))
    expect(f.api.searchDiscover).toHaveBeenCalledTimes(1)
    await f.saveArxivDefault()
    expect(await f.trigger(2)).toBeVisible()
    expect(screen.getByText(CHANGED)).toBeVisible()
    finish(createDiscoverSnapshot())
    expect(f.api.searchDiscover).toHaveBeenCalledWith(
      expect.objectContaining({ sources: ['github', 'folo:84'] }),
      expect.any(String)
    )
  })

  it('keeps one owned run across a round trip: no second start, and only its end clears it', async () => {
    const f = setup()
    let finish!: (snapshot: DiscoverSnapshot) => void
    vi.mocked(f.api.searchDiscover).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    expect(await f.trigger(2)).toBeVisible()
    await f.user.type(screen.getByRole('textbox', { name: 'Research question' }), 'edge pruning')
    await f.user.selectOptions(screen.getByRole('combobox', { name: 'Search with' }), 'codex')
    await f.user.click(screen.getByRole('button', { name: 'Search' }))
    await f.toSources()
    await f.toDiscover()
    // The returned view knows the run is still active, so it cannot start a second one.
    expect(screen.getByRole('button', { name: 'Searching…' })).toBeDisabled()
    expect(f.api.searchDiscover).toHaveBeenCalledTimes(1)
    await f.saveArxivDefault()
    expect(await f.trigger(2)).toBeVisible()
    expect(screen.getByText(CHANGED)).toBeVisible()
    const latestReads = vi.mocked(f.api.getLatestDiscover).mock.calls.length
    finish({ ...createDiscoverSnapshot(), intent: 'edge pruning' })
    expect(await screen.findByRole('button', { name: 'Search' })).toBeEnabled()
    // The view that did not start the run reads the finished session.
    await waitFor(() =>
      expect(vi.mocked(f.api.getLatestDiscover).mock.calls.length).toBeGreaterThan(latestReads)
    )
  })
})

// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardSnapshot } from '../../shared/api'
import type { DiscoverSnapshot } from '../../shared/discover'
import { ACTIVE_TODAY_SOURCE_IDS, sourceDisplayName } from '../../shared/sourceIdentity'
import { App } from './App'
import {
  createApi,
  createDiscoverSnapshot,
  emptyDashboard,
  resetAppTestEnvironment
} from './App.testSupport'

describe('App', () => {
  beforeEach(resetAppTestEnvironment)

  it('opens on Discover with primary, research, and bottom application utilities', async () => {
    const api = createApi()
    render(<App api={api} />)

    expect(
      await screen.findByRole('heading', { name: 'Search across your full source desk' })
    ).toBeVisible()
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' })
    expect(
      within(navigation)
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['Discover', 'Saved'])
    const utilities = screen.getByRole('navigation', { name: 'Research utilities' })
    expect(
      within(utilities)
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['Data Analytics', 'Sources'])
    const applicationUtilities = screen.getByRole('navigation', {
      name: 'Application utilities'
    })
    expect(within(applicationUtilities).getByRole('button', { name: 'Settings' })).toBeVisible()
    expect(applicationUtilities.querySelector('.sidebar__footer')).toBeVisible()
    expect(within(navigation).queryByText('Today')).not.toBeInTheDocument()
    expect(within(navigation).queryByText('Interests')).not.toBeInTheDocument()
    await waitFor(() => expect(api.getDashboard).toHaveBeenCalledOnce())
    expect(api.refresh).not.toHaveBeenCalled()
    expect(api.getInterestProfile).not.toHaveBeenCalled()
  })

  it('offers all 22 active sources by default and supports clear/select all', async () => {
    const user = userEvent.setup()
    render(<App api={createApi()} />)

    const sourcePicker = screen.getByRole('button', {
      name: 'Choose sources, 22 of 22 selected'
    })
    expect(sourcePicker).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('group', { name: 'Search sources' })).not.toBeInTheDocument()
    await user.click(sourcePicker)
    const sourceGroup = screen.getByRole('group', { name: 'Search sources' })
    const checkboxes = within(sourceGroup).getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(ACTIVE_TODAY_SOURCE_IDS.length)
    checkboxes.forEach((checkbox) => expect(checkbox).toBeChecked())
    ACTIVE_TODAY_SOURCE_IDS.forEach((source) => {
      expect(within(sourceGroup).getByText(sourceDisplayName(source))).toBeVisible()
    })

    await user.click(within(sourceGroup).getByRole('button', { name: 'Clear all sources' }))
    checkboxes.forEach((checkbox) => expect(checkbox).not.toBeChecked())
    expect(sourcePicker).toHaveAccessibleName('Choose sources, 0 of 22 selected')
    expect(screen.getByRole('button', { name: 'Expand and search' })).toBeDisabled()

    await user.click(within(sourceGroup).getByRole('button', { name: 'Select all sources' }))
    checkboxes.forEach((checkbox) => expect(checkbox).toBeChecked())
  })

  it('searches every source and renders truthful outcomes and actual item identities', async () => {
    const api = createApi()
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.type(
      screen.getByRole('textbox', { name: 'Research question' }),
      'semantic communication pruning for edge deployment'
    )
    await user.selectOptions(screen.getByRole('combobox', { name: 'Search with' }), 'codex')
    await user.click(screen.getByRole('button', { name: 'Expand and search' }))

    expect(api.searchDiscover).toHaveBeenCalledWith({
      intent: 'semantic communication pruning for edge deployment',
      runner: 'codex',
      sources: ACTIVE_TODAY_SOURCE_IDS
    })
    expect(await screen.findByText('Partial results')).toBeVisible()
    const results = screen.getByLabelText('Discover results')
    const searchDetails = screen.getByLabelText('Discover search details')
    expect(
      results.compareDocumentPosition(searchDetails) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(searchDetails).not.toHaveAttribute('open')
    await user.click(screen.getByRole('button', { name: /Search details/u }))
    const outcomes = screen.getByRole('list', { name: 'Source outcomes' })
    expect(within(outcomes).getAllByRole('listitem')).toHaveLength(22)
    const baaiOutcome = within(outcomes)
      .getByText('北京智源人工智能研究院')
      .closest('[role="listitem"]')
    expect(baaiOutcome).toHaveTextContent('Partial')
    expect(baaiOutcome).toHaveTextContent('1 results')
    expect(baaiOutcome).toHaveTextContent('One malformed feed record was rejected.')

    const resultList = screen.getByRole('list', { name: 'Discover result list' })
    await user.click(
      within(resultList).getByRole('button', {
        name: 'Select result: BAAI edge intelligence briefing'
      })
    )
    const selectedDetail = screen.getByRole('article', { name: 'Selected Discover result' })
    expect(within(selectedDetail).getByText('北京智源人工智能研究院')).toBeVisible()
    expect(within(selectedDetail).getByText('Article')).toBeVisible()
  })

  it('shows honest indeterminate progress while a bounded Discover run is pending', async () => {
    const api = createApi()
    let resolveSearch: ((snapshot: DiscoverSnapshot) => void) | undefined
    vi.mocked(api.searchDiscover).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve
        })
    )
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.type(screen.getByRole('textbox', { name: 'Research question' }), 'edge search')
    await user.click(screen.getByRole('button', { name: 'Expand and search' }))

    const progress = screen.getByRole('status', { name: 'Discover search progress' })
    expect(progress).toHaveTextContent('Expanding intent and searching 22 sources…')
    expect(progress).not.toHaveTextContent(/\d+%/u)

    await act(async () => resolveSearch?.(createDiscoverSnapshot()))
    await waitFor(() =>
      expect(
        screen.queryByRole('status', { name: 'Discover search progress' })
      ).not.toBeInTheDocument()
    )
  })

  it('shows whether personalization is active without echoing the private prompt', async () => {
    const api = createApi()
    vi.mocked(api.getDiscoverPersonalizationSettings).mockResolvedValue({
      prompt: 'Private profile text about energy systems and edge intelligence.',
      updatedAt: '2026-08-20T08:00:00.000Z'
    })
    render(<App api={api} />)

    const status = await screen.findByRole('status', { name: 'Personal prompt status' })
    expect(status).toHaveTextContent('Personal context on')
    expect(status).toHaveTextContent('Source sites receive the generated search terms')
    expect(status).not.toHaveTextContent('Private profile text')
  })

  it('uses one selectable Discover list-detail workspace for fast scanning', async () => {
    const api = createApi()
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.type(screen.getByRole('textbox', { name: 'Research question' }), 'edge search')
    await user.click(screen.getByRole('button', { name: 'Expand and search' }))

    const resultList = await screen.findByRole('list', { name: 'Discover result list' })
    const resultRows = within(resultList).getAllByRole('button', { name: /Select result:/u })
    const detail = screen.getByRole('article', { name: 'Selected Discover result' })

    expect(resultRows).toHaveLength(3)
    expect(resultRows[0]).toHaveAttribute('aria-current', 'true')
    expect(
      within(detail).getByRole('heading', {
        name: 'Structured pruning for semantic communication'
      })
    ).toBeVisible()
    expect(screen.getByRole('separator', { name: 'Resize Discover result list' })).toBeVisible()

    await user.click(
      within(resultList).getByRole('button', { name: 'Select result: discover/repo' })
    )
    expect(within(detail).getByRole('heading', { name: 'discover/repo' })).toBeVisible()

    await user.keyboard('{ArrowDown}')
    expect(
      within(detail).getByRole('heading', { name: 'BAAI edge intelligence briefing' })
    ).toBeVisible()
  })

  it('progressively reveals a large Discover session with correct heading levels', async () => {
    const api = createApi()
    const snapshot = createDiscoverSnapshot()
    const items = Array.from({ length: 30 }, (_, index) => ({
      ...snapshot.items[0]!,
      id: `arxiv:large-session-${index}`,
      externalId: `large-session-${index}`,
      title: `Large session paper ${index + 1}`,
      url: `https://arxiv.org/abs/large-session-${index}`
    }))
    vi.mocked(api.getLatestDiscover).mockResolvedValue({
      ...snapshot,
      counts: {
        ...snapshot.counts,
        total: items.length,
        byKind: {
          paper: items.length,
          repository: 0,
          article: 0,
          model: 0,
          dataset: 0,
          post: 0
        }
      },
      items
    })
    const user = userEvent.setup()
    render(<App api={api} />)

    const resultList = await screen.findByRole('list', { name: 'Discover result list' })
    expect(within(resultList).getAllByRole('button', { name: /Select result:/u })).toHaveLength(24)
    const results = screen.getByRole('region', { name: 'Discover results' })
    expect(
      within(results).getByRole('status', { name: 'Discover result count' })
    ).toHaveTextContent('Showing 24 of 30 results')
    expect(within(results).getAllByRole('heading', { level: 3 })).toHaveLength(1)
    expect(
      within(results).getByRole('heading', { level: 2, name: 'Ranked source records' })
    ).toBeVisible()

    await user.click(within(results).getByRole('button', { name: 'Show 6 more results' }))
    expect(within(resultList).getAllByRole('button', { name: /Select result:/u })).toHaveLength(30)
    expect(
      within(results).getByRole('status', { name: 'Discover result count' })
    ).toHaveTextContent('Showing all 30 results')
  })

  it('filters results by paper, repository, and other without rerunning search', async () => {
    const api = createApi()
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.type(screen.getByRole('textbox', { name: 'Research question' }), 'edge search')
    await user.click(screen.getByRole('button', { name: 'Expand and search' }))
    const filters = await screen.findByRole('group', { name: 'Filter Discover results' })
    const resultList = screen.getByRole('list', { name: 'Discover result list' })
    const selectedDetail = screen.getByRole('article', { name: 'Selected Discover result' })

    await user.click(within(filters).getByRole('button', { name: 'Papers 1' }))
    expect(
      within(selectedDetail).getByRole('heading', {
        name: 'Structured pruning for semantic communication'
      })
    ).toBeVisible()
    expect(
      within(resultList).queryByRole('button', { name: 'Select result: discover/repo' })
    ).not.toBeInTheDocument()
    await user.click(within(filters).getByRole('button', { name: 'Repositories 1' }))
    expect(within(selectedDetail).getByRole('heading', { name: 'discover/repo' })).toBeVisible()
    expect(
      within(resultList).queryByRole('button', {
        name: 'Select result: BAAI edge intelligence briefing'
      })
    ).not.toBeInTheDocument()
    await user.click(within(filters).getByRole('button', { name: 'Other 1' }))
    expect(
      within(selectedDetail).getByRole('heading', { name: 'BAAI edge intelligence briefing' })
    ).toBeVisible()
    expect(
      within(resultList).queryByRole('button', { name: 'Select result: discover/repo' })
    ).not.toBeInTheDocument()
    expect(api.searchDiscover).toHaveBeenCalledOnce()
  })

  it('saves a configured-source result into the common Saved shelf', async () => {
    const savedItem: DashboardSnapshot['savedItems'][number] = {
      id: 'folo:302:discover-article',
      source: 'folo:302',
      kind: 'article',
      title: 'BAAI edge intelligence briefing',
      summary: 'Saved from Discover.',
      url: 'https://www.baai.ac.cn/briefing',
      publishedAt: '2026-08-18T00:00:00.000Z',
      score: 39,
      triageState: 'saved',
      reasons: ['Recent-window content matches edge intelligence']
    }
    const api = createApi()
    vi.mocked(api.saveDiscoverResult).mockResolvedValue({
      ...emptyDashboard,
      savedItems: [savedItem]
    })
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.type(screen.getByRole('textbox', { name: 'Research question' }), 'edge search')
    await user.click(screen.getByRole('button', { name: 'Expand and search' }))
    const resultList = await screen.findByRole('list', { name: 'Discover result list' })
    await user.click(
      within(resultList).getByRole('button', {
        name: 'Select result: BAAI edge intelligence briefing'
      })
    )
    const selectedDetail = screen.getByRole('article', { name: 'Selected Discover result' })
    await user.click(within(selectedDetail).getByRole('button', { name: 'Save result' }))
    expect(api.saveDiscoverResult).toHaveBeenCalledWith(
      'discover-session-1',
      'folo:302:discover-article'
    )

    await user.click(screen.getByRole('button', { name: '02 Saved' }))
    expect(screen.getByRole('heading', { name: 'Saved research signals' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Select signal: BAAI edge intelligence briefing' })
    ).toBeVisible()
    expect(screen.getByRole('group', { name: 'Filter saved signals by source' })).toBeVisible()
  })

  it('uses a reversible outline and filled star instead of Save result text', async () => {
    const api = createApi()
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.type(screen.getByRole('textbox', { name: 'Research question' }), 'edge search')
    await user.click(screen.getByRole('button', { name: 'Expand and search' }))
    const selectedDetail = await screen.findByRole('article', { name: 'Selected Discover result' })
    const saveButton = within(selectedDetail).getByRole('button', { name: 'Save result' })

    expect(saveButton).toHaveAttribute('aria-pressed', 'false')
    expect(saveButton).not.toHaveTextContent('Save result')
    expect(saveButton.querySelector('[data-save-star]')).toHaveAttribute('fill', 'none')

    await user.click(saveButton)
    expect(api.saveDiscoverResult).toHaveBeenCalledWith('discover-session-1', 'arxiv:discover')
    const removeButton = within(selectedDetail).getByRole('button', {
      name: 'Remove result from Saved'
    })
    expect(removeButton).toHaveAttribute('aria-pressed', 'true')
    expect(removeButton.querySelector('[data-save-star]')).toHaveAttribute('fill', 'currentColor')

    await user.click(removeButton)
    expect(api.setTriageState).toHaveBeenCalledWith('arxiv:discover', 'viewed')
    expect(within(selectedDetail).getByRole('button', { name: 'Save result' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('places a paper-only L1 analysis action to the right of the star without auto-saving', async () => {
    const api = createApi()
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.type(screen.getByRole('textbox', { name: 'Research question' }), 'edge search')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Search with' }), 'codex')
    await user.click(screen.getByRole('button', { name: 'Expand and search' }))

    const resultList = await screen.findByRole('list', { name: 'Discover result list' })
    const selectedDetail = screen.getByRole('article', { name: 'Selected Discover result' })
    const paperActions = selectedDetail.querySelector('.signal-detail__actions') as HTMLElement
    expect(
      within(paperActions)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label'))
    ).toEqual(['Save result', 'Analyze paper', 'Promote to llm-wiki'])

    await user.click(
      within(resultList).getByRole('button', { name: 'Select result: discover/repo' })
    )
    expect(within(selectedDetail).queryByRole('button', { name: 'Analyze paper' })).toBeNull()
    await user.click(
      within(resultList).getByRole('button', {
        name: 'Select result: BAAI edge intelligence briefing'
      })
    )
    expect(within(selectedDetail).queryByRole('button', { name: 'Analyze paper' })).toBeNull()

    await user.click(
      within(resultList).getByRole('button', {
        name: 'Select result: Structured pruning for semantic communication'
      })
    )

    await user.click(within(selectedDetail).getByRole('button', { name: 'Analyze paper' }))
    expect(api.analyzeDiscoverResult).toHaveBeenCalledWith(
      'discover-session-1',
      'arxiv:discover',
      'codex'
    )
    expect(api.saveDiscoverResult).not.toHaveBeenCalled()
    expect(within(selectedDetail).getByRole('button', { name: 'Save result' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(
      await within(selectedDetail).findByLabelText('L1 paper analysis result')
    ).toHaveTextContent('abstract-only / provisional')
  })

  it('restores the exact source subset from the latest Discover session', async () => {
    const api = createApi()
    vi.mocked(api.getLatestDiscover).mockResolvedValue({
      ...createDiscoverSnapshot(),
      sourceOutcomes: Object.fromEntries(
        ACTIVE_TODAY_SOURCE_IDS.map((source) => [
          source,
          source === 'arxiv' || source === 'folo:302'
            ? { status: 'no_results', resultCount: 0, error: null }
            : { status: 'not_searched', resultCount: 0, error: null }
        ])
      ) as DiscoverSnapshot['sourceOutcomes']
    })
    const user = userEvent.setup()
    render(<App api={api} />)

    const sourcePicker = await screen.findByRole('button', {
      name: 'Choose sources, 2 of 22 selected'
    })
    await user.click(sourcePicker)
    expect(await screen.findByRole('checkbox', { name: 'Search arXiv' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Search 北京智源人工智能研究院' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Search GitHub' })).not.toBeChecked()
  })

  it('shows a bounded failure message when Discover search fails', async () => {
    const api = createApi()
    vi.mocked(api.searchDiscover).mockRejectedValue(new Error('provider unavailable'))
    const user = userEvent.setup()
    render(<App api={api} />)
    await user.type(screen.getByRole('textbox', { name: 'Research question' }), 'edge search')
    await user.click(screen.getByRole('button', { name: 'Expand and search' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Discover failed. Configure or check the selected model provider.'
    )
  })
})

describe('Discover result context menu', () => {
  async function renderDiscoverResults() {
    const api = createApi()
    const snapshot = createDiscoverSnapshot()
    vi.mocked(api.searchDiscover).mockResolvedValue(snapshot)
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.type(screen.getByRole('textbox', { name: 'Research question' }), 'edge search')
    await user.click(screen.getByRole('button', { name: 'Expand and search' }))
    const cards = await screen.findAllByTestId('discover-result')
    return { api, cards, snapshot }
  }

  it('sends the main process a typed descriptor for the right-clicked paper', async () => {
    const { api, cards, snapshot } = await renderDiscoverResults()
    const paper = snapshot.items[0]!

    fireEvent.contextMenu(cards[0]!)

    await waitFor(() => expect(api.showContextMenu).toHaveBeenCalledTimes(1))
    expect(api.showContextMenu).toHaveBeenCalledWith({
      kind: 'discover-result',
      itemId: paper.id,
      sessionId: snapshot.id,
      title: paper.title,
      url: paper.url,
      sourceLabel: sourceDisplayName(paper.source),
      publishedAt: paper.publishedAt,
      isSaved: false,
      canAnalyze: true,
      canPromote: false
    })
  })

  it('marks a non-paper result as not analysable', async () => {
    const { api, cards, snapshot } = await renderDiscoverResults()
    const repositoryIndex = snapshot.items.findIndex((item) => item.kind === 'repository')
    expect(repositoryIndex).toBeGreaterThanOrEqual(0)

    fireEvent.contextMenu(cards[repositoryIndex]!)

    await waitFor(() => expect(api.showContextMenu).toHaveBeenCalledTimes(1))
    expect(vi.mocked(api.showContextMenu).mock.calls[0]![0]).toMatchObject({
      itemId: snapshot.items[repositoryIndex]!.id,
      canAnalyze: false
    })
  })

  it('runs the existing save flow when the menu returns save', async () => {
    const { api, cards, snapshot } = await renderDiscoverResults()
    vi.mocked(api.showContextMenu).mockResolvedValue({
      action: 'save',
      itemId: snapshot.items[0]!.id,
      sessionId: snapshot.id
    })

    fireEvent.contextMenu(cards[0]!)

    await waitFor(() =>
      expect(api.saveDiscoverResult).toHaveBeenCalledWith(snapshot.id, snapshot.items[0]!.id)
    )
  })

  it('suppresses the browser menu so only the native menu appears', async () => {
    const { cards } = await renderDiscoverResults()
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })

    fireEvent(cards[0]!, event)

    expect(event.defaultPrevented).toBe(true)
  })
})

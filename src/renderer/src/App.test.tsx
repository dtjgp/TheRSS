// @vitest-environment jsdom

import { act, render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DashboardSnapshot, TheRSSApi } from '../../shared/api'
import type { DiscoverSnapshot, DiscoverSource, DiscoverSourceOutcome } from '../../shared/discover'
import { ACTIVE_TODAY_SOURCE_IDS, sourceDisplayName } from '../../shared/sourceIdentity'
import { App } from './App'

const emptyDashboard: DashboardSnapshot = {
  date: '2026-08-19',
  profileName: null,
  lastRefreshAt: null,
  sourceHealth: { arxiv: 'idle', github: 'idle' },
  counts: { total: 0, arxiv: 0, github: 0, unread: 0 },
  items: [],
  savedItems: []
}

function sourceOutcomes(
  overrides: Partial<Record<DiscoverSource, DiscoverSourceOutcome>> = {}
): DiscoverSnapshot['sourceOutcomes'] {
  return Object.fromEntries(
    ACTIVE_TODAY_SOURCE_IDS.map((source) => [
      source,
      overrides[source] ?? { status: 'no_results', resultCount: 0, error: null }
    ])
  ) as DiscoverSnapshot['sourceOutcomes']
}

function sourceCounts(
  overrides: Partial<Record<DiscoverSource, number>> = {}
): DiscoverSnapshot['counts']['bySource'] {
  return Object.fromEntries(
    ACTIVE_TODAY_SOURCE_IDS.map((source) => [source, overrides[source] ?? 0])
  ) as DiscoverSnapshot['counts']['bySource']
}

function createDiscoverSnapshot(): DiscoverSnapshot {
  return {
    id: 'discover-session-1',
    intent: 'semantic communication pruning for edge deployment',
    runner: 'codex',
    status: 'partial',
    createdAt: '2026-08-19T12:00:00.000Z',
    plan: {
      version: 'discover-plan-v1',
      intentSummary: 'Find pruning-aware edge intelligence across the full source desk.',
      arxiv: {
        categories: ['cs.LG', 'eess.SP'],
        keywords: ['semantic communication', 'structured pruning'],
        excludeKeywords: []
      },
      github: {
        keywords: ['model compression'],
        topics: ['model-compression'],
        languages: ['Python']
      },
      rationale: 'Combine targeted search with bounded recent-source filtering.'
    },
    provenance: {
      providerId: 'local-agent:codex',
      providerName: 'Codex CLI',
      model: 'codex-cli',
      promptVersion: 'semantic-discover-v1',
      personalizationApplied: false,
      inputHash: 'a'.repeat(64),
      createdAt: '2026-08-19T12:00:00.000Z'
    },
    sourceOutcomes: sourceOutcomes({
      arxiv: { status: 'healthy', resultCount: 1, error: null },
      github: { status: 'healthy', resultCount: 1, error: null },
      'folo:302': {
        status: 'partial',
        resultCount: 1,
        error: 'One malformed feed record was rejected.'
      }
    }),
    counts: {
      total: 3,
      arxiv: 1,
      github: 1,
      byKind: { paper: 1, repository: 1, article: 1, model: 0, dataset: 0, post: 0 },
      bySource: sourceCounts({ arxiv: 1, github: 1, 'folo:302': 1 })
    },
    items: [
      {
        id: 'arxiv:discover',
        source: 'arxiv',
        kind: 'paper',
        externalId: 'discover',
        title: 'Structured pruning for semantic communication',
        summary: 'A semantic communication paper.',
        url: 'https://arxiv.org/abs/discover',
        publishedAt: '2026-08-18T00:00:00.000Z',
        updatedAt: '2026-08-18T00:00:00.000Z',
        authors: ['A. Researcher'],
        categories: ['cs.LG'],
        topics: [],
        language: null,
        stars: null,
        metrics: {},
        score: 61,
        reasons: ['Title matches structured pruning'],
        saved: false
      },
      {
        id: 'github:discover/repo',
        source: 'github',
        kind: 'repository',
        externalId: 'discover/repo',
        title: 'discover/repo',
        summary: 'A repository for semantic communication experiments.',
        url: 'https://github.com/discover/repo',
        publishedAt: '2026-08-18T00:00:00.000Z',
        updatedAt: '2026-08-19T00:00:00.000Z',
        authors: [],
        categories: [],
        topics: ['model-compression'],
        language: 'Python',
        stars: 42,
        metrics: {},
        score: 48,
        reasons: ['GitHub topic model-compression'],
        saved: false
      },
      {
        id: 'folo:302:discover-article',
        source: 'folo:302',
        kind: 'article',
        externalId: 'discover-article',
        title: 'BAAI edge intelligence briefing',
        summary: 'A configured-source article selected from the bounded recent window.',
        url: 'https://www.baai.ac.cn/briefing',
        publishedAt: '2026-08-18T00:00:00.000Z',
        updatedAt: '2026-08-18T00:00:00.000Z',
        authors: ['BAAI'],
        categories: [],
        topics: [],
        language: null,
        stars: null,
        metrics: {},
        score: 39,
        reasons: ['Recent-window content matches edge intelligence'],
        saved: false
      }
    ]
  }
}

function createApi(snapshot: DashboardSnapshot = emptyDashboard): TheRSSApi {
  return {
    onAppCommand: vi.fn().mockReturnValue(() => undefined),
    getDashboard: vi.fn().mockResolvedValue(snapshot),
    getSourceContent: vi.fn(),
    refreshSourceContent: vi.fn(),
    getInterestProfile: vi.fn().mockResolvedValue(null),
    saveInterestProfile: vi.fn().mockResolvedValue(snapshot),
    refresh: vi.fn().mockResolvedValue(snapshot),
    searchDiscover: vi.fn().mockResolvedValue(createDiscoverSnapshot()),
    getLatestDiscover: vi.fn().mockResolvedValue(null),
    getAnalytics: vi.fn().mockResolvedValue({
      generatedAt: '2026-08-19T12:00:00.000Z',
      windowDays: 7,
      trackingStartedAt: null,
      totals: {
        searchResults: 0,
        todayResults: 0,
        discoverResults: 0,
        deepAnalyses: 0,
        analyzedPapers: 0
      },
      daily: [],
      analyzedItems: []
    }),
    saveDiscoverResult: vi.fn().mockResolvedValue(snapshot),
    setTriageState: vi.fn().mockResolvedValue(snapshot),
    getModelProvider: vi.fn().mockResolvedValue(null),
    saveModelProvider: vi.fn().mockResolvedValue({
      id: 'default',
      name: 'Local fixture',
      protocol: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: 'fixture-model',
      hasCredential: true,
      updatedAt: '2026-08-19T12:00:00.000Z'
    }),
    getDiscoverPersonalizationSettings: vi.fn().mockResolvedValue({
      prompt: '',
      updatedAt: '2026-08-19T12:00:00.000Z'
    }),
    saveDiscoverPersonalizationPrompt: vi.fn().mockResolvedValue({
      prompt:
        'I focus on local-first edge intelligence research and reviewer-safe evidence boundaries.',
      updatedAt: '2026-08-20T08:00:00.000Z'
    }),
    getLocalAgentStatuses: vi.fn().mockResolvedValue([
      { runner: 'codex', label: 'Codex CLI', available: true },
      { runner: 'claude', label: 'Claude Code', available: true }
    ]),
    analyzeItem: vi.fn().mockResolvedValue({
      id: 'analysis-1',
      itemId: 'folo:302:saved',
      providerId: 'local-agent:codex',
      providerName: 'Codex CLI',
      model: 'codex-cli',
      promptVersion: 'discovery-analysis-v1',
      sourceHash: 'b'.repeat(64),
      content: 'Bounded fixture analysis.',
      createdAt: '2026-08-19T12:00:00.000Z'
    }),
    analyzeDiscoverResult: vi.fn().mockResolvedValue({
      id: 'analysis-discover-paper',
      itemId: 'arxiv:discover',
      providerId: 'local-agent:codex',
      providerName: 'Codex CLI',
      model: 'codex-cli',
      promptVersion: 'llm-wiki-paper-l1-v1',
      sourceHash: 'c'.repeat(64),
      content:
        '## 快速决策卡\nEvidence state: abstract-only / provisional\n\n## TL;DR\nA bounded L1 fixture.',
      createdAt: '2026-08-20T12:00:00.000Z'
    }),
    getLatestAnalysis: vi.fn().mockResolvedValue(null)
  }
}

describe('App', () => {
  it('opens on Discover with only the five consolidated primary destinations', async () => {
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
    ).toEqual(['Discover', 'Saved', 'Models & Agents', 'Data Analytics', 'Sources'])
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

    const baaiCard = screen.getByText('BAAI edge intelligence briefing').closest('article')
    expect(baaiCard).not.toBeNull()
    expect(within(baaiCard as HTMLElement).getByText('北京智源人工智能研究院')).toBeVisible()
    expect(within(baaiCard as HTMLElement).getByText('Article')).toBeVisible()
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

  it('caps staggered result entrance delays after the first six cards', async () => {
    const api = createApi()
    const snapshot = createDiscoverSnapshot()
    const items = Array.from({ length: 8 }, (_, index) => ({
      ...snapshot.items[0]!,
      id: `arxiv:discover-${index}`,
      externalId: `discover-${index}`,
      title: `Discover paper ${index}`,
      url: `https://arxiv.org/abs/discover-${index}`
    }))
    vi.mocked(api.searchDiscover).mockResolvedValue({
      ...snapshot,
      counts: {
        ...snapshot.counts,
        total: items.length,
        byKind: { ...snapshot.counts.byKind, paper: items.length }
      },
      items
    })
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.type(screen.getByRole('textbox', { name: 'Research question' }), 'edge search')
    await user.click(screen.getByRole('button', { name: 'Expand and search' }))

    const cards = await screen.findAllByTestId('discover-result')
    expect(cards).toHaveLength(8)
    expect(cards[7]).toHaveStyle('--card-index: 5')
  })

  it('filters results by paper, repository, and other without rerunning search', async () => {
    const api = createApi()
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.type(screen.getByRole('textbox', { name: 'Research question' }), 'edge search')
    await user.click(screen.getByRole('button', { name: 'Expand and search' }))
    const filters = await screen.findByRole('group', { name: 'Filter Discover results' })

    await user.click(within(filters).getByRole('button', { name: 'Papers 1' }))
    expect(screen.getByText('Structured pruning for semantic communication')).toBeVisible()
    expect(screen.queryByText('discover/repo')).not.toBeInTheDocument()
    await user.click(within(filters).getByRole('button', { name: 'Repositories 1' }))
    expect(screen.getByText('discover/repo')).toBeVisible()
    expect(screen.queryByText('BAAI edge intelligence briefing')).not.toBeInTheDocument()
    await user.click(within(filters).getByRole('button', { name: 'Other 1' }))
    expect(screen.getByText('BAAI edge intelligence briefing')).toBeVisible()
    expect(screen.queryByText('discover/repo')).not.toBeInTheDocument()
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
    const card = (await screen.findByText('BAAI edge intelligence briefing')).closest('article')
    await user.click(within(card as HTMLElement).getByRole('button', { name: 'Save result' }))
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
    const paperCard = (
      await screen.findByText('Structured pruning for semantic communication')
    ).closest('article') as HTMLElement
    const saveButton = within(paperCard).getByRole('button', { name: 'Save result' })

    expect(saveButton).toHaveAttribute('aria-pressed', 'false')
    expect(saveButton).not.toHaveTextContent('Save result')
    expect(saveButton.querySelector('[data-save-star]')).toHaveAttribute('fill', 'none')

    await user.click(saveButton)
    expect(api.saveDiscoverResult).toHaveBeenCalledWith('discover-session-1', 'arxiv:discover')
    const removeButton = within(paperCard).getByRole('button', {
      name: 'Remove result from Saved'
    })
    expect(removeButton).toHaveAttribute('aria-pressed', 'true')
    expect(removeButton.querySelector('[data-save-star]')).toHaveAttribute('fill', 'currentColor')

    await user.click(removeButton)
    expect(api.setTriageState).toHaveBeenCalledWith('arxiv:discover', 'viewed')
    expect(within(paperCard).getByRole('button', { name: 'Save result' })).toHaveAttribute(
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

    const paperCard = (
      await screen.findByText('Structured pruning for semantic communication')
    ).closest('article') as HTMLElement
    const paperActions = paperCard.querySelector('.signal-card__actions') as HTMLElement
    expect(
      within(paperActions)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label'))
    ).toEqual(['Save result', 'Analyze paper'])

    const repositoryCard = screen.getByText('discover/repo').closest('article') as HTMLElement
    const articleCard = screen
      .getByText('BAAI edge intelligence briefing')
      .closest('article') as HTMLElement
    expect(within(repositoryCard).queryByRole('button', { name: 'Analyze paper' })).toBeNull()
    expect(within(articleCard).queryByRole('button', { name: 'Analyze paper' })).toBeNull()

    await user.click(within(paperActions).getByRole('button', { name: 'Analyze paper' }))
    expect(api.analyzeDiscoverResult).toHaveBeenCalledWith(
      'discover-session-1',
      'arxiv:discover',
      'codex'
    )
    expect(api.saveDiscoverResult).not.toHaveBeenCalled()
    expect(within(paperCard).getByRole('button', { name: 'Save result' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(await within(paperCard).findByLabelText('L1 paper analysis result')).toHaveTextContent(
      'abstract-only / provisional'
    )
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

  it('opens Models & Agents from native Settings and saves a provider', async () => {
    const api = createApi()
    let listener: Parameters<TheRSSApi['onAppCommand']>[0] | null = null
    vi.mocked(api.onAppCommand).mockImplementation((candidate) => {
      listener = candidate
      return () => undefined
    })
    const user = userEvent.setup()
    render(<App api={api} />)

    act(() => listener?.('open-settings'))
    expect(screen.getByRole('heading', { name: 'Bring your own analysis model.' })).toBeVisible()
    await user.type(screen.getByRole('textbox', { name: 'Provider name' }), 'Local fixture')
    await user.type(
      screen.getByRole('textbox', { name: 'Provider base URL' }),
      'http://127.0.0.1:11434/v1'
    )
    await user.type(screen.getByRole('textbox', { name: 'Model name' }), 'fixture-model')
    await user.click(screen.getByRole('button', { name: 'Save model provider' }))
    expect(api.saveModelProvider).toHaveBeenCalledWith({
      name: 'Local fixture',
      protocol: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: 'fixture-model'
    })
  })

  it('loads and saves the optional personal Discover prompt from Settings', async () => {
    const api = createApi()
    vi.mocked(api.getDiscoverPersonalizationSettings).mockResolvedValue({
      prompt: 'Prefer systems papers with explicit evaluation and reproducibility detail.',
      updatedAt: '2026-08-20T08:00:00.000Z'
    })
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(screen.getByRole('button', { name: '03 Models & Agents' }))
    expect(await screen.findByRole('textbox', { name: 'Personal Discover prompt' })).toHaveValue(
      'Prefer systems papers with explicit evaluation and reproducibility detail.'
    )
    await user.clear(screen.getByRole('textbox', { name: 'Personal Discover prompt' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Personal Discover prompt' }),
      'Prioritize edge intelligence, energy systems, and clear claim boundaries.'
    )
    await user.click(screen.getByRole('button', { name: 'Save personal Discover prompt' }))

    expect(api.saveDiscoverPersonalizationPrompt).toHaveBeenCalledWith(
      'Prioritize edge intelligence, energy systems, and clear claim boundaries.'
    )
  })

  it('clears and disables saved personal context across Settings and Discover', async () => {
    const api = createApi()
    let storedPrompt = 'Prefer reviewer-safe energy systems research.'
    vi.mocked(api.getDiscoverPersonalizationSettings).mockImplementation(() =>
      Promise.resolve({
        prompt: storedPrompt,
        updatedAt: '2026-08-20T08:00:00.000Z'
      })
    )
    vi.mocked(api.saveDiscoverPersonalizationPrompt).mockImplementation((prompt) => {
      storedPrompt = prompt.trim()
      return Promise.resolve({
        prompt: storedPrompt,
        updatedAt: '2026-08-20T09:00:00.000Z'
      })
    })
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(screen.getByRole('button', { name: '03 Models & Agents' }))
    const personalPrompt = await screen.findByRole('textbox', {
      name: 'Personal Discover prompt'
    })
    await user.clear(personalPrompt)
    await user.click(screen.getByRole('button', { name: 'Save personal Discover prompt' }))

    expect(api.saveDiscoverPersonalizationPrompt).toHaveBeenCalledWith('')
    expect(await screen.findByRole('status')).toHaveTextContent('Personal context cleared')

    await user.click(screen.getByRole('button', { name: '01 Discover' }))
    expect(await screen.findByRole('status', { name: 'Personal prompt status' })).toHaveTextContent(
      'Personal context off'
    )
  })

  it('responds to native navigation, sidebar, and selected-item analysis commands', async () => {
    const savedItem: DashboardSnapshot['savedItems'][number] = {
      id: 'folo:302:saved',
      source: 'folo:302',
      kind: 'article',
      title: 'Saved BAAI article',
      summary: 'Saved article summary.',
      url: 'https://www.baai.ac.cn/saved',
      publishedAt: '2026-08-18T00:00:00.000Z',
      score: 35,
      triageState: 'saved',
      reasons: ['Saved reason']
    }
    const api = createApi({ ...emptyDashboard, savedItems: [savedItem] })
    let listener: Parameters<TheRSSApi['onAppCommand']>[0] | null = null
    vi.mocked(api.onAppCommand).mockImplementation((candidate) => {
      listener = candidate
      return () => undefined
    })
    const user = userEvent.setup()
    render(<App api={api} />)

    act(() => listener?.('show-saved'))
    const savedSignal = await screen.findByRole('button', {
      name: 'Select signal: Saved BAAI article'
    })
    await user.click(savedSignal)
    await waitFor(() => expect(api.getLatestAnalysis).toHaveBeenCalledWith('folo:302:saved'))
    act(() => listener?.('analyze-selected'))
    await waitFor(() =>
      expect(api.analyzeItem).toHaveBeenCalledWith('folo:302:saved', 'model-provider')
    )
    expect(await screen.findByText('Bounded fixture analysis.')).toBeVisible()
    act(() => listener?.('show-discover'))
    expect(
      screen.getByRole('heading', { name: 'Search across your full source desk' })
    ).toBeVisible()
    act(() => listener?.('toggle-sidebar'))
    expect(screen.getByRole('button', { name: 'Show sidebar' })).toBeVisible()
  })

  it('keeps a saved signal after a failed removal and removes it after a successful retry', async () => {
    const savedItem: DashboardSnapshot['savedItems'][number] = {
      id: 'folo:302:saved',
      source: 'folo:302',
      kind: 'article',
      title: 'Saved BAAI article',
      summary: 'Saved article summary.',
      url: 'https://www.baai.ac.cn/saved',
      publishedAt: '2026-08-18T00:00:00.000Z',
      score: 35,
      triageState: 'saved',
      reasons: ['Saved reason']
    }
    const api = createApi({ ...emptyDashboard, savedItems: [savedItem] })
    vi.mocked(api.setTriageState)
      .mockRejectedValueOnce(new Error('database busy'))
      .mockResolvedValueOnce(emptyDashboard)
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(screen.getByRole('button', { name: '02 Saved' }))
    const saveButton = await screen.findByRole('button', { name: 'Save signal', pressed: true })
    await user.click(saveButton)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The item state could not be updated. The local index was not changed.'
    )
    expect(screen.getByRole('button', { name: 'Select signal: Saved BAAI article' })).toBeVisible()
    expect(saveButton).toHaveAttribute('aria-pressed', 'true')

    await user.click(saveButton)
    expect(api.setTriageState).toHaveBeenLastCalledWith('folo:302:saved', 'viewed')
    expect(await screen.findByRole('heading', { name: 'No saved signals yet.' })).toBeVisible()
  })

  it('dismisses a saved signal and restores its exact prior state with Undo', async () => {
    const savedItem: DashboardSnapshot['savedItems'][number] = {
      id: 'arxiv:saved-paper',
      source: 'arxiv',
      kind: 'paper',
      title: 'Saved paper for triage',
      summary: 'Paper summary.',
      url: 'https://arxiv.org/abs/saved-paper',
      publishedAt: '2026-08-18T00:00:00.000Z',
      score: 44,
      triageState: 'saved',
      reasons: ['Saved paper reason']
    }
    const savedDashboard = { ...emptyDashboard, savedItems: [savedItem] }
    const api = createApi(savedDashboard)
    vi.mocked(api.setTriageState)
      .mockResolvedValueOnce(emptyDashboard)
      .mockResolvedValueOnce(savedDashboard)
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(screen.getByRole('button', { name: '02 Saved' }))
    await user.click(await screen.findByRole('button', { name: 'Dismiss signal' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Dismissed “Saved paper for triage”'
    )
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(api.setTriageState).toHaveBeenNthCalledWith(2, 'arxiv:saved-paper', 'saved')
    expect(
      await screen.findByRole('button', { name: 'Select signal: Saved paper for triage' })
    ).toBeVisible()
  })

  it('restores the latest persisted analysis for the selected saved signal', async () => {
    const savedItem: DashboardSnapshot['savedItems'][number] = {
      id: 'arxiv:persisted',
      source: 'arxiv',
      kind: 'paper',
      title: 'Persisted analysis paper',
      summary: 'A paper with prior analysis.',
      url: 'https://arxiv.org/abs/persisted',
      publishedAt: '2026-08-18T00:00:00.000Z',
      score: 62,
      triageState: 'saved',
      reasons: ['Previously analyzed']
    }
    const api = createApi({ ...emptyDashboard, savedItems: [savedItem] })
    vi.mocked(api.getLatestAnalysis).mockResolvedValue({
      id: 'analysis-persisted',
      itemId: 'arxiv:persisted',
      providerId: 'local-agent:codex',
      providerName: 'Codex CLI',
      model: 'codex-cli',
      promptVersion: 'llm-wiki-paper-l1-v1',
      sourceHash: 'd'.repeat(64),
      content: 'Persisted local analysis restored.',
      createdAt: '2026-08-19T12:00:00.000Z'
    })
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(screen.getByRole('button', { name: '02 Saved' }))
    await waitFor(() => expect(api.getLatestAnalysis).toHaveBeenCalledWith('arxiv:persisted'))
    expect(await screen.findByText('Persisted local analysis restored.')).toBeVisible()
  })

  it('opens Data Analytics from the consolidated navigation', async () => {
    const user = userEvent.setup()
    render(<App api={createApi()} />)
    await user.click(screen.getByRole('button', { name: '04 Data Analytics' }))
    expect(await screen.findByRole('heading', { name: 'Data Analytics' })).toBeVisible()
  })

  it('opens the retained live-verified source directory', async () => {
    const user = userEvent.setup()
    render(<App api={createApi()} />)
    await user.click(screen.getByRole('button', { name: '05 Sources' }))
    expect(
      await screen.findByRole('heading', { name: '22 live-verified research sources' })
    ).toBeVisible()
    expect(screen.getAllByRole('article')).toHaveLength(22)
    expect(screen.getByRole('heading', { name: 'arXiv' })).toBeVisible()
    expect(screen.queryByText('X (Twitter)')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pending integrations/i })).not.toBeInTheDocument()
  })

  it('keeps account, sync, Today, and Interests surfaces absent', () => {
    render(<App api={createApi()} />)
    expect(screen.queryByRole('button', { name: /Today|Interests|Sync/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Google Drive|Sign in/i)).not.toBeInTheDocument()
  })
})

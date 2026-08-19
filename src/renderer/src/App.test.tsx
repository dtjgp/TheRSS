// @vitest-environment jsdom

import { act, render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DashboardSnapshot, TheRSSApi } from '../../shared/api'
import type { DiscoverSnapshot } from '../../shared/discover'
import type { AnalysisArtifact } from '../../shared/models'
import { App } from './App'

const emptyDashboard: DashboardSnapshot = {
  date: '2026-08-15',
  profileName: null,
  lastRefreshAt: '2026-08-15T08:00:00.000Z',
  sourceHealth: {
    arxiv: 'idle',
    github: 'idle'
  },
  counts: {
    total: 0,
    arxiv: 0,
    github: 0,
    unread: 0
  },
  items: [],
  savedItems: []
}

const placeholderCredential = ['placeholder', 'value'].join('-')

function createApi(snapshot: DashboardSnapshot): TheRSSApi {
  const discoverResult: DiscoverSnapshot = {
    id: 'discover-session-1',
    intent: 'semantic communication pruning for edge deployment',
    runner: 'codex',
    status: 'partial',
    createdAt: '2026-08-15T12:00:00.000Z',
    plan: {
      version: 'discover-plan-v1',
      intentSummary:
        'Find recent pruning-aware semantic communication work and supporting codebases.',
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
      rationale: 'Cover papers and implementation terminology.'
    },
    provenance: {
      providerId: 'local-agent:codex',
      providerName: 'Codex CLI',
      model: 'codex-cli',
      promptVersion: 'semantic-discover-v1',
      inputHash: 'a'.repeat(64),
      createdAt: '2026-08-15T12:00:00.000Z'
    },
    sourceOutcomes: {
      arxiv: { status: 'healthy', resultCount: 1, error: null },
      github: { status: 'failed', resultCount: 0, error: 'rate limited' }
    },
    counts: { total: 2, arxiv: 1, github: 1 },
    items: [
      {
        id: 'arxiv:discover',
        source: 'arxiv',
        kind: 'paper',
        externalId: 'discover',
        title: 'Structured pruning for semantic communication',
        summary: 'A semantic communication paper.',
        url: 'https://arxiv.org/abs/discover',
        publishedAt: '2026-08-14T00:00:00.000Z',
        updatedAt: '2026-08-14T00:00:00.000Z',
        authors: ['A. Researcher'],
        categories: ['cs.LG'],
        topics: [],
        language: null,
        stars: null,
        metrics: {},
        score: 61,
        reasons: ['Title matches “structured pruning”'],
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
        publishedAt: '2026-08-14T00:00:00.000Z',
        updatedAt: '2026-08-15T00:00:00.000Z',
        authors: [],
        categories: [],
        topics: ['model-compression'],
        language: 'Python',
        stars: 42,
        metrics: {},
        score: 48,
        reasons: ['GitHub topic model-compression'],
        saved: false
      }
    ]
  }

  return {
    onAppCommand: vi.fn().mockReturnValue(() => undefined),
    getDashboard: vi.fn().mockResolvedValue(snapshot),
    getSourceContent: vi.fn(),
    refreshSourceContent: vi.fn(),
    getInterestProfile: vi.fn().mockResolvedValue(null),
    saveInterestProfile: vi.fn().mockResolvedValue(snapshot),
    refresh: vi.fn().mockResolvedValue(snapshot),
    searchDiscover: vi.fn().mockResolvedValue(discoverResult),
    getLatestDiscover: vi.fn().mockResolvedValue(null),
    getAnalytics: vi.fn().mockResolvedValue({
      generatedAt: '2026-08-17T12:00:00.000Z',
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
      name: 'DeepSeek',
      protocol: 'openai-compatible',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      hasCredential: true,
      updatedAt: '2026-08-15T12:00:00.000Z'
    }),
    getLocalAgentStatuses: vi.fn().mockResolvedValue([
      { runner: 'codex', label: 'Codex CLI', available: true },
      { runner: 'claude', label: 'Claude Code', available: true }
    ]),
    analyzeItem: vi.fn(),
    getLatestAnalysis: vi.fn().mockResolvedValue(null)
  }
}

describe('App', () => {
  it('presents a focused onboarding state when no interest profile exists', async () => {
    const api = createApi({ ...emptyDashboard, lastRefreshAt: null })
    render(<App api={api} />)

    expect(await screen.findByRole('heading', { name: 'Build your research radar' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Set research interests' })).toBeVisible()
    expect(screen.getByText('TheRSS')).toBeVisible()
    expect(api.refresh).not.toHaveBeenCalled()
  })

  it('shows explainable paper and repository recommendations', async () => {
    const dashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Edge intelligence',
      counts: { total: 2, arxiv: 1, github: 1, unread: 2 },
      items: [
        {
          id: 'arxiv:2608.00001',
          source: 'arxiv',
          kind: 'paper',
          title: 'Structured pruning for edge deployment',
          summary: 'A resource-aware pruning method.',
          url: 'https://arxiv.org/abs/2608.00001',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 62,
          triageState: 'new',
          reasons: ['Title matches “structured pruning”', 'arXiv category cs.LG']
        },
        {
          id: 'github:owner/repo',
          source: 'github',
          title: 'owner/repo',
          summary: 'Open tools for model compression.',
          url: 'https://github.com/owner/repo',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 44,
          triageState: 'new',
          reasons: ['GitHub topic model-compression', 'Primary language Python']
        }
      ]
    }

    const user = userEvent.setup()
    render(<App api={createApi(dashboard)} />)

    const paperSignal = await screen.findByRole('button', {
      name: 'Select signal: Structured pruning for edge deployment'
    })
    const repositorySignal = screen.getByRole('button', { name: 'Select signal: owner/repo' })
    expect(paperSignal).toBeVisible()
    expect(repositorySignal).toBeVisible()
    expect(screen.getByText('Title matches “structured pruning”')).toBeVisible()

    await user.click(repositorySignal)
    expect(screen.getByText('GitHub topic model-compression')).toBeVisible()
  })

  it('keeps an all-source daily stream beside Today and opens entries hidden by a source filter', async () => {
    const dashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Edge intelligence',
      counts: { total: 2, arxiv: 1, github: 1, unread: 2 },
      items: [
        {
          id: 'arxiv:stream-paper',
          source: 'arxiv',
          title: 'Stream paper',
          summary: 'A paper in the current edition.',
          url: 'https://arxiv.org/abs/stream-paper',
          publishedAt: '2026-08-15T07:00:00.000Z',
          score: 61,
          triageState: 'new',
          reasons: ['Paper match']
        },
        {
          id: 'github:stream/repository',
          source: 'github',
          title: 'stream/repository',
          summary: 'A repository in the current edition.',
          url: 'https://github.com/stream/repository',
          publishedAt: '2026-08-15T08:00:00.000Z',
          score: 47,
          triageState: 'new',
          reasons: ['Repository match']
        }
      ]
    }
    const api = createApi(dashboard)
    const user = userEvent.setup()

    render(<App api={api} />)

    const stream = await screen.findByRole('complementary', { name: 'Daily stream' })
    expect(within(stream).getAllByRole('button')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Show arXiv only' }))
    expect(screen.queryByRole('button', { name: 'Select signal: stream/repository' })).toBeNull()
    expect(
      within(stream).getByRole('button', {
        name: 'Open in daily workspace: stream/repository'
      })
    ).toBeVisible()

    await user.click(
      within(stream).getByRole('button', {
        name: 'Open in daily workspace: stream/repository'
      })
    )

    expect(screen.getByRole('button', { name: 'Show all sources' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      within(screen.getByRole('article', { name: 'Selected signal details' })).getByRole(
        'heading',
        { name: 'stream/repository' }
      )
    ).toBeVisible()
    expect(api.setTriageState).toHaveBeenCalledWith('github:stream/repository', 'viewed')
  })

  it('presents Today as a list-detail workspace and moves the selected signal with the keyboard', async () => {
    const dashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Edge intelligence',
      counts: { total: 2, arxiv: 1, github: 1, unread: 2 },
      items: [
        {
          id: 'arxiv:2608.00001',
          source: 'arxiv',
          kind: 'paper',
          title: 'Structured pruning for edge deployment',
          summary: 'A resource-aware pruning method.',
          url: 'https://arxiv.org/abs/2608.00001',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 62,
          triageState: 'new',
          reasons: ['Title matches “structured pruning”']
        },
        {
          id: 'github:owner/repo',
          source: 'github',
          title: 'owner/repo',
          summary: 'Open tools for model compression.',
          url: 'https://github.com/owner/repo',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 44,
          triageState: 'new',
          reasons: ['GitHub topic model-compression']
        }
      ]
    }
    const user = userEvent.setup()

    render(<App api={createApi(dashboard)} />)

    const detail = await screen.findByRole('article', { name: 'Selected signal details' })
    expect(
      within(detail).getByRole('heading', { name: 'Structured pruning for edge deployment' })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Select signal: Structured pruning for edge deployment' })
    ).toHaveAttribute('aria-current', 'true')

    await user.keyboard('{ArrowDown}')

    expect(within(detail).getByRole('heading', { name: 'owner/repo' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Select signal: owner/repo' })).toHaveAttribute(
      'aria-current',
      'true'
    )
    expect(within(detail).getByText('2 of 2')).toBeVisible()
  })

  it('marks an unread signal as viewed when the user selects it', async () => {
    const dashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Edge intelligence',
      counts: { total: 2, arxiv: 1, github: 1, unread: 2 },
      items: [
        {
          id: 'arxiv:unread',
          source: 'arxiv',
          title: 'Unread paper',
          summary: 'Paper summary.',
          url: 'https://arxiv.org/abs/unread',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 20,
          triageState: 'new',
          reasons: ['Paper reason']
        },
        {
          id: 'github:unread',
          source: 'github',
          title: 'Unread repository',
          summary: 'Repository summary.',
          url: 'https://github.com/owner/unread',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 18,
          triageState: 'new',
          reasons: ['Repository reason']
        }
      ]
    }
    const viewedDashboard: DashboardSnapshot = {
      ...dashboard,
      counts: { ...dashboard.counts, unread: 1 },
      items: [dashboard.items[0]!, { ...dashboard.items[1]!, triageState: 'viewed' }]
    }
    const api = createApi(dashboard)
    vi.mocked(api.setTriageState).mockResolvedValue(viewedDashboard)
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(
      await screen.findByRole('button', { name: 'Select signal: Unread repository' })
    )

    expect(api.setTriageState).toHaveBeenCalledWith('github:unread', 'viewed')
    expect(
      within(screen.getByRole('button', { name: 'Select signal: Unread repository' })).getByText(
        'Viewed'
      )
    ).toBeVisible()
    expect(screen.getByLabelText('Inbox counts').querySelectorAll('span')[3]).toHaveTextContent(
      '1 unread'
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps workspace shortcuts scoped and moves DOM focus with keyboard selection', async () => {
    const dashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Research',
      counts: { total: 2, arxiv: 1, github: 1, unread: 0 },
      items: [
        {
          id: 'arxiv:first',
          source: 'arxiv',
          title: 'First signal',
          summary: 'First summary.',
          url: 'https://arxiv.org/abs/first',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 20,
          triageState: 'viewed',
          reasons: ['First reason']
        },
        {
          id: 'github:second',
          source: 'github',
          title: 'Second signal',
          summary: 'Second summary.',
          url: 'https://github.com/owner/second',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 18,
          triageState: 'viewed',
          reasons: ['Second reason']
        }
      ]
    }
    const user = userEvent.setup()
    render(<App api={createApi(dashboard)} />)

    const first = await screen.findByRole('button', { name: 'Select signal: First signal' })
    const second = screen.getByRole('button', { name: 'Select signal: Second signal' })
    await user.click(screen.getByRole('button', { name: 'Hide sidebar' }))
    await user.keyboard('{ArrowDown}')
    expect(first).toHaveAttribute('aria-current', 'true')

    await user.click(first)
    await user.keyboard('{ArrowDown}')
    expect(second).toHaveAttribute('aria-current', 'true')
    expect(second).toHaveFocus()
  })

  it('offers Undo after dismissing and restores the exact prior triage state', async () => {
    const dashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Research',
      counts: { total: 2, arxiv: 1, github: 1, unread: 2 },
      items: [
        {
          id: 'arxiv:dismiss',
          source: 'arxiv',
          title: 'Dismissible paper',
          summary: 'Paper summary.',
          url: 'https://arxiv.org/abs/dismiss',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 20,
          triageState: 'new',
          reasons: ['Paper reason']
        },
        {
          id: 'github:keep',
          source: 'github',
          title: 'Keep repository',
          summary: 'Repository summary.',
          url: 'https://github.com/owner/keep',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 18,
          triageState: 'new',
          reasons: ['Repository reason']
        }
      ]
    }
    const dismissedDashboard: DashboardSnapshot = {
      ...dashboard,
      counts: { total: 1, arxiv: 0, github: 1, unread: 1 },
      items: [dashboard.items[1]!]
    }
    const api = createApi(dashboard)
    vi.mocked(api.setTriageState)
      .mockResolvedValueOnce(dismissedDashboard)
      .mockResolvedValueOnce(dashboard)
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(await screen.findByRole('button', { name: 'Dismiss signal' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Dismissed “Dismissible paper”')
    await user.click(screen.getByRole('button', { name: 'Undo' }))

    expect(api.setTriageState).toHaveBeenNthCalledWith(2, 'arxiv:dismiss', 'new')
    expect(
      await screen.findByRole('button', { name: 'Select signal: Dismissible paper' })
    ).toBeVisible()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows real source health instead of an unconditional ready indicator', async () => {
    const dashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Research',
      sourceHealth: { arxiv: 'partial', github: 'failed' }
    }
    render(<App api={createApi(dashboard)} />)

    expect(await screen.findByText('Source attention needed')).toBeVisible()
    expect(screen.getByText('arXiv: Partial')).toBeVisible()
    expect(screen.getByText('GitHub: Failed')).toBeVisible()
  })

  it('does not call all sources ready while one source is still idle', async () => {
    const dashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Research',
      sourceHealth: { arxiv: 'healthy', github: 'idle' }
    }
    render(<App api={createApi(dashboard)} />)

    expect(await screen.findByText('Some sources pending')).toBeVisible()
    expect(screen.queryByText('Sources ready')).not.toBeInTheDocument()
    expect(screen.getByText('arXiv: Healthy')).toBeVisible()
    expect(screen.getByText('GitHub: Idle')).toBeVisible()
  })

  it('applies scoped Save, Dismiss, and Analyze shortcuts but ignores editable controls', async () => {
    const dashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Edge intelligence',
      counts: { total: 1, arxiv: 1, github: 0, unread: 1 },
      items: [
        {
          id: 'arxiv:2608.00001',
          source: 'arxiv',
          kind: 'paper',
          title: 'Structured pruning for edge deployment',
          summary: 'A resource-aware pruning method.',
          url: 'https://arxiv.org/abs/2608.00001',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 62,
          triageState: 'new',
          reasons: ['Title matches “structured pruning”']
        }
      ]
    }
    const artifact: AnalysisArtifact = {
      id: 'analysis-shortcut',
      itemId: 'arxiv:2608.00001',
      providerId: 'default',
      providerName: 'Local fixture',
      model: 'fixture-model',
      promptVersion: 'llm-wiki-paper-l1-v1',
      sourceHash: 'c'.repeat(64),
      content: 'Shortcut analysis completed.',
      createdAt: '2026-08-15T12:00:00.000Z'
    }
    const api = createApi(dashboard)
    vi.mocked(api.analyzeItem).mockResolvedValue(artifact)
    const user = userEvent.setup()

    render(<App api={api} />)

    const runner = await screen.findByRole('combobox', { name: 'Analysis runner' })
    await user.click(runner)
    await user.keyboard('s')
    expect(api.setTriageState).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: 'Select signal: Structured pruning for edge deployment' })
    )
    await user.keyboard('sda')

    await waitFor(() => {
      expect(api.setTriageState).toHaveBeenCalledWith('arxiv:2608.00001', 'saved')
      expect(api.setTriageState).toHaveBeenCalledWith('arxiv:2608.00001', 'dismissed')
      expect(api.analyzeItem).toHaveBeenCalledWith('arxiv:2608.00001', 'model-provider')
    })
  })

  it('lets the user collapse and reveal the macOS-style sidebar', async () => {
    const user = userEvent.setup()
    render(<App api={createApi({ ...emptyDashboard, profileName: 'Research' })} />)

    const hideSidebar = await screen.findByRole('button', { name: 'Hide sidebar' })
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()

    await user.click(hideSidebar)

    expect(screen.getByRole('button', { name: 'Show sidebar' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
  })

  it('responds to native application-menu navigation and sidebar commands', async () => {
    const api = createApi({ ...emptyDashboard, profileName: 'Research' })
    let listener: Parameters<TheRSSApi['onAppCommand']>[0] | null = null
    vi.mocked(api.onAppCommand).mockImplementation((candidate) => {
      listener = candidate
      return () => undefined
    })
    render(<App api={api} />)

    await screen.findByRole('heading', { name: "Today's research signal" })
    act(() => listener?.('show-discover'))
    expect(
      screen.getByRole('heading', { name: 'Explore beyond your standing interests' })
    ).toBeVisible()

    act(() => listener?.('toggle-sidebar'))
    expect(screen.getByRole('button', { name: 'Show sidebar' })).toBeVisible()

    act(() => listener?.('open-settings'))
    expect(
      screen.getByRole('heading', { name: 'Teach TheRSS what deserves attention.' })
    ).toBeVisible()
  })

  it('filters the daily signal by source without changing persisted ranking', async () => {
    const dashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Research',
      counts: { total: 2, arxiv: 1, github: 1, unread: 2 },
      items: [
        {
          id: 'arxiv:1',
          source: 'arxiv',
          title: 'Paper signal',
          summary: 'Paper summary.',
          url: 'https://arxiv.org/abs/1',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 20,
          triageState: 'new',
          reasons: ['arXiv category cs.LG']
        },
        {
          id: 'github:repo',
          source: 'github',
          title: 'Repository signal',
          summary: 'Repository summary.',
          url: 'https://github.com/owner/repo',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 18,
          triageState: 'new',
          reasons: ['GitHub topic edge-ai']
        }
      ]
    }
    const user = userEvent.setup()
    render(<App api={createApi(dashboard)} />)

    await screen.findByRole('button', { name: 'Select signal: Repository signal' })
    await user.click(screen.getByRole('button', { name: 'Show arXiv only' }))

    expect(screen.getByRole('button', { name: 'Select signal: Paper signal' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Select signal: Repository signal' })
    ).not.toBeInTheDocument()
  })

  it('refreshes the dashboard from the visible action', async () => {
    const api = createApi({ ...emptyDashboard, profileName: 'Edge intelligence' })
    const user = userEvent.setup()
    render(<App api={api} />)

    await screen.findByRole('heading', { name: "Today's research signal" })
    await user.click(screen.getByRole('button', { name: 'Refresh sources' }))

    expect(api.refresh).toHaveBeenCalledOnce()
  })

  it('runs a semantic discover search and shows the expanded source plan', async () => {
    const api = createApi({ ...emptyDashboard, profileName: 'Edge intelligence' })
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(await screen.findByRole('button', { name: '03 Discover' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Research question' }),
      'semantic communication pruning for edge deployment'
    )
    await user.selectOptions(screen.getByRole('combobox', { name: 'Search with' }), 'codex')
    await user.click(screen.getByRole('button', { name: 'Expand and search' }))

    expect(api.searchDiscover).toHaveBeenCalledWith({
      intent: 'semantic communication pruning for edge deployment',
      runner: 'codex',
      sources: ['arxiv', 'github']
    })
    expect(
      await screen.findByText(
        'Find recent pruning-aware semantic communication work and supporting codebases.'
      )
    ).toBeVisible()
    expect(screen.getByText('Structured pruning for semantic communication')).toBeVisible()
    expect(screen.getByText('discover/repo')).toBeVisible()
    expect(screen.getByText('cs.LG')).toBeVisible()
    expect(screen.getByText('model-compression')).toBeVisible()
    expect(screen.getByText('Partial results')).toBeVisible()
    expect(screen.getByText('Codex CLI · codex-cli')).toBeVisible()
    expect(screen.getByText(/semantic-discover-v1/)).toBeVisible()

    const paperResult = screen
      .getByText('Structured pruning for semantic communication')
      .closest('article')
    expect(paperResult).not.toBeNull()
    await user.click(
      within(paperResult as HTMLElement).getByRole('button', { name: 'Save result' })
    )

    expect(api.saveDiscoverResult).toHaveBeenCalledWith('discover-session-1', 'arxiv:discover')
    expect(within(paperResult as HTMLElement).getByRole('button', { name: 'Saved' })).toBeDisabled()
  })

  it('filters an existing Discover session by papers or GitHub repositories', async () => {
    const api = createApi({ ...emptyDashboard, profileName: 'Edge intelligence' })
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(await screen.findByRole('button', { name: '03 Discover' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Research question' }),
      'semantic communication pruning for edge deployment'
    )
    await user.selectOptions(screen.getByRole('combobox', { name: 'Search with' }), 'codex')
    await user.click(screen.getByRole('button', { name: 'Expand and search' }))

    const filters = await screen.findByRole('group', { name: 'Filter Discover results' })
    const allFilter = within(filters).getByRole('button', { name: 'All 2' })
    const paperFilter = within(filters).getByRole('button', { name: 'Papers 1' })
    const repositoryFilter = within(filters).getByRole('button', {
      name: 'GitHub repos 1'
    })

    expect(allFilter).toHaveAttribute('aria-pressed', 'true')
    await user.click(paperFilter)
    expect(screen.getByText('Structured pruning for semantic communication')).toBeVisible()
    expect(screen.queryByText('discover/repo')).not.toBeInTheDocument()

    await user.click(repositoryFilter)
    expect(
      screen.queryByText('Structured pruning for semantic communication')
    ).not.toBeInTheDocument()
    expect(screen.getByText('discover/repo')).toBeVisible()

    await user.click(allFilter)
    expect(screen.getByText('Structured pruning for semantic communication')).toBeVisible()
    expect(screen.getByText('discover/repo')).toBeVisible()
  })

  it('shows a source-specific empty state without discarding the other Discover results', async () => {
    const api = createApi({ ...emptyDashboard, profileName: 'Edge intelligence' })
    const searchDiscover = vi.mocked(api.searchDiscover)
    const mixedResult = await searchDiscover({
      intent: 'semantic communication pruning for edge deployment',
      runner: 'codex',
      sources: ['arxiv', 'github']
    })
    searchDiscover.mockClear()
    searchDiscover.mockResolvedValue({
      ...mixedResult,
      counts: { total: 1, arxiv: 0, github: 1 },
      items: mixedResult.items.filter((item) => item.source === 'github')
    })
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(await screen.findByRole('button', { name: '03 Discover' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Research question' }),
      'semantic communication pruning for edge deployment'
    )
    await user.selectOptions(screen.getByRole('combobox', { name: 'Search with' }), 'codex')
    await user.click(screen.getByRole('button', { name: 'Expand and search' }))
    await user.click(await screen.findByRole('button', { name: 'Papers 0' }))

    expect(screen.getByRole('heading', { name: 'No papers in this session.' })).toBeVisible()
    expect(screen.queryByText('discover/repo')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'GitHub repos 1' }))
    expect(screen.getByText('discover/repo')).toBeVisible()
  })

  it('shows Discover-saved results without requiring an Interests profile', async () => {
    const savedItem: DashboardSnapshot['savedItems'][number] = {
      id: 'arxiv:discover',
      source: 'arxiv',
      title: 'Saved directly from Discover',
      summary: 'A one-off semantic search result.',
      url: 'https://arxiv.org/abs/discover',
      publishedAt: '2026-08-14T00:00:00.000Z',
      score: 61,
      triageState: 'saved',
      reasons: ['Title matches “structured pruning”']
    }
    const api = createApi({ ...emptyDashboard, profileName: null, savedItems: [savedItem] })
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(await screen.findByRole('button', { name: '02 Saved' }))

    expect(screen.getByRole('heading', { name: 'Saved research signals' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Select signal: Saved directly from Discover' })
    ).toBeVisible()
  })

  it('restores the previously searched Discover sources from the latest session', async () => {
    const api = createApi({ ...emptyDashboard, profileName: 'Edge intelligence' })
    const latestDiscover: DiscoverSnapshot = {
      id: 'discover-session-1',
      intent: 'graph sparsity for radio edge learning',
      runner: 'claude',
      status: 'no_results',
      createdAt: '2026-08-15T12:00:00.000Z',
      plan: {
        version: 'discover-plan-v1',
        intentSummary: 'Search graph sparsity work in arXiv only.',
        arxiv: {
          categories: ['cs.LG'],
          keywords: ['graph sparsity'],
          excludeKeywords: []
        },
        github: { keywords: [], topics: [], languages: [] },
        rationale: 'Keep the previous run limited to arXiv.'
      },
      provenance: {
        providerId: 'local-agent:claude',
        providerName: 'Claude Code',
        model: 'claude-code',
        promptVersion: 'semantic-discover-v1',
        inputHash: 'b'.repeat(64),
        createdAt: '2026-08-15T12:00:00.000Z'
      },
      sourceOutcomes: {
        arxiv: { status: 'no_results', resultCount: 0, error: null },
        github: { status: 'not_searched', resultCount: 0, error: null }
      },
      counts: { total: 0, arxiv: 0, github: 0 },
      items: []
    }
    vi.mocked(api.getLatestDiscover).mockResolvedValue(latestDiscover)
    const user = userEvent.setup()

    render(<App api={api} />)

    await user.click(await screen.findByRole('button', { name: '03 Discover' }))

    const arxivToggle = screen.getByRole('checkbox', { name: 'Search arXiv' })
    const githubToggle = screen.getByRole('checkbox', { name: 'Search GitHub' })
    expect(arxivToggle).toBeChecked()
    expect(githubToggle).not.toBeChecked()
    expect(screen.getByRole('combobox', { name: 'Search with' })).toHaveValue('claude')
    expect(screen.getByRole('textbox', { name: 'Research question' })).toHaveValue(
      'graph sparsity for radio edge learning'
    )
  })

  it('refreshes automatically when the configured radar has not run on the dashboard day', async () => {
    const staleDashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Edge intelligence',
      lastRefreshAt: '2026-08-14T18:00:00.000Z',
      counts: { total: 1, arxiv: 1, github: 0, unread: 1 },
      items: [
        {
          id: 'arxiv:old',
          source: 'arxiv',
          title: 'Previous daily signal',
          summary: 'The last verified inbox remains visible while refreshing.',
          url: 'https://arxiv.org/abs/old',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 10,
          triageState: 'new',
          reasons: ['Previous match']
        }
      ]
    }
    const refreshedDashboard: DashboardSnapshot = {
      ...staleDashboard,
      lastRefreshAt: '2026-08-15T08:05:00.000Z',
      items: [{ ...staleDashboard.items[0]!, title: 'Fresh daily signal' }]
    }
    const api = createApi(staleDashboard)
    vi.mocked(api.refresh).mockResolvedValue(refreshedDashboard)

    render(<App api={api} />)

    await waitFor(() => expect(api.refresh).toHaveBeenCalledOnce())
    expect(
      await screen.findByRole('button', { name: 'Select signal: Fresh daily signal' })
    ).toBeVisible()
  })

  it('keeps the last verified inbox when the automatic daily refresh fails', async () => {
    const staleDashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Edge intelligence',
      lastRefreshAt: '2026-08-14T18:00:00.000Z',
      counts: { total: 1, arxiv: 1, github: 0, unread: 1 },
      items: [
        {
          id: 'arxiv:old',
          source: 'arxiv',
          title: 'Last verified signal',
          summary: 'Preserved after a source failure.',
          url: 'https://arxiv.org/abs/old',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 10,
          triageState: 'new',
          reasons: ['Previous match']
        }
      ]
    }
    const api = createApi(staleDashboard)
    vi.mocked(api.refresh).mockRejectedValue(new Error('offline'))

    render(<App api={api} />)

    expect(
      await screen.findByRole('button', { name: 'Select signal: Last verified signal' })
    ).toBeVisible()
    expect(
      await screen.findByText('Refresh failed. Your previous inbox is still available.')
    ).toBeVisible()
  })

  it('configures the first research radar from onboarding', async () => {
    const configured = { ...emptyDashboard, profileName: 'My research' }
    const api = createApi(emptyDashboard)
    vi.mocked(api.saveInterestProfile).mockResolvedValue(configured)
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(await screen.findByRole('button', { name: 'Set research interests' }))
    await user.type(screen.getByRole('textbox', { name: 'Profile name' }), 'My research')
    await user.type(screen.getByRole('textbox', { name: 'arXiv categories' }), 'cs.LG, cs.NI')
    await user.type(
      screen.getByRole('textbox', { name: 'arXiv keywords' }),
      'structured pruning, edge intelligence'
    )
    await user.type(
      screen.getByRole('textbox', { name: 'GitHub topics' }),
      'model-compression, edge-ai'
    )
    await user.click(screen.getByRole('button', { name: 'Save research radar' }))

    expect(api.saveInterestProfile).toHaveBeenCalledWith({
      name: 'My research',
      arxiv: {
        categories: ['cs.LG', 'cs.NI'],
        keywords: ['structured pruning', 'edge intelligence'],
        excludeKeywords: []
      },
      github: {
        keywords: [],
        topics: ['model-compression', 'edge-ai'],
        languages: []
      }
    })
    expect(await screen.findByText('My research')).toBeVisible()
  })

  it('toggles a recommended signal between saved and viewed through the local triage API', async () => {
    const dashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Edge intelligence',
      counts: { total: 1, arxiv: 1, github: 0, unread: 1 },
      items: [
        {
          id: 'arxiv:2608.00001',
          source: 'arxiv',
          title: 'Structured pruning for edge deployment',
          summary: 'A resource-aware pruning method.',
          url: 'https://arxiv.org/abs/2608.00001',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 62,
          triageState: 'new',
          reasons: ['Title matches “structured pruning”']
        }
      ]
    }
    const savedDashboard: DashboardSnapshot = {
      ...dashboard,
      counts: { ...dashboard.counts, unread: 0 },
      items: [{ ...dashboard.items[0]!, triageState: 'saved' }]
    }
    const api = createApi(dashboard)
    vi.mocked(api.setTriageState).mockResolvedValue(savedDashboard)
    const user = userEvent.setup()
    render(<App api={api} />)

    const unsavedButton = await screen.findByRole('button', {
      name: 'Save signal',
      pressed: false
    })
    expect(unsavedButton).not.toHaveTextContent(/Save/i)
    expect(unsavedButton.querySelector('[data-save-star]')).toHaveAttribute('fill', 'none')

    await user.click(unsavedButton)

    expect(api.setTriageState).toHaveBeenCalledWith('arxiv:2608.00001', 'saved')
    const savedButton = await screen.findByRole('button', {
      name: 'Save signal',
      pressed: true
    })
    expect(savedButton).toBeEnabled()
    expect(savedButton).toHaveAttribute('aria-pressed', 'true')
    expect(savedButton).not.toHaveTextContent(/Saved/i)
    expect(savedButton.querySelector('[data-save-star]')).toHaveAttribute('fill', 'currentColor')

    vi.mocked(api.setTriageState).mockResolvedValue({
      ...dashboard,
      counts: { ...dashboard.counts, unread: 0 },
      items: [{ ...dashboard.items[0]!, triageState: 'viewed' }]
    })
    await user.click(savedButton)

    expect(api.setTriageState).toHaveBeenLastCalledWith('arxiv:2608.00001', 'viewed')
    const restoredButton = await screen.findByRole('button', {
      name: 'Save signal',
      pressed: false
    })
    expect(restoredButton).toBeVisible()
    expect(restoredButton.querySelector('[data-save-star]')).toHaveAttribute('fill', 'none')
  })

  it('shows saved arXiv papers and GitHub repositories in a dedicated navigation view', async () => {
    const dashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Research',
      counts: { total: 3, arxiv: 2, github: 1, unread: 1 },
      items: [
        {
          id: 'arxiv:saved',
          source: 'arxiv',
          title: 'Saved paper',
          summary: 'Paper summary.',
          url: 'https://arxiv.org/abs/saved',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 20,
          triageState: 'saved',
          reasons: ['Saved paper reason']
        },
        {
          id: 'github:saved',
          source: 'github',
          title: 'Saved repository',
          summary: 'Repository summary.',
          url: 'https://github.com/owner/saved',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 18,
          triageState: 'saved',
          reasons: ['Saved repository reason']
        },
        {
          id: 'arxiv:new',
          source: 'arxiv',
          title: 'Unsaved paper',
          summary: 'New paper summary.',
          url: 'https://arxiv.org/abs/new',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 16,
          triageState: 'new',
          reasons: ['New paper reason']
        }
      ]
    }
    const user = userEvent.setup()
    render(<App api={createApi(dashboard)} />)

    await user.click(await screen.findByRole('button', { name: '02 Saved' }))

    expect(screen.getByRole('heading', { name: 'Saved research signals' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Select signal: Saved paper' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Select signal: Saved repository' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Select signal: Unsaved paper' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show arXiv only' }))
    expect(screen.getByRole('button', { name: 'Select signal: Saved paper' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Select signal: Saved repository' })
    ).not.toBeInTheDocument()
  })

  it('removes a saved signal from the saved shelf when the saved control is clicked again', async () => {
    const dashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Research',
      counts: { total: 1, arxiv: 1, github: 0, unread: 0 },
      items: [
        {
          id: 'arxiv:saved',
          source: 'arxiv',
          title: 'Saved paper',
          summary: 'Paper summary.',
          url: 'https://arxiv.org/abs/saved',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 20,
          triageState: 'saved',
          reasons: ['Saved paper reason']
        }
      ]
    }
    const unsavedDashboard: DashboardSnapshot = {
      ...dashboard,
      items: [{ ...dashboard.items[0]!, triageState: 'viewed' }]
    }
    const api = createApi(dashboard)
    vi.mocked(api.setTriageState).mockResolvedValue(unsavedDashboard)
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(await screen.findByRole('button', { name: '02 Saved' }))
    await user.click(screen.getByRole('button', { name: 'Save signal', pressed: true }))

    expect(api.setTriageState).toHaveBeenCalledWith('arxiv:saved', 'viewed')
    expect(await screen.findByRole('heading', { name: 'No saved signals yet.' })).toBeVisible()
    expect(screen.queryByText('Saved paper')).not.toBeInTheDocument()
  })

  it('keeps a saved signal on a failed removal and clears the error after a successful retry', async () => {
    const savedDashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Research',
      counts: { total: 1, arxiv: 1, github: 0, unread: 0 },
      items: [
        {
          id: 'arxiv:saved',
          source: 'arxiv',
          title: 'Saved paper',
          summary: 'Paper summary.',
          url: 'https://arxiv.org/abs/saved',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 20,
          triageState: 'saved',
          reasons: ['Saved paper reason']
        }
      ]
    }
    const api = createApi(savedDashboard)
    vi.mocked(api.setTriageState).mockRejectedValueOnce(new Error('database busy'))
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(await screen.findByRole('button', { name: '02 Saved' }))
    const savedButton = screen.getByRole('button', { name: 'Save signal', pressed: true })
    await user.click(savedButton)

    expect(
      await screen.findByText(
        'The item state could not be updated. The local index was not changed.'
      )
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Select signal: Saved paper' })).toBeVisible()
    expect(savedButton).toBeEnabled()

    vi.mocked(api.setTriageState).mockResolvedValue({
      ...savedDashboard,
      items: [{ ...savedDashboard.items[0]!, triageState: 'viewed' }]
    })
    await user.click(savedButton)

    expect(await screen.findByRole('heading', { name: 'No saved signals yet.' })).toBeVisible()
    expect(
      screen.queryByText('The item state could not be updated. The local index was not changed.')
    ).not.toBeInTheDocument()
  })

  it('configures a user-selected OpenAI-compatible model endpoint', async () => {
    const api = createApi(emptyDashboard)
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(await screen.findByRole('button', { name: '05 Models & Agents' }))
    await user.type(screen.getByRole('textbox', { name: 'Provider name' }), 'DeepSeek')
    await user.type(
      screen.getByRole('textbox', { name: 'Provider base URL' }),
      'https://api.deepseek.com'
    )
    await user.type(screen.getByRole('textbox', { name: 'Model name' }), 'deepseek-chat')
    await user.type(screen.getByLabelText('API key'), placeholderCredential)
    await user.click(screen.getByRole('button', { name: 'Save model provider' }))

    expect(api.saveModelProvider).toHaveBeenCalledWith({
      name: 'DeepSeek',
      protocol: 'openai-compatible',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      apiKey: placeholderCredential
    })
    expect(await screen.findByText('Credential protected by macOS')).toBeVisible()
  })

  it('does not expose account login or synchronization settings', async () => {
    render(<App api={createApi({ ...emptyDashboard, profileName: 'Research' })} />)

    await screen.findByRole('heading', { name: "Today's research signal" })
    expect(screen.queryByRole('button', { name: /Sync/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Google Drive/i)).not.toBeInTheDocument()
  })

  it('opens the enabled Data Analytics surface from primary navigation', async () => {
    const api = createApi({ ...emptyDashboard, profileName: 'Research' })
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(await screen.findByRole('button', { name: '06 Data Analytics' }))

    expect(await screen.findByRole('heading', { name: 'Data Analytics' })).toBeVisible()
    expect(api.getAnalytics).toHaveBeenCalledOnce()
  })

  it('shows a provenance-bearing model analysis for a signal', async () => {
    const dashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Edge intelligence',
      counts: { total: 1, arxiv: 1, github: 0, unread: 1 },
      items: [
        {
          id: 'arxiv:2608.00001',
          source: 'arxiv',
          kind: 'paper',
          title: 'Structured pruning for edge deployment',
          summary: 'A resource-aware pruning method.',
          url: 'https://arxiv.org/abs/2608.00001',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 62,
          triageState: 'new',
          reasons: ['Title matches “structured pruning”']
        }
      ]
    }
    const artifact: AnalysisArtifact = {
      id: 'analysis-1',
      itemId: 'arxiv:2608.00001',
      providerId: 'default',
      providerName: 'DeepSeek',
      model: 'deepseek-chat',
      promptVersion: 'llm-wiki-paper-l1-v1',
      sourceHash: 'edc71265ddad97262e686e86523de7ae647accbd0ca09853baa3ec2aef42bec2',
      content:
        '## 快速决策卡\n\n| 维度 | 结论 |\n| --- | --- |\n| Research fit | direct |\n\n## TL;DR\n\nHighly relevant to structured pruning.',
      createdAt: '2026-08-15T12:00:00.000Z'
    }
    const api = createApi(dashboard)
    vi.mocked(api.analyzeItem).mockResolvedValue(artifact)
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(await screen.findByRole('button', { name: 'Analyze signal' }))

    expect(api.analyzeItem).toHaveBeenCalledWith('arxiv:2608.00001', 'model-provider')
    expect(await screen.findByText(/Highly relevant to structured pruning/)).toBeVisible()
    expect(screen.getByText('DeepSeek · deepseek-chat')).toBeVisible()
    expect(screen.getByText(/source edc71265ddad/)).toBeVisible()
    const detail = screen.getByRole('article', { name: 'Selected signal details' })
    const summary = within(detail).getByText('A resource-aware pruning method.')
    const l1Analysis = within(detail).getByRole('complementary', {
      name: 'L1 paper analysis result'
    })
    expect(summary.compareDocumentPosition(l1Analysis) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(within(l1Analysis).getByText('L1 PAPER ANALYSIS')).toBeVisible()
    expect(within(l1Analysis).getByRole('heading', { name: '快速决策卡', level: 3 })).toBeVisible()
    expect(within(l1Analysis).getByRole('table')).toBeVisible()
    expect(within(l1Analysis).getByRole('cell', { name: 'direct' })).toBeVisible()
  })

  it('restores the latest persisted analysis for the selected signal', async () => {
    const dashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Edge intelligence',
      counts: { total: 1, arxiv: 1, github: 0, unread: 0 },
      items: [
        {
          id: 'arxiv:persisted',
          source: 'arxiv',
          kind: 'paper',
          title: 'Persisted analysis paper',
          summary: 'A paper with prior analysis.',
          url: 'https://arxiv.org/abs/persisted',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 62,
          triageState: 'viewed',
          reasons: ['Previously analyzed']
        }
      ]
    }
    const artifact: AnalysisArtifact = {
      id: 'analysis-persisted',
      itemId: 'arxiv:persisted',
      providerId: 'local-agent:codex',
      providerName: 'Codex CLI',
      model: 'codex-cli',
      promptVersion: 'llm-wiki-paper-l1-v1',
      sourceHash: 'd'.repeat(64),
      content: 'Persisted local analysis restored.',
      createdAt: '2026-08-15T12:00:00.000Z'
    }
    const api = createApi(dashboard)
    vi.mocked(api.getLatestAnalysis).mockResolvedValue(artifact)
    render(<App api={api} />)

    await waitFor(() => {
      expect(api.getLatestAnalysis).toHaveBeenCalledWith('arxiv:persisted')
    })
    expect(await screen.findByText('Persisted local analysis restored.')).toBeVisible()
  })

  it('lets the user invoke a detected local Codex or Claude runner from the inbox', async () => {
    const dashboard: DashboardSnapshot = {
      ...emptyDashboard,
      profileName: 'Edge intelligence',
      counts: { total: 1, arxiv: 1, github: 0, unread: 1 },
      items: [
        {
          id: 'arxiv:2608.00001',
          source: 'arxiv',
          kind: 'paper',
          title: 'Structured pruning for edge deployment',
          summary: 'A resource-aware pruning method.',
          url: 'https://arxiv.org/abs/2608.00001',
          publishedAt: '2026-08-14T00:00:00.000Z',
          score: 62,
          triageState: 'new',
          reasons: ['Title matches “structured pruning”']
        }
      ]
    }
    const artifact: AnalysisArtifact = {
      id: 'analysis-codex',
      itemId: 'arxiv:2608.00001',
      providerId: 'local-agent:codex',
      providerName: 'Codex CLI',
      model: 'codex-cli',
      promptVersion: 'llm-wiki-paper-l1-v1',
      sourceHash: 'edc71265ddad97262e686e86523de7ae647accbd0ca09853baa3ec2aef42bec2',
      content: '## Research fit\nCodex analysis completed.',
      createdAt: '2026-08-15T12:00:00.000Z'
    }
    const api = createApi(dashboard)
    vi.mocked(api.analyzeItem).mockResolvedValue(artifact)
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Analysis runner' }),
      'codex'
    )
    await user.click(screen.getByRole('button', { name: 'Analyze signal' }))

    expect(api.analyzeItem).toHaveBeenCalledWith('arxiv:2608.00001', 'codex')
    expect(await screen.findByText(/Codex analysis completed/)).toBeVisible()
    expect(screen.getByText('Codex CLI · codex-cli')).toBeVisible()
  })

  it('opens the complete source catalog from the application navigation', async () => {
    const user = userEvent.setup()
    render(<App api={createApi(emptyDashboard)} />)

    await user.click(screen.getByRole('button', { name: '07 Sources' }))

    expect(await screen.findByRole('heading', { name: '105 research sources' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'arXiv' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Pending integrations.*82/i }))
    expect(screen.getByRole('heading', { name: 'NVIDIA Developer Technical Blog' })).toBeVisible()
  })
})

// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DashboardSnapshot, TheRSSApi } from '../../shared/api'
import type { AnalysisArtifact } from '../../shared/models'
import { App } from './App'

const emptyDashboard: DashboardSnapshot = {
  date: '2026-08-15',
  profileName: null,
  lastRefreshAt: null,
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
  items: []
}

const placeholderCredential = ['placeholder', 'value'].join('-')

function createApi(snapshot: DashboardSnapshot): TheRSSApi {
  return {
    getDashboard: vi.fn().mockResolvedValue(snapshot),
    getInterestProfile: vi.fn().mockResolvedValue(null),
    saveInterestProfile: vi.fn().mockResolvedValue(snapshot),
    refresh: vi.fn().mockResolvedValue(snapshot),
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
    analyzeItem: vi.fn(),
    getLatestAnalysis: vi.fn().mockResolvedValue(null)
  }
}

describe('App', () => {
  it('presents a focused onboarding state when no interest profile exists', async () => {
    render(<App api={createApi(emptyDashboard)} />)

    expect(await screen.findByRole('heading', { name: 'Build your research radar' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Set research interests' })).toBeVisible()
    expect(screen.getByText('TheRSS')).toBeVisible()
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

    render(<App api={createApi(dashboard)} />)

    expect(await screen.findByText('Structured pruning for edge deployment')).toBeVisible()
    expect(screen.getByText('owner/repo')).toBeVisible()
    expect(screen.getByText('Title matches “structured pruning”')).toBeVisible()
    expect(screen.getByText('GitHub topic model-compression')).toBeVisible()
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

    await screen.findByText('Repository signal')
    await user.click(screen.getByRole('button', { name: 'Show arXiv only' }))

    expect(screen.getByText('Paper signal')).toBeVisible()
    expect(screen.queryByText('Repository signal')).not.toBeInTheDocument()
  })

  it('refreshes the dashboard from the visible action', async () => {
    const api = createApi({ ...emptyDashboard, profileName: 'Edge intelligence' })
    const user = userEvent.setup()
    render(<App api={api} />)

    await screen.findByRole('heading', { name: "Today's research signal" })
    await user.click(screen.getByRole('button', { name: 'Refresh sources' }))

    expect(api.refresh).toHaveBeenCalledOnce()
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

  it('saves a recommended signal through the local triage API', async () => {
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

    await user.click(await screen.findByRole('button', { name: 'Save signal' }))

    expect(api.setTriageState).toHaveBeenCalledWith('arxiv:2608.00001', 'saved')
    expect(await screen.findByRole('button', { name: 'Saved' })).toBeDisabled()
  })

  it('configures a user-selected OpenAI-compatible model endpoint', async () => {
    const api = createApi(emptyDashboard)
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(await screen.findByRole('button', { name: '04 Models & Agents' }))
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

  it('shows a provenance-bearing model analysis for a signal', async () => {
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
    const artifact: AnalysisArtifact = {
      id: 'analysis-1',
      itemId: 'arxiv:2608.00001',
      providerId: 'default',
      providerName: 'DeepSeek',
      model: 'deepseek-chat',
      promptVersion: 'discovery-analysis-v1',
      content: '## Research fit\nHighly relevant to structured pruning.',
      createdAt: '2026-08-15T12:00:00.000Z'
    }
    const api = createApi(dashboard)
    vi.mocked(api.analyzeItem).mockResolvedValue(artifact)
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(await screen.findByRole('button', { name: 'Analyze signal' }))

    expect(api.analyzeItem).toHaveBeenCalledWith('arxiv:2608.00001')
    expect(await screen.findByText(/Highly relevant to structured pruning/)).toBeVisible()
    expect(screen.getByText('DeepSeek · deepseek-chat')).toBeVisible()
  })
})

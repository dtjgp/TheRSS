// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DashboardSnapshot, TheRSSApi } from '../../shared/api'
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

function createApi(snapshot: DashboardSnapshot): TheRSSApi {
  return {
    getDashboard: vi.fn().mockResolvedValue(snapshot),
    getInterestProfile: vi.fn().mockResolvedValue(null),
    saveInterestProfile: vi.fn().mockResolvedValue(snapshot),
    refresh: vi.fn().mockResolvedValue(snapshot),
    setTriageState: vi.fn().mockResolvedValue(snapshot)
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
})

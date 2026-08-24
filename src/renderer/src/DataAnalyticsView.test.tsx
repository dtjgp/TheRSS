// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AnalyticsSnapshot } from '../../shared/analytics'
import type { TheRSSApi } from '../../shared/api'
import { DataAnalyticsView } from './DataAnalyticsView'

const snapshot: AnalyticsSnapshot = {
  generatedAt: '2026-08-17T12:00:00.000Z',
  windowDays: 7,
  trackingStartedAt: '2026-08-15T09:01:00.000Z',
  totals: {
    searchResults: 20,
    todayResults: 12,
    discoverResults: 8,
    deepAnalyses: 2,
    analyzedPapers: 1
  },
  daily: [
    {
      date: '2026-08-16',
      searchResults: 11,
      todayResults: 8,
      discoverResults: 3,
      deepAnalyses: 1
    },
    {
      date: '2026-08-17',
      searchResults: 3,
      todayResults: 1,
      discoverResults: 2,
      deepAnalyses: 1
    }
  ],
  analyzedItems: [
    {
      analysisId: 'analysis-2',
      itemId: 'github:owner/repo',
      source: 'github',
      title: 'owner/repo',
      url: 'https://github.com/owner/repo',
      providerName: 'Codex CLI',
      model: 'codex-cli',
      createdAt: '2026-08-17T11:00:00.000Z'
    },
    {
      analysisId: 'analysis-1',
      itemId: 'arxiv:2608.00001',
      source: 'arxiv',
      title: 'Structured pruning for edge deployment',
      url: 'https://arxiv.org/abs/2608.00001',
      providerName: 'DeepSeek',
      model: 'deepseek-chat',
      createdAt: '2026-08-16T10:00:00.000Z'
    }
  ]
}

function apiWith(getAnalytics: TheRSSApi['getAnalytics']): TheRSSApi {
  return { getAnalytics } as TheRSSApi
}

describe('DataAnalyticsView', () => {
  it('shows separated daily search volume and the analyzed-item history', async () => {
    render(<DataAnalyticsView api={apiWith(vi.fn().mockResolvedValue(snapshot))} />)

    expect(await screen.findByRole('heading', { name: 'Data Analytics' })).toBeVisible()
    const summary = screen.getByRole('group', { name: 'Analytics summary' })
    expect(within(summary).getByLabelText('Lifetime returned records')).toHaveTextContent('20')
    expect(within(summary).getByLabelText('Lifetime returned records')).toHaveTextContent(
      '12 legacy Today · 8 Discover'
    )
    expect(within(summary).getByLabelText('Lifetime returned records')).toHaveTextContent(
      '14 in last 7 local days'
    )
    expect(within(summary).getByLabelText('Deep analyses')).toHaveTextContent('2')
    expect(within(summary).getByLabelText('Analyzed papers')).toHaveTextContent('1')

    const daily = screen.getByRole('table', { name: 'Daily search and analysis activity' })
    expect(within(daily).getByRole('columnheader', { name: 'Legacy Today' })).toBeVisible()
    expect(within(daily).getByRole('row', { name: /2026-08-16 8 3 11 1/ })).toBeVisible()
    expect(within(daily).getByRole('row', { name: /2026-08-17 1 2 3 1/ })).toBeVisible()

    const history = screen.getByRole('list', { name: 'Deep analysis history' })
    expect(within(history).getByText('Structured pruning for edge deployment')).toBeVisible()
    expect(within(history).getByText('owner/repo')).toBeVisible()
    expect(within(history).getByText('DeepSeek · deepseek-chat')).toBeVisible()
    expect(within(history).getByText('Codex CLI · codex-cli')).toBeVisible()
    expect(screen.getByText(/repeated refreshes may include the same result again/i)).toBeVisible()
  })

  it('shows honest empty states when no activity has been recorded', async () => {
    render(
      <DataAnalyticsView
        api={apiWith(
          vi.fn().mockResolvedValue({
            ...snapshot,
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
          })
        )}
      />
    )

    expect(await screen.findByText('No search activity recorded yet.')).toBeVisible()
    expect(screen.getByText('No deep analyses recorded yet.')).toBeVisible()
    expect(
      screen.getByText(/Legacy Today history starts when this analytics version records it/i)
    ).toBeVisible()
  })

  it('offers a retry when the local analytics query fails', async () => {
    const getAnalytics = vi
      .fn<TheRSSApi['getAnalytics']>()
      .mockRejectedValueOnce(new Error('database busy'))
      .mockResolvedValueOnce(snapshot)
    const user = userEvent.setup()
    render(<DataAnalyticsView api={apiWith(getAnalytics)} />)

    expect(await screen.findByText('The local analytics could not be loaded.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Retry analytics' }))

    expect(await screen.findByLabelText('Lifetime returned records')).toHaveTextContent('20')
    expect(getAnalytics).toHaveBeenCalledTimes(2)
  })
})

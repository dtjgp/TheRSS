// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DashboardItem } from '../../shared/api'
import { DailyStream } from './DailyStream'

const olderPaper: DashboardItem = {
  id: 'arxiv:older',
  source: 'arxiv',
  kind: 'paper',
  title: 'An older paper in today’s edition',
  summary: 'Paper summary.',
  url: 'https://arxiv.org/abs/older',
  publishedAt: '2026-08-17T08:00:00.000Z',
  score: 72,
  triageState: 'saved',
  reasons: ['Interest match']
}

const newerRepository: DashboardItem = {
  id: 'github:newer/repository',
  source: 'github',
  kind: 'repository',
  title: 'newer/repository',
  summary: 'Repository summary.',
  url: 'https://github.com/newer/repository',
  publishedAt: '2026-08-18T12:00:00.000Z',
  score: 58,
  triageState: 'new',
  reasons: ['Topic match']
}

describe('DailyStream', () => {
  it('shows every item in the current Today edition in publication order without mutating input', () => {
    const items = [olderPaper, newerRepository] as const

    render(
      <DailyStream
        items={items}
        dashboardDate="2026-08-19"
        lastRefreshAt="2026-08-19T08:15:00.000Z"
        selectedItemId={olderPaper.id}
        onSelect={vi.fn()}
      />
    )

    const stream = screen.getByRole('complementary', { name: 'Daily stream' })
    const entries = within(stream).getAllByRole('button')
    expect(entries).toHaveLength(2)
    expect(entries[0]).toHaveAccessibleName('Open in daily workspace: newer/repository')
    expect(entries[1]).toHaveAccessibleName(
      'Open in daily workspace: An older paper in today’s edition'
    )
    expect(items.map((item) => item.id)).toEqual(['arxiv:older', 'github:newer/repository'])
    expect(within(stream).getByText('2 returned')).toBeVisible()
    expect(within(stream).getByText('1 unread')).toBeVisible()
    expect(within(stream).getByText('2 sources')).toBeVisible()
    expect(within(stream).getByRole('heading', { name: 'GitHub1' })).toBeVisible()
    expect(within(stream).getByRole('heading', { name: 'arXiv1' })).toBeVisible()
  })

  it('marks the synchronized item and opens a selected stream entry', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()

    render(
      <DailyStream
        items={[olderPaper, newerRepository]}
        dashboardDate="2026-08-19"
        lastRefreshAt={null}
        selectedItemId={olderPaper.id}
        onSelect={onSelect}
      />
    )

    expect(
      screen.getByRole('button', {
        name: 'Open in daily workspace: An older paper in today’s edition'
      })
    ).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('Not refreshed yet')).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: 'Open in daily workspace: newer/repository' })
    )

    expect(onSelect).toHaveBeenCalledWith(newerRepository)
  })

  it('keeps the daily overview explicit when the current edition is empty', () => {
    render(
      <DailyStream
        items={[]}
        dashboardDate="2026-08-19"
        lastRefreshAt="2026-08-19T08:15:00.000Z"
        selectedItemId={null}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('No returned items in this edition.')).toBeVisible()
  })
})

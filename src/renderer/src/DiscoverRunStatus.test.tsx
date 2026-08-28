// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DiscoverRunProgress } from '../../shared/discover'
import { createDiscoverSnapshot } from './App.testSupport'
import { DiscoverRunStatus, DiscoverRunSummary } from './DiscoverRunStatus'

function progress(overrides: Partial<DiscoverRunProgress> = {}): DiscoverRunProgress {
  return {
    runId: 'discover-run-ui-test',
    phase: 'planning',
    completedSources: 0,
    totalSources: 22,
    source: null,
    outcome: null,
    ...overrides
  }
}

describe('DiscoverRunStatus', () => {
  it('shows a truthful three-stage planning pipeline before source requests begin', () => {
    render(<DiscoverRunStatus progress={progress()} onCancel={vi.fn()} />)

    const pipeline = screen.getByRole('region', { name: 'Discover run pipeline' })
    const status = within(pipeline).getByRole('status', { name: 'Discover run progress' })
    const stages = within(status).getByRole('list', { name: 'Discover run stages' })
    const stageItems = within(stages).getAllByRole('listitem')
    expect(stageItems).toHaveLength(3)
    expect(stageItems[0]!).toHaveAttribute('data-state', 'current')
    expect(stageItems[0]!).toHaveTextContent('Plan query')
    expect(stageItems[0]!).toHaveTextContent('Validating a bounded source plan')
    expect(stageItems[1]!).toHaveAttribute('data-state', 'waiting')
    expect(stageItems[1]!).toHaveTextContent('22 sources are queued independently')
    expect(stageItems[2]!).toHaveAttribute('data-state', 'waiting')
    expect(status).toHaveTextContent('No source request starts before plan validation.')
    expect(within(status).queryByRole('button')).not.toBeInTheDocument()
    expect(within(pipeline).getByRole('button', { name: 'Cancel Discover search' })).toBeVisible()
  })

  it('exposes native source progress and the latest completed source outcome', () => {
    render(
      <DiscoverRunStatus
        progress={progress({
          phase: 'searching',
          completedSources: 3,
          source: 'arxiv',
          outcome: { status: 'healthy', resultCount: 2, error: null }
        })}
        onCancel={vi.fn()}
      />
    )

    const status = screen.getByRole('status', { name: 'Discover run progress' })
    const stageItems = within(status).getAllByRole('listitem')
    expect(stageItems[0]!).toHaveAttribute('data-state', 'complete')
    expect(stageItems[1]!).toHaveAttribute('data-state', 'current')
    expect(stageItems[1]!).toHaveTextContent('arXiv complete · 2 results')
    expect(
      within(stageItems[1]!).getByRole('progressbar', { name: 'Source search progress' })
    ).toHaveAttribute('value', '3')
    expect(
      within(stageItems[1]!).getByRole('progressbar', { name: 'Source search progress' })
    ).toHaveAttribute('max', '22')
    expect(status).toHaveTextContent('Completed source outcomes are retained independently.')
  })

  it('moves to session assembly after every selected source has finished', () => {
    render(
      <DiscoverRunStatus
        progress={progress({
          phase: 'searching',
          completedSources: 22,
          source: 'github',
          outcome: { status: 'no_results', resultCount: 0, error: null }
        })}
        onCancel={vi.fn()}
      />
    )

    const stageItems = screen.getAllByRole('listitem')
    expect(stageItems[1]!).toHaveAttribute('data-state', 'complete')
    expect(stageItems[2]!).toHaveAttribute('data-state', 'current')
    expect(stageItems[2]!).toHaveTextContent('Ranking, deduplicating, and persisting results')
  })

  it('labels cancellation explicitly and disables duplicate cancel requests', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <DiscoverRunStatus
        progress={progress({ phase: 'searching', completedSources: 2 })}
        onCancel={onCancel}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Cancel Discover search' }))
    expect(onCancel).toHaveBeenCalledOnce()

    rerender(
      <DiscoverRunStatus
        progress={progress({ phase: 'cancel_requested', completedSources: 2 })}
        onCancel={onCancel}
      />
    )
    expect(screen.getByRole('status', { name: 'Discover run progress' })).toHaveTextContent(
      'Canceling Discover search'
    )
    expect(screen.getByRole('button', { name: 'Cancel Discover search' })).toBeDisabled()
  })
})

describe('DiscoverRunSummary', () => {
  it('summarizes a persisted completed session without inventing intermediate facts', () => {
    render(<DiscoverRunSummary snapshot={{ ...createDiscoverSnapshot(), status: 'completed' }} />)

    const summary = screen.getByRole('group', { name: 'Recorded Discover run summary' })
    expect(summary).toHaveTextContent('Plan ready')
    expect(summary).toHaveTextContent('22 sources')
    expect(summary).toHaveTextContent('3 records')
    expect(
      screen.queryByRole('list', { name: 'Recorded Discover run stages' })
    ).not.toBeInTheDocument()
  })

  it('retains partial and canceled evidence states in the terminal source stage', () => {
    const snapshot = createDiscoverSnapshot()
    const { rerender } = render(<DiscoverRunSummary snapshot={snapshot} />)
    expect(screen.getByText('22 sources need attention')).toHaveAttribute('data-state', 'attention')

    rerender(<DiscoverRunSummary snapshot={{ ...snapshot, status: 'canceled' }} />)
    expect(screen.getByText('22 sources stopped')).toHaveAttribute('data-state', 'stopped')
  })
})

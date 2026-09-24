import { describe, expect, it } from 'vitest'
import { describeDiscoverRun } from './discoverRunProgress'
import type { DiscoverProgress } from './discover'

const base: DiscoverProgress = {
  phase: 'planning',
  completedSources: 0,
  totalSources: 22,
  source: null,
  outcome: null
}

describe('Discover run progress model', () => {
  it('shows an indeterminate planning stage before any source request', () => {
    expect(describeDiscoverRun(base)).toEqual({
      headline: 'Expanding research intent',
      stageLine: 'Step 1 of 3: Plan query',
      detail: 'No source request starts before plan validation.',
      determinate: null
    })
  })

  it('counts finished sources and names the latest completed outcome', () => {
    expect(
      describeDiscoverRun({
        ...base,
        phase: 'searching',
        completedSources: 3,
        source: 'arxiv',
        outcome: { status: 'healthy', resultCount: 1, error: null }
      })
    ).toEqual({
      headline: 'Searching selected sources',
      stageLine: 'Step 2 of 3: Search selected sources',
      detail: 'arXiv complete · 1 result',
      determinate: { completed: 3, total: 22 }
    })
    expect(describeDiscoverRun({ ...base, phase: 'searching' }).detail).toBe(
      '22 sources are queued independently'
    )
  })

  it('moves to an indeterminate assembly stage once every source finished', () => {
    expect(
      describeDiscoverRun({
        ...base,
        phase: 'searching',
        completedSources: 22,
        source: 'github',
        outcome: { status: 'no_results', resultCount: 0, error: null }
      })
    ).toMatchObject({
      headline: 'Assembling the Discover session',
      stageLine: 'Step 3 of 3: Assemble session',
      detail: 'GitHub no results · 0 results',
      determinate: null
    })
  })

  it('keeps the finished count while a cancellation settles', () => {
    expect(
      describeDiscoverRun({ ...base, phase: 'cancel_requested', completedSources: 5 })
    ).toEqual({
      headline: 'Canceling Discover search',
      stageLine: 'Stopping; completed source outcomes are retained.',
      detail: '5 of 22 sources finished before the stop request',
      determinate: { completed: 5, total: 22 }
    })
  })
})

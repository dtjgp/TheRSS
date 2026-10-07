import type { DiscoverProgress, DiscoverSourceStatus } from './discover'
import { sourceDisplayName } from './sourceIdentity'

/** One truthful description of an active Discover run, shared by the native and Web routes. */
export interface DiscoverRunView {
  readonly headline: string
  readonly stageLine: string
  readonly detail: string
  /** Finished/selected source counts; null while the current stage has no countable unit. */
  readonly determinate: { readonly completed: number; readonly total: number } | null
}

export function discoverResultCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'result' : 'results'}`
}

export function discoverOutcomeLabel(status: DiscoverSourceStatus): string {
  if (status === 'healthy') return 'complete'
  if (status === 'no_results') return 'no results'
  if (status === 'not_searched') return 'not searched'
  return status.replace('_', ' ')
}

export function latestDiscoverSourceLabel(progress: DiscoverProgress): string {
  if (!progress.source || !progress.outcome)
    return `${progress.totalSources} sources are queued independently`
  return `${sourceDisplayName(progress.source)} ${discoverOutcomeLabel(progress.outcome.status)} · ${discoverResultCountLabel(progress.outcome.resultCount)}`
}

export function describeDiscoverRun(progress: DiscoverProgress): DiscoverRunView {
  const counts = { completed: progress.completedSources, total: progress.totalSources }
  if (progress.phase === 'cancel_requested')
    return {
      headline: 'Canceling Discover search',
      stageLine: 'Stopping; completed source outcomes are retained.',
      detail: `${counts.completed} of ${counts.total} sources finished before the stop request`,
      determinate: counts
    }
  if (progress.phase === 'planning')
    return {
      headline: 'Expanding research intent',
      stageLine: 'Step 1 of 3: Plan query',
      detail: 'No source request starts before plan validation.',
      determinate: null
    }
  if (counts.completed >= counts.total)
    return {
      headline: 'Assembling the Discover session',
      stageLine: 'Step 3 of 3: Assemble session',
      detail: latestDiscoverSourceLabel(progress),
      determinate: null
    }
  return {
    headline: 'Searching selected sources',
    stageLine: 'Step 2 of 3: Search selected sources',
    detail: latestDiscoverSourceLabel(progress),
    determinate: counts
  }
}

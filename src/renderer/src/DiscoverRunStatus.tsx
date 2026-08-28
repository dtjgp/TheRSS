import type {
  DiscoverRunProgress,
  DiscoverSnapshot,
  DiscoverSourceStatus
} from '../../shared/discover'
import { sourceDisplayName } from '../../shared/sourceIdentity'

type RunStageState = 'waiting' | 'current' | 'complete' | 'attention' | 'stopped'

interface DiscoverRunStatusProps {
  readonly progress: DiscoverRunProgress
  readonly onCancel: () => void
}

function resultCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'result' : 'results'}`
}

function outcomeLabel(status: DiscoverSourceStatus): string {
  if (status === 'healthy') return 'complete'
  if (status === 'no_results') return 'no results'
  if (status === 'not_searched') return 'not searched'
  return status.replace('_', ' ')
}

function latestSourceLabel(progress: DiscoverRunProgress): string {
  if (!progress.source || !progress.outcome) {
    return `${progress.totalSources} sources are queued independently`
  }
  return `${sourceDisplayName(progress.source)} ${outcomeLabel(progress.outcome.status)} · ${resultCountLabel(progress.outcome.resultCount)}`
}

function stageMarker(state: RunStageState, index: number): string {
  if (state === 'complete') return '✓'
  if (state === 'attention') return '!'
  if (state === 'stopped') return '–'
  return String(index)
}

function RunStage({
  index,
  title,
  description,
  state,
  value,
  children
}: {
  readonly index: number
  readonly title: string
  readonly description: string
  readonly state: RunStageState
  readonly value: string
  readonly children?: React.ReactNode
}) {
  return (
    <li className="discover-run-stage" data-state={state}>
      <span className="discover-run-stage__marker" aria-hidden="true">
        {stageMarker(state, index)}
      </span>
      <span className="discover-run-stage__copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <span className="discover-run-stage__value">{value}</span>
      {children}
    </li>
  )
}

export function DiscoverRunStatus({ progress, onCancel }: DiscoverRunStatusProps) {
  const isPlanning = progress.phase === 'planning'
  const isCancelRequested = progress.phase === 'cancel_requested'
  const allSourcesFinished =
    progress.phase === 'searching' && progress.completedSources >= progress.totalSources
  const planState: RunStageState = isCancelRequested
    ? 'stopped'
    : isPlanning
      ? 'current'
      : 'complete'
  const sourceState: RunStageState = isCancelRequested
    ? 'stopped'
    : isPlanning
      ? 'waiting'
      : allSourcesFinished
        ? 'complete'
        : 'current'
  const assembleState: RunStageState = allSourcesFinished ? 'current' : 'waiting'
  const headline = isCancelRequested
    ? 'Canceling Discover search'
    : isPlanning
      ? 'Expanding research intent'
      : allSourcesFinished
        ? 'Assembling the Discover session'
        : 'Searching selected sources'
  const supportingCopy = isPlanning
    ? 'No source request starts before plan validation.'
    : isCancelRequested
      ? 'Completed source outcomes remain retained while the run stops.'
      : 'Completed source outcomes are retained independently.'
  const sourceDescription = isCancelRequested
    ? `${progress.completedSources} of ${progress.totalSources} sources finished before the stop request`
    : latestSourceLabel(progress)

  return (
    <section className="discover-run-card" aria-label="Discover run pipeline">
      <div
        className="discover-run-card__body"
        role="status"
        aria-label="Discover run progress"
        aria-live="polite"
        aria-atomic="false"
      >
        <div className="discover-run-card__header">
          <strong>{headline}</strong>
          <span>{supportingCopy}</span>
        </div>
        <ol className="discover-run-stages" aria-label="Discover run stages">
          <RunStage
            index={1}
            title="Plan query"
            description={
              isCancelRequested ? 'The active run is stopping' : 'Validating a bounded source plan'
            }
            state={planState}
            value={
              planState === 'complete'
                ? 'Complete'
                : planState === 'current'
                  ? 'Current'
                  : 'Stopping'
            }
          />
          <RunStage
            index={2}
            title="Search selected sources"
            description={sourceDescription}
            state={sourceState}
            value={`${progress.completedSources} of ${progress.totalSources} sources finished`}
          >
            <progress
              aria-label="Source search progress"
              value={progress.completedSources}
              max={progress.totalSources}
            />
          </RunStage>
          <RunStage
            index={3}
            title="Assemble session"
            description={
              assembleState === 'current'
                ? 'Ranking, deduplicating, and persisting results'
                : 'Rank, deduplicate, and persist results'
            }
            state={assembleState}
            value={assembleState === 'current' ? 'Current' : 'Waiting'}
          />
        </ol>
      </div>
      <button
        type="button"
        className="secondary-button discover-run-card__cancel"
        aria-label="Cancel Discover search"
        disabled={isCancelRequested}
        onClick={onCancel}
      >
        {isCancelRequested ? 'Canceling…' : 'Cancel'}
      </button>
    </section>
  )
}

function sourceSummaryState(status: DiscoverSnapshot['status']): {
  readonly state: RunStageState
  readonly suffix: string
} {
  if (status === 'partial' || status === 'failed') {
    return { state: 'attention', suffix: ' need attention' }
  }
  if (status === 'canceled') {
    return { state: 'stopped', suffix: ' stopped' }
  }
  return { state: 'complete', suffix: '' }
}

export function DiscoverRunSummary({ snapshot }: { readonly snapshot: DiscoverSnapshot }) {
  const searchedSources = Object.values(snapshot.sourceOutcomes).filter(
    (outcome) => outcome.status !== 'not_searched'
  ).length
  const sourceStage = sourceSummaryState(snapshot.status)
  const sourceSummary = `${searchedSources} sources${sourceStage.suffix}`

  return (
    <span className="discover-run-summary" role="group" aria-label="Recorded Discover run summary">
      <span className="discover-run-summary__item">Plan ready</span>
      <span className="discover-run-summary__separator" aria-hidden="true">
        ·
      </span>
      <span className="discover-run-summary__item" data-state={sourceStage.state}>
        {sourceSummary}
      </span>
      <span className="discover-run-summary__separator" aria-hidden="true">
        ·
      </span>
      <span className="discover-run-summary__item">{snapshot.counts.total} records</span>
    </span>
  )
}

import type { DashboardItem, DashboardSnapshot, TheRSSApi, TriageState } from '../../shared/api'
import type { AnalysisArtifact, AnalysisRunner, LocalAgentStatus } from '../../shared/models'
import type { DiscoverySource } from '../../shared/discovery'
import { ACTIVE_TODAY_SOURCE_IDS, sourceDisplayName } from '../../shared/sourceIdentity'
import { SignalWorkspace } from './SignalWorkspace'

interface SavedSignalsViewProps {
  readonly api: TheRSSApi
  readonly viewItems: readonly DashboardItem[]
  readonly visibleItems: readonly DashboardItem[]
  readonly sourceFilter: 'all' | DiscoverySource
  readonly onSourceFilterChange: (filter: 'all' | DiscoverySource) => void
  readonly analysisRunner: AnalysisRunner
  readonly onAnalysisRunnerChange: (runner: AnalysisRunner) => void
  readonly localAgents: readonly LocalAgentStatus[]
  readonly analysis: AnalysisArtifact | null
  readonly analyzingItemId: string | null
  readonly selectedSignalId: string | null
  readonly onTriage: (id: string, state: TriageState) => Promise<void>
  readonly onAnalyze: (id: string) => Promise<void>
  readonly onSelectionChange: (id: string | null) => void
  readonly onDashboardChange: (snapshot: DashboardSnapshot) => void
}

export function SavedSignalsView({
  api,
  viewItems,
  visibleItems,
  sourceFilter,
  onSourceFilterChange,
  analysisRunner,
  onAnalysisRunnerChange,
  localAgents,
  analysis,
  analyzingItemId,
  selectedSignalId,
  onTriage,
  onAnalyze,
  onSelectionChange,
  onDashboardChange
}: SavedSignalsViewProps) {
  const viewCounts = {
    arxiv: viewItems.filter((item) => item.source === 'arxiv').length,
    github: viewItems.filter((item) => item.source === 'github').length,
    other: viewItems.filter((item) => item.source !== 'arxiv' && item.source !== 'github').length,
    unread: viewItems.filter((item) => item.triageState === 'new').length
  }
  const additionalSources = ACTIVE_TODAY_SOURCE_IDS.filter(
    (source) => source !== 'arxiv' && source !== 'github'
  )

  return (
    <section className="today-view">
      <div className="today-view__heading">
        <div>
          <p className="eyebrow">RESEARCH SHELF</p>
          <h1>Saved research signals</h1>
        </div>
        <div className="signal-counts" aria-label="Inbox counts">
          <span>
            <strong>{viewCounts.arxiv}</strong> papers
          </span>
          <span>
            <strong>{viewCounts.github}</strong> repos
          </span>
          <span>
            <strong>{viewCounts.other}</strong> other
          </span>
          <span>
            <strong>{viewCounts.unread}</strong> unread
          </span>
        </div>
      </div>

      <div className="inbox-toolbar">
        <div className="inbox-toolbar__sources">
          <div className="source-filters" role="group" aria-label="Filter saved signals by source">
            <button
              type="button"
              aria-label="Show all sources"
              aria-pressed={sourceFilter === 'all'}
              onClick={() => onSourceFilterChange('all')}
            >
              All
            </button>
            <button
              type="button"
              aria-label="Show arXiv only"
              aria-pressed={sourceFilter === 'arxiv'}
              onClick={() => onSourceFilterChange('arxiv')}
            >
              arXiv
            </button>
            <button
              type="button"
              aria-label="Show GitHub only"
              aria-pressed={sourceFilter === 'github'}
              onClick={() => onSourceFilterChange('github')}
            >
              GitHub
            </button>
            <select
              aria-label="Show another source"
              value={
                sourceFilter !== 'all' && sourceFilter !== 'arxiv' && sourceFilter !== 'github'
                  ? sourceFilter
                  : ''
              }
              onChange={(event) => {
                if (event.target.value) onSourceFilterChange(event.target.value as DiscoverySource)
              }}
            >
              <option value="">More sources</option>
              {additionalSources.map((source) => (
                <option key={source} value={source}>
                  {sourceDisplayName(source)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="analysis-runner-control">
          <span>Analyze with</span>
          <select
            aria-label="Analysis runner"
            value={analysisRunner}
            onChange={(event) => onAnalysisRunnerChange(event.target.value as AnalysisRunner)}
          >
            <option value="model-provider">Model provider</option>
            {localAgents.map((agent) => (
              <option key={agent.runner} value={agent.runner} disabled={!agent.available}>
                {agent.label}
                {agent.available ? '' : ' (not detected)'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {viewItems.length === 0 ? (
        <div className="quiet-state">
          <span>0 SIGNALS</span>
          <h2>No saved signals yet.</h2>
          <p>Save a Discover result and it will appear here.</p>
        </div>
      ) : (
        <div className="today-stage today-stage--single">
          {visibleItems.length === 0 ? (
            <div className="quiet-state quiet-state--filtered">
              <span>0 MATCHES</span>
              <h2>No signals from this source.</h2>
              <p>Choose another source to see saved records.</p>
            </div>
          ) : (
            <SignalWorkspace
              api={api}
              items={visibleItems}
              analysis={analysis}
              analyzingItemId={analyzingItemId}
              selectedItemId={selectedSignalId}
              onTriage={onTriage}
              onAnalyze={onAnalyze}
              onSelectionChange={onSelectionChange}
              onSourceUpdated={(result) => {
                const updated = result.item
                onDashboardChange(
                  updated?.triageState === 'saved' &&
                    !result.dashboard.savedItems.some((item) => item.id === updated.id)
                    ? {
                        ...result.dashboard,
                        savedItems: [updated, ...result.dashboard.savedItems]
                      }
                    : result.dashboard
                )
              }}
            />
          )}
        </div>
      )}
    </section>
  )
}

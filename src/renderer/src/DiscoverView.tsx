import { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { DashboardSnapshot, TheRSSApi } from '../../shared/api'
import type {
  DiscoverResultItem,
  DiscoverRunner,
  DiscoverSnapshot,
  DiscoverSource
} from '../../shared/discover'
import { DISCOVER_SOURCE_IDS } from '../../shared/discover'
import { sourceDisplayName, sourceStyleToken } from '../../shared/sourceIdentity'
import type { AnalysisArtifact, LocalAgentStatus } from '../../shared/models'
import { AnalysisPanel } from './AppSections'
import { SaveStar } from './SaveStar'
import { PaperPromotionAction } from './PaperPromotionAction'

interface DiscoverViewProps {
  readonly api: TheRSSApi
  readonly localAgents: readonly LocalAgentStatus[]
  readonly onDashboardChange: (snapshot: DashboardSnapshot) => void
}

type DiscoverResultFilter = 'all' | 'paper' | 'repository' | 'other'

const DISCOVER_RESULT_BATCH_SIZE = 24

function statusLabel(snapshot: DiscoverSnapshot): string {
  if (snapshot.status === 'partial') return 'Partial results'
  if (snapshot.status === 'failed') return 'Search failed'
  if (snapshot.status === 'no_results') return 'No results'
  return 'Search complete'
}

function resultKindLabel(item: DiscoverResultItem): string {
  if (item.kind === 'repository') return 'Repository'
  return item.kind.charAt(0).toUpperCase() + item.kind.slice(1)
}

function sourceStatusLabel(status: DiscoverSnapshot['sourceOutcomes'][DiscoverSource]['status']) {
  if (status === 'not_searched') return 'Not searched'
  if (status === 'no_results') return 'No results'
  if (status === 'healthy') return 'Healthy'
  if (status === 'partial') return 'Partial'
  return 'Failed'
}

function ChipGroup({
  label,
  values
}: {
  readonly label: string
  readonly values: readonly string[]
}) {
  if (values.length === 0) return null
  return (
    <div>
      <strong>{label}</strong>
      <div className="reason-list">
        {values.map((value) => (
          <span key={value}>{value}</span>
        ))}
      </div>
    </div>
  )
}

function DiscoverCard({
  item,
  index,
  isSaving,
  isSaveDisabled,
  analysis,
  isAnalyzing,
  onToggleSave,
  onAnalyze,
  api,
  sessionId
}: {
  readonly item: DiscoverResultItem
  readonly index: number
  readonly isSaving: boolean
  readonly isSaveDisabled: boolean
  readonly analysis: AnalysisArtifact | null
  readonly isAnalyzing: boolean
  readonly onToggleSave: (itemId: string) => Promise<void>
  readonly onAnalyze: (itemId: string) => Promise<void>
  readonly api: TheRSSApi
  readonly sessionId: string
}) {
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault()
    void api
      .showContextMenu({
        kind: 'discover-result',
        itemId: item.id,
        sessionId,
        title: item.title,
        url: item.url,
        sourceLabel: sourceDisplayName(item.source),
        publishedAt: item.publishedAt,
        isSaved: item.saved,
        canAnalyze: item.kind === 'paper',
        // Promotion stays with PaperPromotionAction so the confirmation gate required
        // by ADR 0008 keeps a single implementation. See the contract amendment.
        canPromote: false
      })
      .then((outcome) => {
        if (outcome.action === 'save' || outcome.action === 'unsave') return onToggleSave(item.id)
        if (outcome.action === 'analyze') return onAnalyze(item.id)
        return undefined
      })
      .catch(() => undefined)
  }

  return (
    <article
      className="signal-card"
      style={{ '--card-index': Math.min(index, 5) } as React.CSSProperties}
      data-testid="discover-result"
      onContextMenu={handleContextMenu}
    >
      <div className="signal-card__meta">
        <span className={`source-mark source-mark--${sourceStyleToken(item.source)}`}>
          {sourceDisplayName(item.source)}
        </span>
        <span>{resultKindLabel(item)}</span>
        <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
        <span className="signal-card__score">signal {item.score}</span>
      </div>
      <h3>
        <a href={item.url} target="_blank" rel="noreferrer">
          {item.title}
        </a>
      </h3>
      <p className="discover-card__summary">{item.summary}</p>
      <div className="reason-list" aria-label="Discover match reasons">
        {item.reasons.map((reason) => (
          <span key={reason}>{reason}</span>
        ))}
      </div>
      <div className="signal-card__actions">
        <button
          type="button"
          className="discover-save-button save-button"
          aria-label={item.saved ? 'Remove result from Saved' : 'Save result'}
          aria-pressed={item.saved}
          aria-busy={isSaving}
          title={item.saved ? 'Remove from Saved' : 'Save this result'}
          disabled={isSaveDisabled}
          onClick={() => void onToggleSave(item.id)}
        >
          <SaveStar isSaved={item.saved} />
        </button>
        {item.kind === 'paper' && (
          <button
            type="button"
            className="text-button discover-analysis-button"
            aria-label="Analyze paper"
            disabled={isAnalyzing}
            onClick={() => void onAnalyze(item.id)}
          >
            <Sparkles aria-hidden="true" size={16} strokeWidth={1.8} />
            <span>{isAnalyzing ? 'Analyzing…' : 'Analyze paper'}</span>
          </button>
        )}
        {item.source === 'arxiv' && item.kind === 'paper' ? (
          <PaperPromotionAction api={api} itemId={item.id} sessionId={sessionId} />
        ) : null}
      </div>
      {analysis?.itemId === item.id && (
        <div className="discover-card__analysis">
          <AnalysisPanel artifact={analysis} />
        </div>
      )}
    </article>
  )
}

export function DiscoverView({ api, localAgents, onDashboardChange }: DiscoverViewProps) {
  const [intent, setIntent] = useState('')
  const [runner, setRunner] = useState<DiscoverRunner>('model-provider')
  const [sources, setSources] = useState<readonly DiscoverSource[]>(DISCOVER_SOURCE_IDS)
  const [isSourcePickerOpen, setIsSourcePickerOpen] = useState(false)
  const [snapshot, setSnapshot] = useState<DiscoverSnapshot | null>(null)
  const [resultFilter, setResultFilter] = useState<DiscoverResultFilter>('all')
  const [visibleResultCount, setVisibleResultCount] = useState(DISCOVER_RESULT_BATCH_SIZE)
  const [isSearching, setIsSearching] = useState(false)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)
  const [analyzingItemId, setAnalyzingItemId] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisArtifact | null>(null)
  const [hasPersonalContext, setHasPersonalContext] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api
      .getLatestDiscover()
      .then((latest) => {
        if (active && latest) {
          const latestSources = DISCOVER_SOURCE_IDS.filter(
            (source) => latest.sourceOutcomes[source]?.status !== 'not_searched'
          )
          setSnapshot(latest)
          setVisibleResultCount(DISCOVER_RESULT_BATCH_SIZE)
          setIntent(latest.intent)
          setRunner(latest.runner)
          if (latestSources.length > 0) {
            setSources(latestSources)
          }
        }
      })
      .catch(() => {
        if (active) setError('The previous Discover session could not be loaded.')
      })
    return () => {
      active = false
    }
  }, [api])

  useEffect(() => {
    let active = true
    api
      .getDiscoverPersonalizationSettings()
      .then((settings) => {
        if (active) setHasPersonalContext(Boolean(settings?.prompt.trim()))
      })
      .catch(() => {
        if (active) setHasPersonalContext(false)
      })
    return () => {
      active = false
    }
  }, [api])

  const canSearch = intent.trim().length > 0 && sources.length > 0 && !isSearching
  const sourceSet = useMemo(() => new Set(sources), [sources])
  const filteredItems = useMemo(
    () =>
      snapshot?.items.filter((item) => {
        if (resultFilter === 'all') return true
        if (resultFilter === 'other') {
          return item.kind !== 'paper' && item.kind !== 'repository'
        }
        return item.kind === resultFilter
      }) ?? [],
    [resultFilter, snapshot]
  )
  const visibleItems = filteredItems.slice(0, visibleResultCount)
  const remainingItemCount = Math.max(0, filteredItems.length - visibleItems.length)

  const toggleSource = (source: DiscoverSource) => {
    setSources((current) =>
      current.includes(source)
        ? current.filter((candidate) => candidate !== source)
        : [...current, source]
    )
  }

  const selectAllSources = () => setSources(DISCOVER_SOURCE_IDS)
  const clearSources = () => setSources([])

  const search = async () => {
    setIsSearching(true)
    setError(null)
    try {
      const nextSnapshot = await api.searchDiscover({
        intent: intent.trim(),
        runner,
        sources: DISCOVER_SOURCE_IDS.filter((source) => sourceSet.has(source))
      })
      setSnapshot(nextSnapshot)
      setResultFilter('all')
      setVisibleResultCount(DISCOVER_RESULT_BATCH_SIZE)
    } catch {
      setError(
        runner === 'model-provider'
          ? 'Discover failed. Configure or check the selected model provider.'
          : `Discover failed. Confirm ${runner === 'codex' ? 'Codex CLI' : 'Claude Code'} is installed and signed in.`
      )
    } finally {
      setIsSearching(false)
    }
  }

  const toggleSaveResult = async (itemId: string) => {
    if (!snapshot) return
    const item = snapshot.items.find((candidate) => candidate.id === itemId)
    if (!item) return
    setSavingItemId(itemId)
    setError(null)
    try {
      const dashboard = item.saved
        ? await api.setTriageState(itemId, 'viewed')
        : await api.saveDiscoverResult(snapshot.id, itemId)
      onDashboardChange(dashboard)
      setSnapshot((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === itemId ? { ...item, saved: !item.saved } : item
              )
            }
          : current
      )
    } catch {
      setError('The Discover result Saved state could not be updated.')
    } finally {
      setSavingItemId(null)
    }
  }

  const analyzeResult = async (itemId: string) => {
    if (!snapshot) return
    setAnalyzingItemId(itemId)
    setError(null)
    try {
      setAnalysis(await api.analyzeDiscoverResult(snapshot.id, itemId, runner))
    } catch {
      setError(
        runner === 'model-provider'
          ? 'Analysis failed. Configure or check the selected model provider.'
          : `Analysis failed. Confirm ${runner === 'codex' ? 'Codex CLI' : 'Claude Code'} is installed and signed in.`
      )
    } finally {
      setAnalyzingItemId(null)
    }
  }

  return (
    <section className="discover-view">
      <div className="today-view__heading">
        <div>
          <p className="eyebrow">SEMANTIC EXPANSION SEARCH</p>
          <h1>Search across your full source desk</h1>
          <p className="discover-copy">
            Codex, Claude Code, or your configured model expands the intent. TheRSS executes the
            resulting bounded plan across every active, locally deployed source you select.
          </p>
        </div>
      </div>

      <form
        className="discover-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (canSearch) void search()
        }}
      >
        <label className="field field--wide">
          <span>Research question</span>
          <textarea
            aria-label="Research question"
            value={intent}
            onChange={(event) => setIntent(event.target.value)}
            placeholder="Find work connecting structured pruning, semantic communications, and edge deployment"
            rows={3}
            maxLength={2_000}
          />
        </label>
        <div
          className={`discover-personalization-status ${
            hasPersonalContext ? 'discover-personalization-status--active' : ''
          }`}
          role="status"
          aria-label="Personal prompt status"
        >
          <span aria-hidden="true" />
          <p>
            <strong>{hasPersonalContext ? 'Personal context on' : 'Personal context off'}</strong>
            {hasPersonalContext
              ? 'The selected runner will use your saved profile. Source sites receive the generated search terms; review them in Search details.'
              : 'Add a Personal Prompt in Settings to tailor future query expansion.'}
          </p>
        </div>
        <div className="discover-controls">
          <div className="discover-source-picker">
            <button
              type="button"
              className="discover-source-trigger"
              aria-label={`Choose sources, ${sources.length} of ${DISCOVER_SOURCE_IDS.length} selected`}
              aria-expanded={isSourcePickerOpen}
              aria-controls="discover-source-options"
              onClick={() => setIsSourcePickerOpen((current) => !current)}
            >
              <span>Sources</span>
              <strong>
                {sources.length} of {DISCOVER_SOURCE_IDS.length} selected
              </strong>
              <span className="discover-source-trigger__chevron" aria-hidden="true">
                ›
              </span>
            </button>
            {isSourcePickerOpen && (
              <fieldset
                id="discover-source-options"
                className="discover-source-control"
                aria-label="Search sources"
              >
                <legend>
                  <span>Search sources</span>
                  <span className="discover-source-control__bulk">
                    <button
                      type="button"
                      onClick={selectAllSources}
                      aria-label="Select all sources"
                    >
                      Select all
                    </button>
                    <button type="button" onClick={clearSources} aria-label="Clear all sources">
                      Clear
                    </button>
                  </span>
                </legend>
                <div className="discover-source-grid">
                  {DISCOVER_SOURCE_IDS.map((source) => (
                    <label key={source} title={sourceDisplayName(source)}>
                      <input
                        type="checkbox"
                        aria-label={`Search ${sourceDisplayName(source)}`}
                        checked={sourceSet.has(source)}
                        onChange={() => toggleSource(source)}
                      />
                      <span>{sourceDisplayName(source)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
          <label className="analysis-runner-control">
            <span>Search with</span>
            <select
              aria-label="Search with"
              value={runner}
              onChange={(event) => setRunner(event.target.value as DiscoverRunner)}
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
          <button type="submit" className="primary-button" disabled={!canSearch}>
            {isSearching ? 'Expanding and searching…' : 'Expand and search'}
          </button>
        </div>
      </form>

      {isSearching && (
        <div
          className="discover-search-progress"
          role="status"
          aria-label="Discover search progress"
        >
          <span className="activity-spinner" aria-hidden="true" />
          <span>
            <strong>Expanding intent and searching {sources.length} sources…</strong>
            <span>Results will appear when the bounded source run completes.</span>
          </span>
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {snapshot && (
        <div className="discover-results">
          <section
            className="today-view discover-result-list"
            aria-label="Discover results"
            tabIndex={0}
          >
            <div className="today-view__heading">
              <div>
                <p className="eyebrow">DISCOVER RESULTS</p>
                <h2>Ranked source records</h2>
              </div>
              <div
                className="signal-counts discover-result-filters"
                role="group"
                aria-label="Filter Discover results"
              >
                {(
                  [
                    ['all', 'All', snapshot.counts.total],
                    ['paper', 'Papers', snapshot.counts.byKind.paper],
                    ['repository', 'Repositories', snapshot.counts.byKind.repository],
                    [
                      'other',
                      'Other',
                      snapshot.counts.byKind.article +
                        snapshot.counts.byKind.model +
                        snapshot.counts.byKind.dataset +
                        snapshot.counts.byKind.post
                    ]
                  ] as const
                ).map(([filter, label, count]) => (
                  <button
                    key={filter}
                    type="button"
                    aria-label={`${label} ${count}`}
                    aria-pressed={resultFilter === filter}
                    onClick={() => {
                      setResultFilter(filter)
                      setVisibleResultCount(DISCOVER_RESULT_BATCH_SIZE)
                    }}
                  >
                    <strong>{count}</strong>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
            {snapshot.items.length === 0 ? (
              <div className="quiet-state">
                <span>0 RESULTS</span>
                <h2>No matching source records.</h2>
                <p>Refine the intent or select another search runner.</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="quiet-state quiet-state--filtered">
                <span>
                  0{' '}
                  {resultFilter === 'paper'
                    ? 'PAPERS'
                    : resultFilter === 'repository'
                      ? 'REPOSITORIES'
                      : 'OTHER RECORDS'}
                </span>
                <h2>
                  {resultFilter === 'paper'
                    ? 'No papers in this session.'
                    : resultFilter === 'repository'
                      ? 'No repositories in this session.'
                      : 'No other records in this session.'}
                </h2>
                <p>Choose another result type to see the records already found.</p>
              </div>
            ) : (
              <>
                <div className="signal-grid" id="discover-visible-results">
                  {visibleItems.map((item, index) => (
                    <DiscoverCard
                      key={`${snapshot.id}-${item.id}`}
                      item={item}
                      index={index}
                      isSaving={savingItemId === item.id}
                      isSaveDisabled={savingItemId !== null}
                      analysis={analysis?.itemId === item.id ? analysis : null}
                      isAnalyzing={analyzingItemId === item.id}
                      onToggleSave={toggleSaveResult}
                      onAnalyze={analyzeResult}
                      api={api}
                      sessionId={snapshot.id}
                    />
                  ))}
                </div>
                <div className="discover-result-pagination">
                  <p role="status" aria-label="Discover result count">
                    {remainingItemCount === 0
                      ? `Showing all ${filteredItems.length} results`
                      : `Showing ${visibleItems.length} of ${filteredItems.length} results`}
                  </p>
                  {remainingItemCount > 0 && (
                    <button
                      type="button"
                      className="text-button"
                      aria-controls="discover-visible-results"
                      onClick={() =>
                        setVisibleResultCount((current) =>
                          Math.min(current + DISCOVER_RESULT_BATCH_SIZE, filteredItems.length)
                        )
                      }
                    >
                      Show {Math.min(DISCOVER_RESULT_BATCH_SIZE, remainingItemCount)} more results
                    </button>
                  )}
                </div>
              </>
            )}
            <p className="discover-evidence-boundary">
              Evidence boundary: these are source metadata and model-derived relevance signals;
              full-paper methods, experiments, and repository quality remain unverified.
            </p>
          </section>

          <details
            className="discover-plan discover-search-details"
            aria-label="Discover search details"
          >
            <summary role="button" aria-label={`Search details, ${statusLabel(snapshot)}`}>
              <span className={`discover-status discover-status--${snapshot.status}`}>
                {statusLabel(snapshot)}
              </span>
              <span className="discover-search-details__copy">
                <strong>Search details</strong>
                <span>Plan, provenance, and {DISCOVER_SOURCE_IDS.length} source outcomes</span>
              </span>
            </summary>
            <div className="discover-search-details__body">
              <div className="discover-source-outcomes" role="list" aria-label="Source outcomes">
                {DISCOVER_SOURCE_IDS.map((source) => {
                  const outcome = snapshot.sourceOutcomes[source]
                  if (!outcome) return null
                  return (
                    <div
                      key={source}
                      role="listitem"
                      title={sourceDisplayName(source)}
                      className={`discover-source-outcome discover-source-outcome--${outcome.status}`}
                    >
                      <strong>{sourceDisplayName(source)}</strong>
                      <span>{sourceStatusLabel(outcome.status)}</span>
                      <span>{outcome.resultCount} results</span>
                      {outcome.error && (
                        <span className="discover-source-outcome__error">{outcome.error}</span>
                      )}
                    </div>
                  )
                })}
              </div>
              <div>
                <p className="eyebrow">EXPANDED PLAN</p>
                <h2>{snapshot.plan.intentSummary}</h2>
                <p>{snapshot.plan.rationale}</p>
              </div>
              <div className="discover-chip-groups">
                <ChipGroup label="arXiv categories" values={snapshot.plan.arxiv.categories} />
                <ChipGroup label="arXiv keywords" values={snapshot.plan.arxiv.keywords} />
                <ChipGroup label="GitHub keywords" values={snapshot.plan.github.keywords} />
                <ChipGroup label="GitHub topics" values={snapshot.plan.github.topics} />
                <ChipGroup label="Languages" values={snapshot.plan.github.languages} />
              </div>
              <div className="discover-provenance">
                <strong>
                  {snapshot.provenance.providerName} · {snapshot.provenance.model}
                </strong>
                <span>
                  {snapshot.provenance.promptVersion} ·{' '}
                  {snapshot.provenance.personalizationApplied
                    ? 'personal context applied'
                    : 'generic context'}{' '}
                  · input {snapshot.provenance.inputHash.slice(0, 12)}
                </span>
              </div>
            </div>
          </details>
        </div>
      )}
    </section>
  )
}

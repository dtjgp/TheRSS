import { useEffect, useMemo, useState } from 'react'
import type { DashboardSnapshot, TheRSSApi } from '../../shared/api'
import type {
  DiscoverResultItem,
  DiscoverRunner,
  DiscoverSnapshot,
  DiscoverSource
} from '../../shared/discover'
import type { LocalAgentStatus } from '../../shared/models'

interface DiscoverViewProps {
  readonly api: TheRSSApi
  readonly localAgents: readonly LocalAgentStatus[]
  readonly onDashboardChange: (snapshot: DashboardSnapshot) => void
}

type DiscoverResultFilter = 'all' | DiscoverSource

function statusLabel(snapshot: DiscoverSnapshot): string {
  if (snapshot.status === 'partial') return 'Partial results'
  if (snapshot.status === 'failed') return 'Search failed'
  if (snapshot.status === 'no_results') return 'No results'
  return 'Search complete'
}

function sourceLabel(source: DiscoverSource): string {
  return source === 'arxiv' ? 'arXiv' : 'GitHub'
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
  onSave
}: {
  readonly item: DiscoverResultItem
  readonly index: number
  readonly isSaving: boolean
  readonly isSaveDisabled: boolean
  readonly onSave: (itemId: string) => Promise<void>
}) {
  return (
    <article
      className="signal-card"
      style={{ '--card-index': index } as React.CSSProperties}
      data-testid="discover-result"
    >
      <div className="signal-card__meta">
        <span className={`source-mark source-mark--${item.source}`}>
          {item.source === 'arxiv' ? 'PAPER' : 'REPO'}
        </span>
        <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
        <span className="signal-card__score">signal {item.score}</span>
      </div>
      <h2>
        <a href={item.url} target="_blank" rel="noreferrer">
          {item.title}
        </a>
      </h2>
      <p>{item.summary}</p>
      <div className="reason-list" aria-label="Discover match reasons">
        {item.reasons.map((reason) => (
          <span key={reason}>{reason}</span>
        ))}
      </div>
      <div className="signal-card__actions">
        <button
          type="button"
          className="text-button"
          aria-pressed={item.saved}
          disabled={isSaveDisabled || item.saved}
          onClick={() => void onSave(item.id)}
        >
          {item.saved ? 'Saved' : isSaving ? 'Saving…' : 'Save result'}
        </button>
      </div>
    </article>
  )
}

export function DiscoverView({ api, localAgents, onDashboardChange }: DiscoverViewProps) {
  const [intent, setIntent] = useState('')
  const [runner, setRunner] = useState<DiscoverRunner>('model-provider')
  const [sources, setSources] = useState<readonly DiscoverSource[]>(['arxiv', 'github'])
  const [snapshot, setSnapshot] = useState<DiscoverSnapshot | null>(null)
  const [resultFilter, setResultFilter] = useState<DiscoverResultFilter>('all')
  const [isSearching, setIsSearching] = useState(false)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api
      .getLatestDiscover()
      .then((latest) => {
        if (active && latest) {
          const latestSources = (['arxiv', 'github'] as const).filter(
            (source) => latest.sourceOutcomes[source].status !== 'not_searched'
          )
          setSnapshot(latest)
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

  const canSearch = intent.trim().length > 0 && sources.length > 0 && !isSearching
  const sourceSet = useMemo(() => new Set(sources), [sources])
  const filteredItems = useMemo(
    () =>
      snapshot?.items.filter((item) => resultFilter === 'all' || item.source === resultFilter) ??
      [],
    [resultFilter, snapshot]
  )

  const toggleSource = (source: DiscoverSource) => {
    setSources((current) =>
      current.includes(source)
        ? current.filter((candidate) => candidate !== source)
        : [...current, source]
    )
  }

  const search = async () => {
    setIsSearching(true)
    setError(null)
    try {
      const nextSnapshot = await api.searchDiscover({
        intent: intent.trim(),
        runner,
        sources: [...sources]
      })
      setSnapshot(nextSnapshot)
      setResultFilter('all')
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

  const saveResult = async (itemId: string) => {
    if (!snapshot) return
    setSavingItemId(itemId)
    setError(null)
    try {
      const dashboard = await api.saveDiscoverResult(snapshot.id, itemId)
      onDashboardChange(dashboard)
      setSnapshot((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === itemId ? { ...item, saved: true } : item
              )
            }
          : current
      )
    } catch {
      setError('The Discover result could not be added to Saved.')
    } finally {
      setSavingItemId(null)
    }
  }

  return (
    <section className="discover-view">
      <div className="today-view__heading">
        <div>
          <p className="eyebrow">SEMANTIC EXPANSION SEARCH</p>
          <h1>Explore beyond your standing interests</h1>
          <p className="discover-copy">
            Codex, Claude Code, or your configured model expands the intent. TheRSS executes the
            resulting bounded plan against arXiv and GitHub.
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
            rows={4}
            maxLength={2_000}
          />
        </label>
        <div className="discover-controls">
          <fieldset className="discover-source-control">
            <legend>Search sources</legend>
            {(['arxiv', 'github'] as const).map((source) => (
              <label key={source}>
                <input
                  type="checkbox"
                  checked={sourceSet.has(source)}
                  onChange={() => toggleSource(source)}
                />
                Search {sourceLabel(source)}
              </label>
            ))}
          </fieldset>
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

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {snapshot && (
        <div className="discover-results">
          <section className="discover-plan" aria-label="Discover expansion plan">
            <div className="discover-plan__status">
              <span className={`discover-status discover-status--${snapshot.status}`}>
                {statusLabel(snapshot)}
              </span>
              {(['arxiv', 'github'] as const).map((source) => (
                <span key={source}>
                  {sourceLabel(source)}: {snapshot.sourceOutcomes[source].status.replace('_', ' ')}
                </span>
              ))}
            </div>
            <p className="eyebrow">EXPANDED PLAN</p>
            <h2>{snapshot.plan.intentSummary}</h2>
            <p>{snapshot.plan.rationale}</p>
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
                {snapshot.provenance.promptVersion} · input{' '}
                {snapshot.provenance.inputHash.slice(0, 12)}
              </span>
            </div>
          </section>

          <section className="today-view discover-result-list">
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
                    ['arxiv', 'Papers', snapshot.counts.arxiv],
                    ['github', 'GitHub repos', snapshot.counts.github]
                  ] as const
                ).map(([filter, label, count]) => (
                  <button
                    key={filter}
                    type="button"
                    aria-label={`${label} ${count}`}
                    aria-pressed={resultFilter === filter}
                    onClick={() => setResultFilter(filter)}
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
                <span>0 {resultFilter === 'arxiv' ? 'PAPERS' : 'REPOS'}</span>
                <h2>
                  {resultFilter === 'arxiv'
                    ? 'No papers in this session.'
                    : 'No GitHub repositories in this session.'}
                </h2>
                <p>Choose All or the other result type to see the records already found.</p>
              </div>
            ) : (
              <div className="signal-grid">
                {filteredItems.map((item, index) => (
                  <DiscoverCard
                    key={`${snapshot.id}-${item.id}`}
                    item={item}
                    index={index}
                    isSaving={savingItemId === item.id}
                    isSaveDisabled={savingItemId !== null}
                    onSave={saveResult}
                  />
                ))}
              </div>
            )}
            <p className="discover-evidence-boundary">
              Evidence boundary: these are source metadata and model-derived relevance signals;
              full-paper methods, experiments, and repository quality remain unverified.
            </p>
          </section>
        </div>
      )}
    </section>
  )
}

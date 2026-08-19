import { ArrowLeft, ArrowRight, ArrowUpRight, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SourceContentSnapshot, TheRSSApi } from '../../shared/api'
import {
  RESEARCH_AXES,
  RESEARCH_AXIS_LABELS,
  SOURCE_ACQUISITION_LABELS,
  SOURCE_CATALOG,
  SOURCE_CATALOG_STATS,
  SOURCE_PRIORITIES,
  type ResearchAxis,
  type SourceCatalogEntry,
  type SourcePriority
} from '../../shared/sourceCatalog'
import { discoverySourceFromCatalogId } from '../../shared/sourceIdentity'

type PriorityFilter = 'all' | SourcePriority
type ResearchAxisFilter = 'all' | ResearchAxis
type DirectoryMode = 'content' | 'pending'
type SourceCatalogApi = Pick<TheRSSApi, 'getSourceContent' | 'refreshSourceContent'>

interface SourceCatalogViewProps {
  readonly api: SourceCatalogApi
  readonly hasInterestProfile: boolean
}

function matchesSearch(source: SourceCatalogEntry, query: string): boolean {
  if (!query) return true
  const searchable = [
    source.name,
    source.role,
    source.reason,
    source.origin,
    source.accessNote,
    ...source.researchAxes.map((axis) => RESEARCH_AXIS_LABELS[axis])
  ]
    .join(' ')
    .toLocaleLowerCase()
  return searchable.includes(query)
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(parsed)
}

function SummaryMetric({
  label,
  value,
  detail
}: {
  readonly label: string
  readonly value: number
  readonly detail: string
}) {
  return (
    <div className="source-catalog-summary__metric" aria-label={label}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  )
}

function sourceNeedsInterests(sourceId: SourceContentSnapshot['source']): boolean {
  return sourceId === 'github' || sourceId === 'folo:2'
}

function sourceErrorMessage(reason: unknown): string {
  const raw = reason instanceof Error ? reason.message : String(reason || 'Unknown source error')
  const nested = raw.lastIndexOf('Error: ')
  return (nested >= 0 ? raw.slice(nested + 7) : raw)
    .replaceAll(/\b(?:hf|ghp|github_pat)_[A-Za-z0-9_-]+\b/gu, '[redacted credential]')
    .replaceAll(/\/(?:Users|home)\/[^\s:]+/gu, '[local path]')
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .slice(0, 300)
}

function SourceDetail({
  source,
  api,
  hasInterestProfile,
  onBack
}: {
  readonly source: SourceCatalogEntry
  readonly api: SourceCatalogApi
  readonly hasInterestProfile: boolean
  readonly onBack: () => void
}) {
  const sourceId = discoverySourceFromCatalogId(source.id)
  const isActive = source.acquisition === 'active' && sourceId !== null
  const isMeteredX = sourceId === 'folo:2'
  const isArxiv = sourceId === 'arxiv'
  const canRefresh =
    isActive && sourceId !== null && (!sourceNeedsInterests(sourceId) || hasInterestProfile)
  const [snapshot, setSnapshot] = useState<SourceContentSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(isActive)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 })
    if (!isActive || sourceId === null) {
      return
    }

    let isCurrent = true
    api
      .getSourceContent(sourceId)
      .then(async (cached) => {
        if (!isCurrent) return
        setSnapshot(cached)
        const shouldAutoRefresh = cached.items.length === 0 && canRefresh && !isMeteredX
        if (!shouldAutoRefresh) return
        setIsRefreshing(true)
        try {
          const refreshed = await api.refreshSourceContent(sourceId)
          if (isCurrent) setSnapshot(refreshed)
        } catch (reason) {
          if (isCurrent) {
            setError(sourceErrorMessage(reason))
          }
        } finally {
          if (isCurrent) setIsRefreshing(false)
        }
      })
      .catch((reason: unknown) => {
        if (isCurrent) setError(sourceErrorMessage(reason))
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [api, canRefresh, isActive, isMeteredX, sourceId])

  const refresh = useCallback(async () => {
    if (!canRefresh || sourceId === null) return
    setIsRefreshing(true)
    setError(null)
    try {
      setSnapshot(await api.refreshSourceContent(sourceId))
    } catch (reason) {
      setError(sourceErrorMessage(reason))
    } finally {
      setIsRefreshing(false)
    }
  }, [api, canRefresh, sourceId])

  return (
    <section className="source-detail-view">
      <button type="button" className="source-detail-back" onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={16} />
        Back to source directory
      </button>

      <header className="source-detail-heading">
        <div className="source-catalog-card__meta">
          <span className={`source-priority source-priority--${source.priority}`}>
            Priority {source.priority}
          </span>
          <span className={`source-acquisition source-acquisition--${source.acquisition}`}>
            {SOURCE_ACQUISITION_LABELS[source.acquisition]}
          </span>
        </div>
        <p className="eyebrow">
          {isArxiv ? 'SOURCE DESK · TODAY' : 'SOURCE DESK · ROLLING 30 DAYS'}
        </p>
        <h1>{source.name}</h1>
        <strong>{source.role}</strong>
        <p>{source.reason}</p>
        <div className="source-detail-actions">
          {isActive && (
            <button
              type="button"
              className="primary-button"
              disabled={!canRefresh || isRefreshing}
              onClick={() => void refresh()}
              aria-label={isMeteredX ? 'Search X via xapi' : 'Refresh recent content'}
            >
              <RefreshCw aria-hidden="true" size={15} />
              {isRefreshing
                ? 'Refreshing…'
                : isMeteredX
                  ? 'Search X via xapi'
                  : 'Refresh recent content'}
            </button>
          )}
          <a href={source.url} target="_blank" rel="noreferrer" className="source-detail-link">
            Open official source
            <ArrowUpRight aria-hidden="true" size={14} />
          </a>
        </div>
      </header>

      <p className="source-detail-boundary">
        {isArxiv
          ? "This desk shows today's newest available arXiv daily batch and is not filtered by your Interests. arXiv can timestamp that batch on the previous submission day; Today and Discover keep their separate interest-based ranking."
          : 'TheRSS shows bounded source-provided titles and summaries from the rolling 30 days. Some feeds expose less than 30 days; this view does not claim a complete publisher archive or a verified full article.'}
      </p>

      {!isActive && (
        <div className="source-detail-empty">
          <strong>This source does not yet have an active TheRSS adapter.</strong>
          <p>
            {source.accessNote}. Its catalog record is available, but no in-app content is claimed.
          </p>
        </div>
      )}

      {isActive && sourceId && sourceNeedsInterests(sourceId) && !hasInterestProfile && (
        <div className="source-detail-empty">
          <strong>Configure Interests before refreshing this source.</strong>
          <p>
            The source query needs your bounded research terms. Previously indexed items remain
            visible.
          </p>
        </div>
      )}

      {isMeteredX && hasInterestProfile && (
        <p className="source-detail-metered">
          xapi calls may use account balance. X is never searched automatically; use the button
          above to opt in.
        </p>
      )}

      {error && (
        <div className="source-detail-error" role="alert">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="source-detail-loading" role="status">
          {isArxiv
            ? "Opening today's local arXiv index…"
            : 'Opening the local 30-day source index…'}
        </div>
      )}

      {isActive && snapshot && (
        <div className="source-content-section">
          <div className="source-content-summary">
            <div>
              <span>In this window</span>
              <strong>{snapshot.items.length}</strong>
            </div>
            <div>
              <span>Latest source request</span>
              <strong>
                {snapshot.status === 'cached'
                  ? 'Local cache'
                  : snapshot.status === 'no_results'
                    ? 'No results'
                    : snapshot.status === 'partial'
                      ? 'Partial'
                      : 'Fetched'}
              </strong>
            </div>
            <div>
              <span>Last indexed</span>
              <strong>
                {snapshot.lastIndexedAt ? formatTimestamp(snapshot.lastIndexedAt) : 'Not yet'}
              </strong>
            </div>
          </div>

          {snapshot.items.length === 0 && !isRefreshing ? (
            <div className="source-detail-empty">
              <strong>
                {isArxiv
                  ? 'No papers from the latest available arXiv daily batch are indexed yet.'
                  : 'No indexed records fall inside this rolling 30-day window.'}
              </strong>
              <p>
                {isArxiv
                  ? 'Refresh again after arXiv publishes its next daily batch.'
                  : 'The source may not have published recently, or its public endpoint may expose a shorter history.'}
              </p>
            </div>
          ) : (
            <ol className="source-content-list" aria-label={`${source.name} recent content`}>
              {snapshot.items.map((item) => {
                const recentTimestamp =
                  Date.parse(item.updatedAt) > Date.parse(item.publishedAt)
                    ? item.updatedAt
                    : item.publishedAt
                return (
                  <li key={item.id}>
                    <article className="source-content-card">
                      <div className="source-content-card__meta">
                        <span>{item.kind ?? 'item'}</span>
                        <time dateTime={recentTimestamp}>{formatTimestamp(recentTimestamp)}</time>
                      </div>
                      <h2>{item.title}</h2>
                      <p>{item.summary}</p>
                      <footer>
                        <span>{item.triageState}</span>
                        <a href={item.url} target="_blank" rel="noreferrer">
                          Open original item
                          <ArrowUpRight aria-hidden="true" size={13} />
                        </a>
                      </footer>
                    </article>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}

export function SourceCatalogView({ api, hasInterestProfile }: SourceCatalogViewProps) {
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState<PriorityFilter>('all')
  const [researchAxis, setResearchAxis] = useState<ResearchAxisFilter>('all')
  const [directoryMode, setDirectoryMode] = useState<DirectoryMode>('content')
  const [selectedSource, setSelectedSource] = useState<SourceCatalogEntry | null>(null)

  const visibleSources = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return SOURCE_CATALOG.filter(
      (source) =>
        matchesSearch(source, normalizedQuery) &&
        (priority === 'all' || source.priority === priority) &&
        (researchAxis === 'all' || source.researchAxes.includes(researchAxis)) &&
        (directoryMode === 'content'
          ? source.acquisition === 'active'
          : source.acquisition !== 'active')
    )
  }, [directoryMode, priority, query, researchAxis])

  if (selectedSource) {
    return (
      <SourceDetail
        source={selectedSource}
        api={api}
        hasInterestProfile={hasInterestProfile}
        onBack={() => setSelectedSource(null)}
      />
    )
  }

  return (
    <section className="source-catalog-view">
      <header className="source-catalog-heading">
        <p className="eyebrow">RESEARCH SOURCE DIRECTORY</p>
        <h1>{SOURCE_CATALOG_STATS.total} research sources</h1>
        <p>
          Select a content source to inspect its locally indexed recent records without leaving
          TheRSS; arXiv uses its newest available daily batch.
        </p>
      </header>

      <div className="source-catalog-summary" role="group" aria-label="Source catalog summary">
        <SummaryMetric
          label="Active adapters"
          value={SOURCE_CATALOG_STATS.acquisition.active}
          detail="Today refreshes all active adapters"
        />
        <SummaryMetric
          label="Configured retrieval"
          value={SOURCE_CATALOG_STATS.acquisition.configured}
          detail="No staged configured routes remain"
        />
        <SummaryMetric
          label="RSSHub candidates"
          value={SOURCE_CATALOG_STATS.acquisition.rsshub_candidate}
          detail="Catalogued routes awaiting adapter verification"
        />
        <SummaryMetric
          label="Need adapters"
          value={SOURCE_CATALOG_STATS.acquisition.adapter_required}
          detail="Official sources requiring new integrations"
        />
      </div>

      <p className="source-catalog-boundary">
        Catalog membership does not mean retrieval is implemented. Active adapters can show recent
        in-app content; candidate and adapter-required entries remain staged until separately
        verified.
      </p>

      <div className="source-directory-mode" role="group" aria-label="Source directory mode">
        <button
          type="button"
          aria-pressed={directoryMode === 'content'}
          aria-label={`Content sources · ${SOURCE_CATALOG_STATS.acquisition.active}`}
          onClick={() => setDirectoryMode('content')}
        >
          Content sources <span>{SOURCE_CATALOG_STATS.acquisition.active}</span>
        </button>
        <button
          type="button"
          aria-pressed={directoryMode === 'pending'}
          aria-label={`Pending integrations · ${SOURCE_CATALOG_STATS.total - SOURCE_CATALOG_STATS.acquisition.active}`}
          onClick={() => setDirectoryMode('pending')}
        >
          Pending integrations{' '}
          <span>{SOURCE_CATALOG_STATS.total - SOURCE_CATALOG_STATS.acquisition.active}</span>
        </button>
      </div>

      <div className="source-catalog-controls" aria-label="Filter source catalog">
        <label className="source-catalog-search">
          <span>Search</span>
          <input
            type="search"
            aria-label="Search source catalog"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, role, research area…"
          />
        </label>
        <label>
          <span>Priority</span>
          <select
            aria-label="Priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as PriorityFilter)}
          >
            <option value="all">All priorities</option>
            {SOURCE_PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {value} · {value === 'A' ? 'Core' : value === 'B' ? 'Observe' : 'Context'}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Research axis</span>
          <select
            aria-label="Research axis"
            value={researchAxis}
            onChange={(event) => setResearchAxis(event.target.value as ResearchAxisFilter)}
          >
            <option value="all">All research axes</option>
            {RESEARCH_AXES.map((axis) => (
              <option key={axis} value={axis}>
                {axis} · {RESEARCH_AXIS_LABELS[axis]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="source-catalog-results-heading">
        <strong aria-live="polite">{visibleSources.length} sources shown</strong>
        <span>
          A {SOURCE_CATALOG_STATS.priorities.A} · B {SOURCE_CATALOG_STATS.priorities.B} · C{' '}
          {SOURCE_CATALOG_STATS.priorities.C}
        </span>
      </div>

      {visibleSources.length === 0 ? (
        <div className="source-catalog-empty">
          <strong>No catalog sources match these filters.</strong>
          <p>Clear the search or widen one of the catalog filters.</p>
        </div>
      ) : (
        <div className="source-catalog-grid" aria-label="Research source catalog">
          {visibleSources.map((source) => (
            <article className="source-catalog-card" key={source.id}>
              <button
                type="button"
                className="source-catalog-card__button"
                aria-label={`Browse ${source.name} recent content`}
                onClick={() => setSelectedSource(source)}
              >
                <div className="source-catalog-card__meta">
                  <span className={`source-priority source-priority--${source.priority}`}>
                    Priority {source.priority}
                  </span>
                  <span className={`source-acquisition source-acquisition--${source.acquisition}`}>
                    {SOURCE_ACQUISITION_LABELS[source.acquisition]}
                  </span>
                </div>
                <h2>{source.name}</h2>
                <p className="source-catalog-card__role">{source.role}</p>
                <p>{source.reason}</p>
                <div className="source-axis-list" aria-label={`${source.name} research axes`}>
                  {source.researchAxes.map((axis) => (
                    <span key={axis} title={RESEARCH_AXIS_LABELS[axis]}>
                      {axis}
                    </span>
                  ))}
                </div>
                <footer>
                  <span>{source.accessNote}</span>
                  <span>{source.origin}</span>
                </footer>
                <span className="source-catalog-card__drill">
                  View recent content
                  <ArrowRight aria-hidden="true" size={14} />
                </span>
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

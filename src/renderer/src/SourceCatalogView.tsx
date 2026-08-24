import { ArrowLeft, ArrowRight, ArrowUpRight, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  DashboardSnapshot,
  SourceContentSnapshot,
  SourceHealth,
  TheRSSApi
} from '../../shared/api'
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
type SourceCatalogApi = Pick<
  TheRSSApi,
  'getDashboard' | 'getSourceContent' | 'refreshSourceContent'
>

interface SourceCatalogViewProps {
  readonly api: SourceCatalogApi
  readonly sourceHealth: DashboardSnapshot['sourceHealth'] | undefined
  readonly sourceHealthDetails?: DashboardSnapshot['sourceHealthDetails'] | undefined
  readonly attentionOnly?: boolean
  readonly onAttentionOnlyChange?: (attentionOnly: boolean) => void
  readonly onDashboardChange?: (dashboard: DashboardSnapshot) => void
}

interface SourceHealthCounts {
  readonly ready: number
  readonly attention: number
  readonly refreshing: number
  readonly idle: number
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

function sourceSearchesThroughDiscover(sourceId: SourceContentSnapshot['source']): boolean {
  return sourceId === 'github'
}

function sourceHealthLabel(health: SourceHealth | undefined): string {
  switch (health) {
    case 'healthy':
      return 'Healthy'
    case 'no_results':
      return 'Healthy · no results'
    case 'partial':
      return 'Partial'
    case 'failed':
      return 'Failed'
    case 'refreshing':
      return 'Refreshing'
    case 'idle':
    default:
      return 'Not checked this session'
  }
}

function sourceSnapshotLabel(status: SourceContentSnapshot['status']): string {
  switch (status) {
    case 'cached':
      return 'Cached snapshot'
    case 'no_results':
      return 'Fetched · no results'
    case 'partial':
      return 'Fetched · partial'
    case 'fetched':
      return 'Freshly fetched'
  }
}

function summarizeSourceHealth(
  sourceHealth: DashboardSnapshot['sourceHealth'] | undefined
): SourceHealthCounts {
  return SOURCE_CATALOG.reduce<SourceHealthCounts>(
    (counts, source) => {
      const sourceId = discoverySourceFromCatalogId(source.id)
      const health = sourceId ? sourceHealth?.[sourceId] : undefined
      if (health === 'healthy' || health === 'no_results') {
        return { ...counts, ready: counts.ready + 1 }
      }
      if (health === 'partial' || health === 'failed') {
        return { ...counts, attention: counts.attention + 1 }
      }
      if (health === 'refreshing') {
        return { ...counts, refreshing: counts.refreshing + 1 }
      }
      return { ...counts, idle: counts.idle + 1 }
    },
    { ready: 0, attention: 0, refreshing: 0, idle: 0 }
  )
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
  sourceHealth,
  sourceHealthDetails,
  onDashboardChange,
  onBack
}: {
  readonly source: SourceCatalogEntry
  readonly api: SourceCatalogApi
  readonly sourceHealth: DashboardSnapshot['sourceHealth'] | undefined
  readonly sourceHealthDetails: DashboardSnapshot['sourceHealthDetails'] | undefined
  readonly onDashboardChange: (dashboard: DashboardSnapshot) => void
  readonly onBack: () => void
}) {
  const sourceId = discoverySourceFromCatalogId(source.id)
  const isActive = source.acquisition === 'active' && sourceId !== null
  const isArxiv = sourceId === 'arxiv'
  const canRefresh = isActive && sourceId !== null && !sourceSearchesThroughDiscover(sourceId)
  const currentHealth = sourceId ? sourceHealth?.[sourceId] : undefined
  const currentHealthDetail = sourceId ? sourceHealthDetails?.[sourceId] : undefined
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
        const shouldAutoRefresh = cached.items.length === 0 && canRefresh
        if (!shouldAutoRefresh) return
        setIsRefreshing(true)
        try {
          const refreshed = await api.refreshSourceContent(sourceId)
          if (isCurrent) {
            setSnapshot(refreshed)
            const nextDashboard = await api.getDashboard().catch(() => null)
            if (isCurrent && nextDashboard) onDashboardChange(nextDashboard)
          }
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
  }, [api, canRefresh, isActive, onDashboardChange, sourceId])

  const refresh = useCallback(async () => {
    if (!canRefresh || sourceId === null) return
    setIsRefreshing(true)
    setError(null)
    try {
      setSnapshot(await api.refreshSourceContent(sourceId))
      const nextDashboard = await api.getDashboard().catch(() => null)
      if (nextDashboard) onDashboardChange(nextDashboard)
    } catch (reason) {
      setError(sourceErrorMessage(reason))
    } finally {
      setIsRefreshing(false)
    }
  }, [api, canRefresh, onDashboardChange, sourceId])

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
          <span className={`source-health source-health--${currentHealth ?? 'idle'}`}>
            {sourceHealthLabel(currentHealth)}
          </span>
        </div>
        <p className="eyebrow">
          {isArxiv ? 'SOURCE DESK · TODAY' : 'SOURCE DESK · ROLLING 30 DAYS'}
        </p>
        <h1>{source.name}</h1>
        <p>Retained research source with bounded in-app retrieval and explicit local evidence.</p>
        <div className="source-detail-actions">
          {isActive && (
            <button
              type="button"
              className="primary-button"
              disabled={!canRefresh || isRefreshing}
              onClick={() => void refresh()}
              aria-label="Refresh recent content"
            >
              <RefreshCw aria-hidden="true" size={15} />
              {isRefreshing ? 'Refreshing…' : 'Refresh recent content'}
            </button>
          )}
          <a href={source.url} target="_blank" rel="noreferrer" className="source-detail-link">
            Open official source
            <ArrowUpRight aria-hidden="true" size={14} />
          </a>
        </div>
      </header>

      <details className="source-provenance">
        <summary>Source provenance</summary>
        <dl>
          <div>
            <dt>Research role</dt>
            <dd>{source.role}</dd>
          </div>
          <div>
            <dt>Why retained</dt>
            <dd>{source.reason}</dd>
          </div>
          <div>
            <dt>Retrieval implementation</dt>
            <dd>
              {SOURCE_ACQUISITION_LABELS[source.acquisition]} · {source.accessNote}
            </dd>
          </div>
          <div>
            <dt>Catalog provenance</dt>
            <dd>{source.origin}</dd>
          </div>
          <div>
            <dt>Registry verification</dt>
            <dd>August 19, 2026 · dated verification, not a current-health promise</dd>
          </div>
        </dl>
      </details>

      <p className="source-detail-boundary">
        {isArxiv
          ? "This desk shows today's newest available arXiv daily batch without applying a Discover plan. arXiv can timestamp that batch on the previous submission day; use Discover for intent-based retrieval and ranking."
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

      {isActive && sourceId && sourceSearchesThroughDiscover(sourceId) && (
        <div className="source-detail-empty">
          <strong>Search GitHub from Discover.</strong>
          <p>
            GitHub needs bounded query terms from the current semantic plan. Previously indexed
            items remain visible here without reviving the retired Interests surface.
          </p>
        </div>
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
              <span>Last recorded health</span>
              <strong>
                {sourceHealthLabel(currentHealth)}
                {currentHealthDetail?.observedAt
                  ? ` · recorded ${formatTimestamp(currentHealthDetail.observedAt)}`
                  : ' · not yet observed'}
              </strong>
            </div>
            <div>
              <span>Local snapshot</span>
              <strong>{sourceSnapshotLabel(snapshot.status)}</strong>
            </div>
          </div>

          {currentHealthDetail?.errorMessage && (
            <p className="source-health-record" role="status">
              {currentHealthDetail.errorMessage}
            </p>
          )}

          <p className="source-content-status-note">
            {snapshot.status === 'cached'
              ? 'Showing stored local records; cache availability does not prove that the source is currently reachable.'
              : 'The local snapshot reflects the latest completed in-app source request.'}{' '}
            Latest indexed item:{' '}
            {snapshot.lastIndexedAt ? formatTimestamp(snapshot.lastIndexedAt) : 'not yet indexed'}.
          </p>

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

export function SourceCatalogView({
  api,
  sourceHealth,
  sourceHealthDetails,
  attentionOnly = false,
  onAttentionOnlyChange = () => undefined,
  onDashboardChange = () => undefined
}: SourceCatalogViewProps) {
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState<PriorityFilter>('all')
  const [researchAxis, setResearchAxis] = useState<ResearchAxisFilter>('all')
  const [selectedSource, setSelectedSource] = useState<SourceCatalogEntry | null>(null)
  const healthCounts = useMemo(() => summarizeSourceHealth(sourceHealth), [sourceHealth])

  const visibleSources = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return SOURCE_CATALOG.filter(
      (source) =>
        matchesSearch(source, normalizedQuery) &&
        (priority === 'all' || source.priority === priority) &&
        (researchAxis === 'all' || source.researchAxes.includes(researchAxis)) &&
        (!attentionOnly ||
          (() => {
            const sourceId = discoverySourceFromCatalogId(source.id)
            const health = sourceId ? sourceHealth?.[sourceId] : undefined
            return health === 'partial' || health === 'failed'
          })())
    )
  }, [attentionOnly, priority, query, researchAxis, sourceHealth])

  if (selectedSource) {
    return (
      <SourceDetail
        source={selectedSource}
        api={api}
        sourceHealth={sourceHealth}
        sourceHealthDetails={sourceHealthDetails}
        onDashboardChange={onDashboardChange}
        onBack={() => setSelectedSource(null)}
      />
    )
  }

  return (
    <section className="source-catalog-view">
      <header className="source-catalog-heading">
        <p className="eyebrow">RESEARCH SOURCE DIRECTORY</p>
        <h1>{SOURCE_CATALOG_STATS.total} configured research sources</h1>
        <p>
          These retained sources passed a dated deployment verification on August 19, 2026. Select
          one to inspect its separately recorded health and locally indexed content without leaving
          TheRSS.
        </p>
      </header>

      <div className="source-catalog-summary" role="group" aria-label="Source catalog summary">
        <SummaryMetric
          label="Configured sources"
          value={SOURCE_CATALOG_STATS.total}
          detail="Retained by a dated verification gate; membership is not current health"
        />
        <SummaryMetric
          label="Last recorded ready"
          value={healthCounts.ready}
          detail="Healthy or explicit no-result in the latest recorded observation"
        />
        <SummaryMetric
          label="Needs attention"
          value={healthCounts.attention}
          detail="Partial or failed in the latest recorded health"
        />
        <SummaryMetric
          label="Not checked"
          value={healthCounts.idle}
          detail={`${healthCounts.refreshing} refreshing · no current state is not a failure`}
        />
      </div>

      <p className="source-catalog-boundary">
        Catalog membership is not a live-health claim. These 22 sources passed the previous
        verification gate; current retrieval can still be healthy, empty, refreshing, partial, or
        failed. Other catalog candidates remain deferred and hidden.
      </p>

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
        <div className="source-attention-field">
          <span>Health</span>
          <button
            type="button"
            className="source-attention-filter"
            aria-label="Show sources needing attention"
            aria-pressed={attentionOnly}
            onClick={() => onAttentionOnlyChange(!attentionOnly)}
          >
            Needs attention
            <strong>{healthCounts.attention}</strong>
          </button>
        </div>
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
                  <span
                    className={`source-health source-health--${
                      discoverySourceFromCatalogId(source.id)
                        ? (sourceHealth?.[discoverySourceFromCatalogId(source.id)!] ?? 'idle')
                        : 'idle'
                    }`}
                  >
                    {sourceHealthLabel(
                      discoverySourceFromCatalogId(source.id)
                        ? sourceHealth?.[discoverySourceFromCatalogId(source.id)!]
                        : undefined
                    )}
                  </span>
                </div>
                <h2>{source.name}</h2>
                <div className="source-axis-list" aria-label={`${source.name} research axes`}>
                  {source.researchAxes.map((axis) => (
                    <span key={axis}>{RESEARCH_AXIS_LABELS[axis]}</span>
                  ))}
                </div>
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

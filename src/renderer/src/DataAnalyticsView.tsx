import { useCallback, useEffect, useState } from 'react'
import type { AnalyticsSnapshot } from '../../shared/analytics'
import { sourceDisplayName, sourceStyleToken } from '../../shared/sourceIdentity'
import type { TheRSSApi } from '../../shared/api'

interface DataAnalyticsViewProps {
  readonly api: TheRSSApi
}

function SummaryCard({
  label,
  value,
  detail
}: {
  readonly label: string
  readonly value: number
  readonly detail: string
}) {
  return (
    <article className="analytics-summary-card" aria-label={label}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  )
}

function AnalyticsContent({ snapshot }: { readonly snapshot: AnalyticsSnapshot }) {
  const maxDailyResults = Math.max(1, ...snapshot.daily.map((day) => day.searchResults))

  return (
    <section className="analytics-view">
      <header className="analytics-heading">
        <p className="eyebrow">LOCAL EVIDENCE</p>
        <h1>Data Analytics</h1>
        <p>
          Daily result volume and deep-analysis activity from this local research index. No usage
          data leaves this device.
        </p>
      </header>

      <div className="analytics-summary" role="group" aria-label="Analytics summary">
        <SummaryCard
          label="Search results"
          value={snapshot.totals.searchResults}
          detail={`${snapshot.totals.todayResults} legacy Today · ${snapshot.totals.discoverResults} Discover`}
        />
        <SummaryCard
          label="Deep analyses"
          value={snapshot.totals.deepAnalyses}
          detail="Persisted model and local-agent analysis runs"
        />
        <SummaryCard
          label="Analyzed papers"
          value={snapshot.totals.analyzedPapers}
          detail="Distinct paper records with an analysis artifact"
        />
      </div>

      <section className="analytics-section" aria-labelledby="daily-activity-heading">
        <div className="analytics-section__heading">
          <div>
            <p className="eyebrow">RECENT WINDOW</p>
            <h2 id="daily-activity-heading">Daily search activity</h2>
          </div>
          <span>Last {snapshot.windowDays} local days</span>
        </div>

        {snapshot.totals.searchResults === 0 ? (
          <div className="analytics-empty">
            <strong>No search activity recorded yet.</strong>
            <p>Run a semantic Discover search to start this view.</p>
          </div>
        ) : (
          <div className="analytics-table-wrap">
            <table aria-label="Daily search and analysis activity">
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Legacy Today</th>
                  <th scope="col">Discover</th>
                  <th scope="col">Total</th>
                  <th scope="col">Deep analyses</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.daily.map((day) => (
                  <tr key={day.date}>
                    <th scope="row">{day.date}</th>
                    <td>{day.todayResults}</td>
                    <td>{day.discoverResults}</td>
                    <td className="analytics-total-cell">
                      <span>{day.searchResults}</span>
                      <span className="analytics-bar" aria-hidden="true">
                        <span
                          className="analytics-bar__today"
                          style={{ width: `${(day.todayResults / maxDailyResults) * 100}%` }}
                        />
                        <span
                          className="analytics-bar__discover"
                          style={{ width: `${(day.discoverResults / maxDailyResults) * 100}%` }}
                        />
                      </span>
                    </td>
                    <td>{day.deepAnalyses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="analytics-boundary">
          Search results are returned records, not unique discoveries; repeated refreshes may
          include the same result again. Legacy Today history starts when this analytics version
          records it
          {snapshot.trackingStartedAt
            ? ` (${new Date(snapshot.trackingStartedAt).toLocaleString()}).`
            : '.'}
        </p>
      </section>

      <section className="analytics-section" aria-labelledby="analysis-history-heading">
        <div className="analytics-section__heading">
          <div>
            <p className="eyebrow">PROVENANCE LEDGER</p>
            <h2 id="analysis-history-heading">Deep analysis history</h2>
          </div>
          <span>Latest 50 runs</span>
        </div>

        {snapshot.analyzedItems.length === 0 ? (
          <div className="analytics-empty">
            <strong>No deep analyses recorded yet.</strong>
            <p>
              Analyze a paper from Discover, or a paper or repository from Saved, to create an
              auditable record.
            </p>
          </div>
        ) : (
          <ol className="analytics-history" aria-label="Deep analysis history">
            {snapshot.analyzedItems.map((item) => (
              <li key={item.analysisId}>
                <span className={`source-mark source-mark--${sourceStyleToken(item.source)}`}>
                  {sourceDisplayName(item.source).toLocaleUpperCase()}
                </span>
                <div>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.title}
                  </a>
                  <span>
                    {item.providerName} · {item.model}
                  </span>
                </div>
                <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  )
}

export function DataAnalyticsView({ api }: DataAnalyticsViewProps) {
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const retry = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setSnapshot(await api.getAnalytics())
    } catch {
      setSnapshot(null)
      setError('The local analytics could not be loaded.')
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    let isActive = true
    api
      .getAnalytics()
      .then((nextSnapshot) => {
        if (!isActive) return
        setSnapshot(nextSnapshot)
        setError(null)
      })
      .catch(() => {
        if (!isActive) return
        setSnapshot(null)
        setError('The local analytics could not be loaded.')
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })
    return () => {
      isActive = false
    }
  }, [api])

  if (isLoading) {
    return <div className="loading-state">Compiling local analytics…</div>
  }

  if (error || !snapshot) {
    return (
      <section className="analytics-load-error" aria-live="polite">
        <strong>{error ?? 'The local analytics could not be loaded.'}</strong>
        <button type="button" className="primary-button" onClick={() => void retry()}>
          Retry analytics
        </button>
      </section>
    )
  }

  return <AnalyticsContent snapshot={snapshot} />
}

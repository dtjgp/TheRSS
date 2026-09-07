import type Database from 'better-sqlite3'
import type { DashboardSnapshot, SourceHealth } from '../../shared/api'
import type { DiscoverySource } from '../../shared/discovery'
import { ACTIVE_TODAY_SOURCE_IDS } from '../../shared/sourceIdentity'

export interface SourceRunRow {
  readonly source: DiscoverySource
  readonly status: Exclude<SourceHealth, 'no_results'>
  readonly completed_at: string
  readonly error_message: string | null
  readonly result_count: number | null
}

interface SearchObservation {
  readonly source: DiscoverySource
  readonly status: 'healthy' | 'no_results' | 'partial' | 'failed'
  readonly observed_at: string
  readonly error_message: string | null
}

function boundedSourceError(value: string | null): string | null {
  return value
    ? value
        .replaceAll(/\b(?:hf|ghp|github_pat)_[A-Za-z0-9_-]+\b/gu, '[redacted credential]')
        .replaceAll(/\/(?:Users|home)\/[^\s:]+/gu, '[local path]')
        .replaceAll(/\s+/gu, ' ')
        .trim()
        .slice(0, 300)
    : null
}

export function readSourceHealthDetails(
  database: Database.Database,
  sourceRuns: readonly SourceRunRow[]
): DashboardSnapshot['sourceHealthDetails'] {
  // Search timestamps are the stored session time, not invented per-source completion times.
  // Canceled and unselected sources say nothing about availability; retain their last observation.
  const searches = database
    .prepare(
      `
    SELECT source, status, observed_at, error_message FROM (
      SELECT r.source, r.status, s.created_at AS observed_at, r.error_message,
        ROW_NUMBER() OVER (PARTITION BY r.source ORDER BY julianday(s.created_at) DESC, s.id DESC) AS position
      FROM discover_source_run r JOIN discover_session s ON s.id = r.session_id
      WHERE r.status IN ('healthy', 'no_results', 'partial', 'failed')
        AND julianday(s.created_at) IS NOT NULL
    ) WHERE position = 1
  `
    )
    .all() as SearchObservation[]
  return Object.fromEntries(
    ACTIVE_TODAY_SOURCE_IDS.map((source) => {
      const run = sourceRuns.find((row) => row.source === source)
      const search = searches.find((row) => row.source === source)
      const runTime = run ? Date.parse(run.completed_at) : NaN
      const searchTime = search ? Date.parse(search.observed_at) : NaN
      if (
        search &&
        Number.isFinite(searchTime) &&
        (!Number.isFinite(runTime) || searchTime > runTime)
      ) {
        return [
          source,
          {
            status: search.status,
            observedAt: search.observed_at,
            errorMessage: boundedSourceError(search.error_message),
            context: 'discover'
          }
        ]
      }
      if (run)
        return [
          source,
          {
            status: run.status === 'healthy' && run.result_count === 0 ? 'no_results' : run.status,
            observedAt: Number.isFinite(runTime) ? run.completed_at : null,
            errorMessage: boundedSourceError(run.error_message),
            context: 'source'
          }
        ]
      return [source, { status: 'idle', observedAt: null, errorMessage: null }]
    })
  ) as DashboardSnapshot['sourceHealthDetails']
}

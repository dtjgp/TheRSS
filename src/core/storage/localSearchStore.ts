import type Database from 'better-sqlite3'
import {
  localSearchQuerySchema,
  type LocalSearchResponse,
  type LocalSearchResult,
  type LocalSearchResultKind
} from '../../shared/localSearch'
import type { DiscoverySource } from '../../shared/discovery'
import { isDiscoverySource } from '../../shared/sourceIdentity'

interface LocalSearchRow {
  id: string
  kind: LocalSearchResultKind
  item_id: string
  title: string
  detail: string
  url: string
  source: DiscoverySource
  created_at: string
}

function escapedLikePattern(query: string): string {
  return `%${query.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
}

function parseRows(rows: readonly LocalSearchRow[]): LocalSearchResult[] {
  return rows.map((row) => {
    if (!isDiscoverySource(row.source)) {
      throw new Error('The local search index contains an unsupported source')
    }
    return {
      id: row.id,
      kind: row.kind,
      itemId: row.item_id,
      title: row.title,
      detail: row.detail,
      url: row.url,
      source: row.source,
      createdAt: row.created_at
    }
  })
}

export function searchLocal(database: Database.Database, candidate: string): LocalSearchResponse {
  const query = localSearchQuerySchema.parse(candidate)
  const pattern = escapedLikePattern(query)
  const savedRows = database
    .prepare(
      `SELECT d.id AS id, 'saved' AS kind, d.id AS item_id, d.title,
              substr(d.summary, 1, 300) AS detail, d.url, d.source,
              d.triage_updated_at AS created_at
       FROM discovery_item d
       WHERE d.triage_state = 'saved'
         AND (d.title LIKE ? ESCAPE '\\' COLLATE NOCASE
              OR d.summary LIKE ? ESCAPE '\\' COLLATE NOCASE
              OR d.reasons_json LIKE ? ESCAPE '\\' COLLATE NOCASE)
       ORDER BY d.triage_updated_at DESC, d.id ASC
       LIMIT 25`
    )
    .all(pattern, pattern, pattern) as LocalSearchRow[]
  const discoverRows = database
    .prepare(
      `WITH matched AS (
         SELECT s.id || ':' || r.item_id AS id, 'discover' AS kind, r.item_id,
                r.title, substr(r.summary, 1, 300) AS detail, r.url, r.source,
                s.created_at,
                row_number() OVER (
                  PARTITION BY r.item_id ORDER BY s.created_at DESC, s.id DESC
                ) AS item_rank
         FROM discover_result r
         INNER JOIN discover_session s ON s.id = r.session_id
         WHERE r.title LIKE ? ESCAPE '\\' COLLATE NOCASE
            OR r.summary LIKE ? ESCAPE '\\' COLLATE NOCASE
            OR r.reasons_json LIKE ? ESCAPE '\\' COLLATE NOCASE
            OR s.intent LIKE ? ESCAPE '\\' COLLATE NOCASE
       )
       SELECT id, kind, item_id, title, detail, url, source, created_at
       FROM matched
       WHERE item_rank = 1
       ORDER BY created_at DESC, item_id ASC
       LIMIT 25`
    )
    .all(pattern, pattern, pattern, pattern) as LocalSearchRow[]
  const analysisRows = database
    .prepare(
      `SELECT a.id AS id, 'analysis' AS kind, a.item_id, d.title,
              a.provider_name || ' · ' || a.model AS detail, d.url, d.source,
              a.created_at
       FROM analysis_artifact a
       INNER JOIN discovery_item d ON d.id = a.item_id
       WHERE d.title LIKE ? ESCAPE '\\' COLLATE NOCASE
          OR a.provider_name LIKE ? ESCAPE '\\' COLLATE NOCASE
          OR a.model LIKE ? ESCAPE '\\' COLLATE NOCASE
          OR a.content LIKE ? ESCAPE '\\' COLLATE NOCASE
       ORDER BY a.created_at DESC, a.id ASC
       LIMIT 25`
    )
    .all(pattern, pattern, pattern, pattern) as LocalSearchRow[]

  const results = parseRows([...savedRows, ...discoverRows, ...analysisRows])
    .sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) ||
        left.kind.localeCompare(right.kind) ||
        left.id.localeCompare(right.id)
    )
    .slice(0, 50)
  return { query, results }
}

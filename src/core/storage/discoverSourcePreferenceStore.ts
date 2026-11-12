import type Database from 'better-sqlite3'
import { DISCOVER_SOURCE_IDS } from '../../shared/discover'
import {
  discoverSourcePreferenceInputSchema,
  orderedDiscoverSources,
  type DiscoverSourcePreference,
  type DiscoverSourcePreferenceOrigin
} from '../../shared/discoverSourcePreference'

export const DISCOVER_SOURCE_PREFERENCE_TABLE = `
    CREATE TABLE IF NOT EXISTS discover_source_preference (
      singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
      sources_json TEXT NOT NULL,
      origin TEXT NOT NULL CHECK (origin IN ('latest-session', 'all-sources', 'user')),
      updated_at TEXT NOT NULL
    );`

/**
 * One-time initialization when the preference row is missing (new database or upgrade): the
 * latest session that searched at least one current source, else all current sources. It runs
 * inside the schema migration and never starts a search. An existing row is never replaced.
 */
export function initializeDiscoverSourcePreference(
  database: Database.Database,
  now = new Date().toISOString()
): void {
  const exists = database
    .prepare('SELECT 1 FROM discover_source_preference WHERE singleton_id = 1')
    .get()
  if (exists) return
  const sessions = database
    .prepare('SELECT id FROM discover_session ORDER BY created_at DESC, id DESC')
    .all() as Array<{ id: string }>
  const searched = database.prepare(
    "SELECT source FROM discover_source_run WHERE session_id = ? AND status <> 'not_searched'"
  )
  let sources: string[] = [...DISCOVER_SOURCE_IDS]
  let origin: DiscoverSourcePreferenceOrigin = 'all-sources'
  for (const { id } of sessions) {
    const current = orderedDiscoverSources(
      (searched.all(id) as Array<{ source: string }>).map(({ source }) => source)
    )
    if (current.length) {
      sources = current
      origin = 'latest-session'
      break
    }
  }
  database
    .prepare(
      `INSERT INTO discover_source_preference(singleton_id, sources_json, origin, updated_at)
       VALUES (1, ?, ?, ?)`
    )
    .run(JSON.stringify(sources), origin, now)
}

export function readDiscoverSourcePreference(
  database: Database.Database
): DiscoverSourcePreference {
  const row = database
    .prepare(
      `SELECT sources_json, origin, updated_at FROM discover_source_preference
       WHERE singleton_id = 1`
    )
    .get() as
    { sources_json: string; origin: DiscoverSourcePreferenceOrigin; updated_at: string } | undefined
  if (!row) throw new Error('The default Discover sources are missing.')
  const stored: unknown = JSON.parse(row.sources_json)
  if (!Array.isArray(stored) || !stored.every((value) => typeof value === 'string'))
    throw new Error('The default Discover sources are unreadable.')
  const current = new Set<string>(DISCOVER_SOURCE_IDS)
  return {
    sources: orderedDiscoverSources(stored),
    unavailable: [...new Set(stored.filter((value) => !current.has(value)))],
    origin: row.origin,
    updatedAt: row.updated_at
  }
}

export function saveDiscoverSourcePreference(
  database: Database.Database,
  candidate: unknown,
  now = new Date().toISOString()
): DiscoverSourcePreference {
  const sources = orderedDiscoverSources(discoverSourcePreferenceInputSchema.parse(candidate))
  database
    .prepare(
      `INSERT INTO discover_source_preference(singleton_id, sources_json, origin, updated_at)
       VALUES (1, ?, 'user', ?)
       ON CONFLICT(singleton_id) DO UPDATE SET
         sources_json = excluded.sources_json,
         origin = excluded.origin,
         updated_at = excluded.updated_at`
    )
    .run(JSON.stringify(sources), now)
  return { sources, unavailable: [], origin: 'user', updatedAt: now }
}

import type Database from 'better-sqlite3'
import type { DiscoveryItemKind, DiscoverySource } from '../../shared/discovery'
import {
  DISCOVER_SOURCE_IDS,
  type DiscoverSnapshot,
  type DiscoverSourceOutcome
} from '../../shared/discover'
import { parseDiscoverPlan } from '../discover/discoverPlan'
import { parseStringList } from './rowParsers'

interface DiscoverSessionRow {
  id: string
  intent: string
  runner: DiscoverSnapshot['runner']
  status: DiscoverSnapshot['status']
  plan_json: string
  provenance_json: string
  created_at: string
}

interface DiscoverSourceRunRow {
  source: DiscoverySource
  status: DiscoverSourceOutcome['status']
  result_count: number
  error_message: string | null
}

interface DiscoverResultRow {
  item_id: string
  source: DiscoverySource
  item_kind: DiscoveryItemKind
  external_id: string
  title: string
  summary: string
  url: string
  published_at: string
  updated_at: string
  authors_json: string
  categories_json: string
  topics_json: string
  language: string | null
  stars: number | null
  score: number
  reasons_json: string
  saved: number
}

function parseDiscoverProvenance(value: string): DiscoverSnapshot['provenance'] {
  const parsed: unknown = JSON.parse(value)
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('providerId' in parsed) ||
    typeof parsed.providerId !== 'string' ||
    !('providerName' in parsed) ||
    typeof parsed.providerName !== 'string' ||
    !('model' in parsed) ||
    typeof parsed.model !== 'string' ||
    !('promptVersion' in parsed) ||
    (parsed.promptVersion !== 'semantic-discover-v1' &&
      parsed.promptVersion !== 'semantic-discover-v2') ||
    (parsed.promptVersion === 'semantic-discover-v2' && !('personalizationApplied' in parsed)) ||
    ('personalizationApplied' in parsed && typeof parsed.personalizationApplied !== 'boolean') ||
    !('inputHash' in parsed) ||
    typeof parsed.inputHash !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(parsed.inputHash) ||
    !('createdAt' in parsed) ||
    typeof parsed.createdAt !== 'string'
  ) {
    throw new Error('The local index contains invalid Discover provenance')
  }
  return {
    providerId: parsed.providerId,
    providerName: parsed.providerName,
    model: parsed.model,
    promptVersion: parsed.promptVersion,
    personalizationApplied:
      'personalizationApplied' in parsed && typeof parsed.personalizationApplied === 'boolean'
        ? parsed.personalizationApplied
        : false,
    inputHash: parsed.inputHash,
    createdAt: parsed.createdAt
  }
}

export function saveDiscoverSnapshot(
  database: Database.Database,
  snapshot: DiscoverSnapshot
): void {
  const save = database.transaction(() => {
    database
      .prepare(
        `INSERT INTO discover_session(
           id, intent, runner, status, plan_json, provenance_json, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           intent = excluded.intent,
           runner = excluded.runner,
           status = excluded.status,
           plan_json = excluded.plan_json,
           provenance_json = excluded.provenance_json,
           created_at = excluded.created_at`
      )
      .run(
        snapshot.id,
        snapshot.intent,
        snapshot.runner,
        snapshot.status,
        JSON.stringify(snapshot.plan),
        JSON.stringify(snapshot.provenance),
        snapshot.createdAt
      )

    database.prepare('DELETE FROM discover_source_run WHERE session_id = ?').run(snapshot.id)
    const saveSource = database.prepare(
      `INSERT INTO discover_source_run(
         session_id, source, status, result_count, error_message
       ) VALUES (?, ?, ?, ?, ?)`
    )
    for (const source of DISCOVER_SOURCE_IDS) {
      const outcome = snapshot.sourceOutcomes[source] ?? {
        status: 'not_searched',
        resultCount: 0,
        error: null
      }
      saveSource.run(snapshot.id, source, outcome.status, outcome.resultCount, outcome.error)
    }

    database.prepare('DELETE FROM discover_result WHERE session_id = ?').run(snapshot.id)
    const saveResult = database.prepare(
      `INSERT INTO discover_result(
         session_id, item_id, source, item_kind, external_id, title, summary, url,
         published_at, updated_at, authors_json, categories_json, topics_json,
         language, stars, score, reasons_json, result_rank
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    snapshot.items.forEach((item, rank) => {
      saveResult.run(
        snapshot.id,
        item.id,
        item.source,
        item.kind,
        item.externalId,
        item.title,
        item.summary,
        item.url,
        item.publishedAt,
        item.updatedAt,
        JSON.stringify(item.authors),
        JSON.stringify(item.categories),
        JSON.stringify(item.topics),
        item.language,
        item.stars,
        item.score,
        JSON.stringify(item.reasons),
        rank
      )
    })
  })
  save()
}

export function getLatestDiscoverSnapshot(database: Database.Database): DiscoverSnapshot | null {
  const session = database
    .prepare(
      `SELECT id, intent, runner, status, plan_json, provenance_json, created_at
       FROM discover_session
       ORDER BY created_at DESC, id DESC
       LIMIT 1`
    )
    .get() as DiscoverSessionRow | undefined
  if (!session) return null

  const sourceRows = database
    .prepare(
      `SELECT source, status, result_count, error_message
       FROM discover_source_run WHERE session_id = ?`
    )
    .all(session.id) as DiscoverSourceRunRow[]
  const sourceOutcome = (source: DiscoverySource): DiscoverSourceOutcome => {
    const row = sourceRows.find((candidate) => candidate.source === source)
    return row
      ? { status: row.status, resultCount: row.result_count, error: row.error_message }
      : { status: 'not_searched', resultCount: 0, error: null }
  }

  const resultRows = database
    .prepare(
      `SELECT r.item_id, r.source, r.item_kind, r.external_id, r.title, r.summary, r.url,
              r.published_at, r.updated_at, r.authors_json, r.categories_json,
              r.topics_json, r.language, r.stars, r.score, r.reasons_json,
              CASE WHEN d.triage_state = 'saved' THEN 1 ELSE 0 END AS saved
       FROM discover_result r
       LEFT JOIN discovery_item d ON d.id = r.item_id
       WHERE r.session_id = ?
       ORDER BY r.result_rank ASC, r.item_id ASC`
    )
    .all(session.id) as DiscoverResultRow[]
  const items = resultRows.map((row) => ({
    id: row.item_id,
    source: row.source,
    kind: row.item_kind,
    externalId: row.external_id,
    title: row.title,
    summary: row.summary,
    url: row.url,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    authors: parseStringList(row.authors_json),
    categories: parseStringList(row.categories_json),
    topics: parseStringList(row.topics_json),
    language: row.language,
    stars: row.stars,
    metrics: {},
    score: row.score,
    reasons: parseStringList(row.reasons_json),
    saved: row.saved === 1
  }))

  const sourceOutcomes = Object.fromEntries(
    DISCOVER_SOURCE_IDS.map((source) => [source, sourceOutcome(source)])
  ) as DiscoverSnapshot['sourceOutcomes']
  const bySource = Object.fromEntries(
    DISCOVER_SOURCE_IDS.map((source) => [
      source,
      items.filter((item) => item.source === source).length
    ])
  ) as DiscoverSnapshot['counts']['bySource']
  const byKind = Object.fromEntries(
    (['paper', 'repository', 'article', 'model', 'dataset', 'post'] as const).map((kind) => [
      kind,
      items.filter((item) => item.kind === kind).length
    ])
  ) as DiscoverSnapshot['counts']['byKind']

  return {
    id: session.id,
    intent: session.intent,
    runner: session.runner,
    status: session.status,
    createdAt: session.created_at,
    plan: parseDiscoverPlan(session.plan_json),
    provenance: parseDiscoverProvenance(session.provenance_json),
    sourceOutcomes,
    counts: {
      total: items.length,
      arxiv: items.filter((item) => item.source === 'arxiv').length,
      github: items.filter((item) => item.source === 'github').length,
      byKind,
      bySource
    },
    items
  }
}

function getDiscoverResult(
  database: Database.Database,
  sessionId: string,
  itemId: string
): DiscoverResultRow {
  const row = database
    .prepare(
      `SELECT item_id, source, item_kind, external_id, title, summary, url, published_at,
              updated_at, authors_json, categories_json, topics_json, language,
              stars, score, reasons_json, 0 AS saved
       FROM discover_result WHERE session_id = ? AND item_id = ?`
    )
    .get(sessionId, itemId) as DiscoverResultRow | undefined
  if (!row) throw new Error(`Unknown Discover result: ${itemId}`)
  return row
}

function upsertDiscoverResult(
  database: Database.Database,
  row: DiscoverResultRow,
  initialState: 'viewed' | 'saved',
  forceSaved: boolean,
  updatedAt: string
): void {
  database
    .prepare(
      `INSERT INTO discovery_item(
         id, source, item_kind, external_id, title, summary, url, published_at, updated_at,
         authors_json, categories_json, topics_json, language, stars, score,
         excluded, reasons_json, in_daily_inbox, triage_state, triage_updated_at,
         first_seen_at, last_seen_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         item_kind = excluded.item_kind,
         title = excluded.title,
         summary = excluded.summary,
         url = excluded.url,
         published_at = excluded.published_at,
         updated_at = excluded.updated_at,
         authors_json = excluded.authors_json,
         categories_json = excluded.categories_json,
         topics_json = excluded.topics_json,
         language = excluded.language,
         stars = excluded.stars,
         score = excluded.score,
         excluded = 0,
         reasons_json = excluded.reasons_json,
         triage_state = CASE WHEN ? = 1 THEN 'saved' ELSE discovery_item.triage_state END,
         triage_updated_at = CASE
           WHEN ? = 1 THEN excluded.triage_updated_at
           ELSE discovery_item.triage_updated_at
         END,
         last_seen_at = excluded.last_seen_at`
    )
    .run(
      row.item_id,
      row.source,
      row.item_kind,
      row.external_id,
      row.title,
      row.summary,
      row.url,
      row.published_at,
      row.updated_at,
      row.authors_json,
      row.categories_json,
      row.topics_json,
      row.language,
      row.stars,
      row.score,
      row.reasons_json,
      initialState,
      updatedAt,
      updatedAt,
      updatedAt,
      forceSaved ? 1 : 0,
      forceSaved ? 1 : 0
    )
}

export function saveDiscoverResult(
  database: Database.Database,
  sessionId: string,
  itemId: string,
  updatedAt: string
): void {
  upsertDiscoverResult(
    database,
    getDiscoverResult(database, sessionId, itemId),
    'saved',
    true,
    updatedAt
  )
}

export function materializeDiscoverResultForAnalysis(
  database: Database.Database,
  sessionId: string,
  itemId: string,
  updatedAt: string
): void {
  const row = getDiscoverResult(database, sessionId, itemId)
  if (row.item_kind !== 'paper') {
    throw new Error('Discover analysis is available only for paper results')
  }
  upsertDiscoverResult(database, row, 'viewed', false, updatedAt)
}

export function materializeDiscoverResultForLlmWikiPromotion(
  database: Database.Database,
  sessionId: string,
  itemId: string,
  updatedAt: string
): void {
  const row = getDiscoverResult(database, sessionId, itemId)
  if (row.source !== 'arxiv' || row.item_kind !== 'paper') {
    throw new Error('llm-wiki promotion is available only for arXiv paper results')
  }
  upsertDiscoverResult(database, row, 'viewed', false, updatedAt)
}

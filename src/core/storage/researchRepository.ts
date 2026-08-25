import type Database from 'better-sqlite3'
import { interestProfileSchema, type InterestProfile } from '../interests/interestProfile'
import type {
  DiscoveryItem,
  DiscoveryItemKind,
  DiscoverySource,
  RankedDiscoveryItem
} from '../../shared/discovery'
import {
  DISCOVER_SOURCE_IDS,
  type DiscoverSnapshot,
  type DiscoverSourceOutcome
} from '../../shared/discover'
import type { AnalyticsSnapshot } from '../../shared/analytics'
import type {
  DashboardItem,
  DashboardSnapshot,
  SourceContentSnapshot,
  SourceHealth,
  TriageState
} from '../../shared/api'
import type { ModelProviderSummary } from '../../shared/models'
import type { AnalysisArtifact } from '../../shared/models'
import {
  discoverPersonalizationPromptSchema,
  type DiscoverPersonalizationSettings
} from '../../shared/personalization'
import { localDateKey } from '../../shared/date'
import { parseDiscoverPlan } from '../discover/discoverPlan'
import { buildAnalyticsSnapshot } from './analyticsRepository'
import { migrateResearchDatabase } from './researchSchema'
import {
  clearModelProviderCredential,
  getModelProvider,
  saveModelProvider,
  type StoredModelProvider
} from './modelProviderStore'
import {
  getLatestAnalysis,
  getLatestLlmWikiPromotionReceipt,
  reconcileInterruptedLlmWikiPromotions,
  saveAnalysis,
  saveLlmWikiPromotionReceipt
} from './analysisArtifactStore'
import { parseStringList } from './rowParsers'

// Re-exported so consumers keep importing the storage facade rather than its internals.
export type { StoredModelProvider } from './modelProviderStore'
import { ACTIVE_TODAY_SOURCE_IDS, isDiscoverySource } from '../../shared/sourceIdentity'
import type { LlmWikiPromotionReceipt } from '../../shared/llmWikiPromotion'

const TRIAGE_STATES = new Set<TriageState>(['new', 'viewed', 'saved', 'dismissed'])
type PersistedSourceHealth = Exclude<SourceHealth, 'no_results'>
const SOURCE_HEALTH = new Set<PersistedSourceHealth>([
  'idle',
  'refreshing',
  'healthy',
  'partial',
  'failed'
])

function boundedSourceError(value: string): string {
  return value
    .replaceAll(/\b(?:hf|ghp|github_pat)_[A-Za-z0-9_-]+\b/gu, '[redacted credential]')
    .replaceAll(/\/(?:Users|home)\/[^\s:]+/gu, '[local path]')
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .slice(0, 300)
}

interface DashboardRow {
  id: string
  source: DiscoverySource
  item_kind: DiscoveryItemKind
  title: string
  summary: string
  url: string
  published_at: string
  score: number
  triage_state: TriageState
  reasons_json: string
}

interface SourceContentRow extends DashboardRow {
  updated_at: string
}

interface SourceRunRow {
  source: DiscoverySource
  status: PersistedSourceHealth
  completed_at: string
  error_message: string | null
  result_count: number | null
}

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

interface DiscoveryRecordRow {
  id: string
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

export class ResearchRepository {
  readonly #database: Database.Database

  constructor(database: Database.Database, options: { readonly migrate?: boolean } = {}) {
    this.#database = database
    if (options.migrate !== false) migrateResearchDatabase(database)
  }

  saveInterestProfile(profile: InterestProfile, updatedAt = new Date().toISOString()): void {
    const validatedProfile = interestProfileSchema.parse(profile)
    this.#database
      .prepare(
        `INSERT INTO interest_profile(singleton_id, profile_json, updated_at)
         VALUES (1, ?, ?)
         ON CONFLICT(singleton_id) DO UPDATE SET
           profile_json = excluded.profile_json,
           updated_at = excluded.updated_at`
      )
      .run(JSON.stringify(validatedProfile), updatedAt)
  }

  getInterestProfile(): InterestProfile | null {
    const row = this.#database
      .prepare('SELECT profile_json FROM interest_profile WHERE singleton_id = 1')
      .get() as { profile_json: string } | undefined

    return row ? interestProfileSchema.parse(JSON.parse(row.profile_json)) : null
  }

  saveDiscoverPersonalizationPrompt(
    prompt: string,
    updatedAt = new Date().toISOString()
  ): DiscoverPersonalizationSettings {
    const validatedPrompt = discoverPersonalizationPromptSchema.parse(prompt)
    this.#database
      .prepare(
        `INSERT INTO discover_personalization(singleton_id, prompt, updated_at)
         VALUES (1, ?, ?)
         ON CONFLICT(singleton_id) DO UPDATE SET
           prompt = excluded.prompt,
           updated_at = excluded.updated_at`
      )
      .run(validatedPrompt, updatedAt)
    return { prompt: validatedPrompt, updatedAt }
  }

  getDiscoverPersonalizationSettings(): DiscoverPersonalizationSettings | null {
    const row = this.#database
      .prepare(
        `SELECT prompt, updated_at
         FROM discover_personalization WHERE singleton_id = 1`
      )
      .get() as { prompt: string; updated_at: string } | undefined

    return row
      ? {
          prompt: discoverPersonalizationPromptSchema.parse(row.prompt),
          updatedAt: row.updated_at
        }
      : null
  }

  #upsertRankedItems(
    items: readonly RankedDiscoveryItem[],
    seenAt: string,
    inDailyInbox: boolean
  ): void {
    const statement = this.#database.prepare(`
      INSERT INTO discovery_item(
        id, source, item_kind, external_id, title, summary, url, published_at, updated_at,
        authors_json, categories_json, topics_json, language, stars, score,
        excluded, reasons_json, in_daily_inbox, triage_state, triage_updated_at,
        first_seen_at, last_seen_at
      ) VALUES (
        @id, @source, @kind, @externalId, @title, @summary, @url, @publishedAt, @updatedAt,
        @authors, @categories, @topics, @language, @stars, @score,
        @excluded, @reasons, @inDailyInbox, 'new', @seenAt, @seenAt, @seenAt
      )
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
        excluded = excluded.excluded,
        reasons_json = excluded.reasons_json,
        in_daily_inbox = CASE
          WHEN excluded.in_daily_inbox = 1 THEN 1
          ELSE discovery_item.in_daily_inbox
        END,
        last_seen_at = excluded.last_seen_at
    `)

    const writeItems = this.#database.transaction((rankedItems: readonly RankedDiscoveryItem[]) => {
      for (const ranked of rankedItems) {
        statement.run({
          ...ranked.item,
          authors: JSON.stringify(ranked.item.authors),
          categories: JSON.stringify(ranked.item.categories),
          topics: JSON.stringify(ranked.item.topics),
          score: ranked.score,
          excluded: ranked.excluded ? 1 : 0,
          reasons: JSON.stringify(ranked.reasons.map((reason) => reason.label)),
          inDailyInbox: inDailyInbox ? 1 : 0,
          seenAt
        })
      }
    })

    writeItems(items)
  }

  upsertRankedItems(
    items: readonly RankedDiscoveryItem[],
    seenAt = new Date().toISOString()
  ): void {
    this.#upsertRankedItems(items, seenAt, true)
  }

  upsertSourceHistoryItems(
    items: readonly RankedDiscoveryItem[],
    seenAt = new Date().toISOString()
  ): void {
    this.#upsertRankedItems(items, seenAt, false)
  }

  replaceDailySourceItems(
    source: DiscoverySource,
    items: readonly RankedDiscoveryItem[],
    seenAt = new Date().toISOString()
  ): void {
    if (!isDiscoverySource(source)) throw new Error(`Unsupported discovery source: ${source}`)
    if (items.some((ranked) => ranked.item.source !== source)) {
      throw new Error(`A ${source} refresh cannot persist items from another source`)
    }

    const replace = this.#database.transaction(() => {
      this.#database
        .prepare('UPDATE discovery_item SET in_daily_inbox = 0 WHERE source = ?')
        .run(source)
      this.upsertRankedItems(items, seenAt)
    })
    replace()
  }

  setTriageState(id: string, state: TriageState, updatedAt = new Date().toISOString()): void {
    if (!TRIAGE_STATES.has(state)) {
      throw new Error(`Unsupported triage state: ${state}`)
    }

    const result = this.#database
      .prepare('UPDATE discovery_item SET triage_state = ?, triage_updated_at = ? WHERE id = ?')
      .run(state, updatedAt, id)
    if (result.changes === 0) {
      throw new Error(`Unknown discovery item: ${id}`)
    }
  }

  listDashboardItems(limit = 500): DashboardItem[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new Error('Dashboard limit must be between 1 and 500')
    }

    const sourcePlaceholders = ACTIVE_TODAY_SOURCE_IDS.map(() => '?').join(', ')
    const rows = this.#database
      .prepare(
        `SELECT id, source, item_kind, title, summary, url, published_at, score,
                triage_state, reasons_json
         FROM discovery_item
         WHERE in_daily_inbox = 1
           AND source IN (${sourcePlaceholders})
           AND excluded = 0
           AND triage_state != 'dismissed'
         ORDER BY score DESC, published_at DESC, id ASC
         LIMIT ?`
      )
      .all(...ACTIVE_TODAY_SOURCE_IDS, limit) as DashboardRow[]

    return rows.map((row) => ({
      id: row.id,
      source: row.source,
      kind: row.item_kind,
      title: row.title,
      summary: row.summary,
      url: row.url,
      publishedAt: row.published_at,
      score: row.score,
      triageState: row.triage_state,
      reasons: parseStringList(row.reasons_json)
    }))
  }

  listSavedItems(limit = 100): DashboardItem[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new Error('Saved-items limit must be between 1 and 500')
    }

    const rows = this.#database
      .prepare(
        `SELECT id, source, item_kind, title, summary, url, published_at, score,
                triage_state, reasons_json
         FROM discovery_item
         WHERE excluded = 0 AND triage_state = 'saved'
         ORDER BY triage_updated_at DESC, score DESC, id ASC
         LIMIT ?`
      )
      .all(limit) as DashboardRow[]

    return rows.map((row) => ({
      id: row.id,
      source: row.source,
      kind: row.item_kind,
      title: row.title,
      summary: row.summary,
      url: row.url,
      publishedAt: row.published_at,
      score: row.score,
      triageState: row.triage_state,
      reasons: parseStringList(row.reasons_json)
    }))
  }

  getSourceContentSnapshot(source: DiscoverySource, now = new Date()): SourceContentSnapshot {
    if (!isDiscoverySource(source)) throw new Error(`Unsupported discovery source: ${source}`)
    const windowDays = source === 'arxiv' ? (1 as const) : (30 as const)
    const windowEnd = now.toISOString()
    const start = new Date(now)
    if (source === 'arxiv') {
      const newest = this.#database
        .prepare(
          `SELECT MAX(published_at) AS published_at
           FROM discovery_item
           WHERE source = 'arxiv' AND excluded = 0 AND published_at <= ?`
        )
        .get(windowEnd) as { published_at: string | null }
      if (newest.published_at) start.setTime(Date.parse(newest.published_at))
      start.setUTCHours(0, 0, 0, 0)
    } else start.setTime(now.getTime() - windowDays * 24 * 60 * 60 * 1_000)
    const windowStart = start.toISOString()
    const arxivWindowEnd = new Date(start)
    arxivWindowEnd.setUTCDate(arxivWindowEnd.getUTCDate() + 1)
    const datePredicate =
      source === 'arxiv'
        ? 'published_at >= ? AND published_at < ?'
        : '(published_at >= ? OR updated_at >= ?)'
    const rows = this.#database
      .prepare(
        `SELECT id, source, item_kind, title, summary, url, published_at, updated_at, score,
                triage_state, reasons_json
         FROM discovery_item
         WHERE source = ? AND excluded = 0 AND ${datePredicate}
         ORDER BY CASE WHEN updated_at > published_at THEN updated_at ELSE published_at END DESC,
                  score DESC, id ASC
         LIMIT 200`
      )
      .all(
        source,
        windowStart,
        source === 'arxiv' ? arxivWindowEnd.toISOString() : windowStart
      ) as SourceContentRow[]
    const indexRow = this.#database
      .prepare('SELECT MAX(last_seen_at) AS last_indexed_at FROM discovery_item WHERE source = ?')
      .get(source) as { last_indexed_at: string | null }

    return {
      source,
      status: 'cached',
      windowDays,
      windowStart,
      windowEnd,
      lastIndexedAt: indexRow.last_indexed_at,
      returnedCount: 0,
      rejectedCount: 0,
      items: rows.map((row) => ({
        id: row.id,
        source: row.source,
        kind: row.item_kind,
        title: row.title,
        summary: row.summary,
        url: row.url,
        publishedAt: row.published_at,
        updatedAt: row.updated_at,
        score: row.score,
        triageState: row.triage_state,
        reasons: parseStringList(row.reasons_json)
      }))
    }
  }

  findSavedItemIds(itemIds: readonly string[]): string[] {
    if (itemIds.length === 0) return []
    if (itemIds.length > 100) throw new Error('Saved-item lookup is limited to 100 identifiers')
    const placeholders = itemIds.map(() => '?').join(', ')
    const rows = this.#database
      .prepare(
        `SELECT id FROM discovery_item
         WHERE triage_state = 'saved' AND id IN (${placeholders})`
      )
      .all(...itemIds) as Array<{ id: string }>
    return rows.map((row) => row.id)
  }

  getDiscoveryItem(id: string): DashboardItem | null {
    const row = this.#database
      .prepare(
        `SELECT id, source, item_kind, title, summary, url, published_at, score,
                triage_state, reasons_json
         FROM discovery_item WHERE id = ?`
      )
      .get(id) as DashboardRow | undefined

    return row
      ? {
          id: row.id,
          source: row.source,
          kind: row.item_kind,
          title: row.title,
          summary: row.summary,
          url: row.url,
          publishedAt: row.published_at,
          score: row.score,
          triageState: row.triage_state,
          reasons: parseStringList(row.reasons_json)
        }
      : null
  }

  getDiscoveryRecord(id: string): DiscoveryItem | null {
    const row = this.#database
      .prepare(
        `SELECT id, source, item_kind, external_id, title, summary, url,
                published_at, updated_at, authors_json, categories_json, topics_json,
                language, stars
         FROM discovery_item WHERE id = ?`
      )
      .get(id) as DiscoveryRecordRow | undefined
    if (!row) return null
    if (!isDiscoverySource(row.source)) {
      throw new Error('The local index contains an unsupported discovery source')
    }

    return {
      id: row.id,
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
      metrics: {}
    }
  }

  saveDiscoverSnapshot(snapshot: DiscoverSnapshot): void {
    const save = this.#database.transaction(() => {
      this.#database
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

      this.#database
        .prepare('DELETE FROM discover_source_run WHERE session_id = ?')
        .run(snapshot.id)
      const saveSource = this.#database.prepare(
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

      this.#database.prepare('DELETE FROM discover_result WHERE session_id = ?').run(snapshot.id)
      const saveResult = this.#database.prepare(
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

  getLatestDiscoverSnapshot(): DiscoverSnapshot | null {
    const session = this.#database
      .prepare(
        `SELECT id, intent, runner, status, plan_json, provenance_json, created_at
         FROM discover_session
         ORDER BY created_at DESC, id DESC
         LIMIT 1`
      )
      .get() as DiscoverSessionRow | undefined
    if (!session) return null

    const sourceRows = this.#database
      .prepare(
        `SELECT source, status, result_count, error_message
         FROM discover_source_run WHERE session_id = ?`
      )
      .all(session.id) as DiscoverSourceRunRow[]
    const sourceOutcome = (source: DiscoverySource): DiscoverSourceOutcome => {
      const row = sourceRows.find((candidate) => candidate.source === source)
      if (!row) {
        return { status: 'not_searched', resultCount: 0, error: null }
      }
      return {
        status: row.status,
        resultCount: row.result_count,
        error: row.error_message
      }
    }

    const resultRows = this.#database
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

  #getDiscoverResult(sessionId: string, itemId: string): DiscoverResultRow {
    const row = this.#database
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

  #upsertDiscoverResult(
    row: DiscoverResultRow,
    initialState: 'viewed' | 'saved',
    forceSaved: boolean,
    updatedAt: string
  ): void {
    this.#database
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

  saveDiscoverResult(
    sessionId: string,
    itemId: string,
    updatedAt = new Date().toISOString()
  ): void {
    this.#upsertDiscoverResult(this.#getDiscoverResult(sessionId, itemId), 'saved', true, updatedAt)
  }

  materializeDiscoverResultForAnalysis(
    sessionId: string,
    itemId: string,
    updatedAt = new Date().toISOString()
  ): void {
    const row = this.#getDiscoverResult(sessionId, itemId)
    if (row.item_kind !== 'paper') {
      throw new Error('Discover analysis is available only for paper results')
    }
    this.#upsertDiscoverResult(row, 'viewed', false, updatedAt)
  }

  materializeDiscoverResultForLlmWikiPromotion(
    sessionId: string,
    itemId: string,
    updatedAt = new Date().toISOString()
  ): void {
    const row = this.#getDiscoverResult(sessionId, itemId)
    if (row.source !== 'arxiv' || row.item_kind !== 'paper') {
      throw new Error('llm-wiki promotion is available only for arXiv paper results')
    }
    this.#upsertDiscoverResult(row, 'viewed', false, updatedAt)
  }

  recordSourceRun(
    source: DiscoverySource,
    status: PersistedSourceHealth,
    completedAt = new Date().toISOString(),
    errorMessage: string | null = null,
    resultCount: number | null = null
  ): void {
    if (!isDiscoverySource(source)) throw new Error(`Unsupported discovery source: ${source}`)
    if (!SOURCE_HEALTH.has(status)) {
      throw new Error(`Unsupported source health: ${status}`)
    }
    if (resultCount !== null && (!Number.isInteger(resultCount) || resultCount < 0)) {
      throw new Error('Source result count must be a non-negative integer')
    }

    const save = this.#database.transaction(() => {
      this.#database
        .prepare(
          `INSERT INTO source_run(source, status, completed_at, error_message, result_count)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(source) DO UPDATE SET
             status = excluded.status,
             completed_at = excluded.completed_at,
             error_message = excluded.error_message,
             result_count = excluded.result_count`
        )
        .run(source, status, completedAt, errorMessage, resultCount)

      if (status !== 'idle' && status !== 'refreshing') {
        this.#database
          .prepare(
            `INSERT INTO source_search_event(source, status, completed_at, result_count)
             VALUES (?, ?, ?, ?)`
          )
          .run(source, status, completedAt, resultCount ?? 0)
      }
    })
    save()
  }

  getAnalyticsSnapshot(now = new Date(), windowDays = 7): AnalyticsSnapshot {
    return buildAnalyticsSnapshot(this.#database, now, windowDays)
  }

  saveModelProvider(
    profile: Omit<ModelProviderSummary, 'hasCredential'>,
    secretCiphertext: Buffer | undefined
  ): StoredModelProvider {
    return saveModelProvider(this.#database, profile, secretCiphertext)
  }

  getModelProvider(id = 'default'): StoredModelProvider | null {
    return getModelProvider(this.#database, id)
  }

  clearModelProviderCredential(
    id = 'default',
    updatedAt = new Date().toISOString()
  ): StoredModelProvider {
    return clearModelProviderCredential(this.#database, id, updatedAt)
  }

  saveAnalysis(
    artifact: AnalysisArtifact,
    usage: { readonly inputTokens: number | null; readonly outputTokens: number | null }
  ): void {
    saveAnalysis(this.#database, artifact, usage)
  }

  saveLlmWikiPromotionReceipt(receipt: LlmWikiPromotionReceipt): void {
    saveLlmWikiPromotionReceipt(this.#database, receipt)
  }

  getLatestLlmWikiPromotionReceipt(itemId: string): LlmWikiPromotionReceipt | null {
    return getLatestLlmWikiPromotionReceipt(this.#database, itemId)
  }

  reconcileInterruptedLlmWikiPromotions(completedAt = new Date().toISOString()): number {
    return reconcileInterruptedLlmWikiPromotions(this.#database, completedAt)
  }

  getLatestAnalysis(itemId: string): AnalysisArtifact | null {
    return getLatestAnalysis(this.#database, itemId)
  }

  getDashboardSnapshot(now = new Date()): DashboardSnapshot {
    const profile = this.getInterestProfile()
    const items = this.listDashboardItems()
    const savedItems = this.listSavedItems()
    const sourceRuns = this.#database
      .prepare('SELECT source, status, completed_at, error_message, result_count FROM source_run')
      .all() as SourceRunRow[]
    const healthFor = (source: DiscoverySource): SourceHealth => {
      const run = sourceRuns.find((candidate) => candidate.source === source)
      if (!run) return 'idle'
      return run.status === 'healthy' && run.result_count === 0 ? 'no_results' : run.status
    }
    const sourceHealth = Object.fromEntries(
      ACTIVE_TODAY_SOURCE_IDS.map((source) => [source, healthFor(source)])
    ) as DashboardSnapshot['sourceHealth']
    const sourceHealthDetails = Object.fromEntries(
      ACTIVE_TODAY_SOURCE_IDS.map((source) => {
        const run = sourceRuns.find((candidate) => candidate.source === source)
        return [
          source,
          {
            status: healthFor(source),
            observedAt: run?.completed_at ?? null,
            errorMessage: run?.error_message ? boundedSourceError(run.error_message) : null
          }
        ]
      })
    ) as DashboardSnapshot['sourceHealthDetails']
    const configuredSources = new Set<DiscoverySource>(
      ACTIVE_TODAY_SOURCE_IDS.filter((source) => source !== 'arxiv' && source !== 'github')
    )
    if (profile && profile.arxiv.categories.length + profile.arxiv.keywords.length > 0) {
      configuredSources.add('arxiv')
    }
    if (
      profile &&
      profile.github.keywords.length +
        profile.github.topics.length +
        profile.github.languages.length >
        0
    ) {
      configuredSources.add('github')
    }
    const completedRuns = [...configuredSources].map((source) =>
      sourceRuns.find((run) => run.source === source)
    )
    const refreshTimes = completedRuns.every(
      (run) => run && run.status !== 'idle' && run.status !== 'refreshing'
    )
      ? completedRuns.map((run) => run!.completed_at).sort()
      : []
    const bySource = Object.fromEntries(
      ACTIVE_TODAY_SOURCE_IDS.map((source) => [
        source,
        items.filter((item) => item.source === source).length
      ])
    ) as NonNullable<DashboardSnapshot['counts']['bySource']>

    return {
      date: localDateKey(now),
      profileName: profile?.name ?? null,
      lastRefreshAt: refreshTimes.at(-1) ?? null,
      sourceHealth,
      sourceHealthDetails,
      counts: {
        total: items.length,
        arxiv: items.filter((item) => item.source === 'arxiv').length,
        github: items.filter((item) => item.source === 'github').length,
        other: items.filter((item) => item.source !== 'arxiv' && item.source !== 'github').length,
        bySource,
        unread: items.filter((item) => item.triageState === 'new').length
      },
      items,
      savedItems
    }
  }

  close(): void {
    this.#database.close()
  }
}

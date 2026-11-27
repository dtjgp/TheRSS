import type Database from 'better-sqlite3'
import { interestProfileSchema, type InterestProfile } from '../interests/interestProfile'
import type {
  DiscoveryItem,
  DiscoveryItemKind,
  DiscoverySource,
  RankedDiscoveryItem
} from '../../shared/discovery'
import type { DiscoverSnapshot } from '../../shared/discover'
import type { AnalyticsSnapshot } from '../../shared/analytics'
import type {
  DashboardItem,
  DashboardSnapshot,
  SourceContentSnapshot,
  SourceHealth,
  TriageState
} from '../../shared/api'
import type { AnalysisArtifact, ModelProviderSummary } from '../../shared/models'
import {
  discoverPersonalizationPromptSchema,
  type DiscoverPersonalizationSettings
} from '../../shared/personalization'
import { localDateKey } from '../../shared/date'
import { publicationIntervalEnd } from '../../shared/sourceDate'
import { readSourceHealthDetails, type SourceRunRow } from './sourceHealthStore'
import { buildAnalyticsSnapshot } from './analyticsRepository'
import { migrateResearchDatabase } from './researchSchema'
import { readLlmWikiVaultPath, saveLlmWikiVaultPath } from './llmWikiSettingsStore'
import * as modelProviders from './modelProviderStore'
import type { StoredModelProvider } from './modelProviderStore'
import * as analysisArtifacts from './analysisArtifactStore'
import { parseStringList } from './rowParsers'
import { searchLocal as searchPersistedLocal } from './localSearchStore'
import type { LocalSearchResponse, LocalSearchScope } from '../../shared/localSearch'
import type { DiscoverSourcePreference } from '../../shared/discoverSourcePreference'
import * as discoverSourcePreferences from './discoverSourcePreferenceStore'
import {
  savedSourceUpdateRequestSchema,
  type SavedSourceUpdateRequest
} from '../../shared/savedSourceUpdate'
import { getSavedSourceUpdate, applySavedSourceUpdate } from './savedSourceUpdateStore'
import * as discoverSnapshots from './discoverSnapshotStore'
import { ACTIVE_TODAY_SOURCE_IDS, isDiscoverySource } from '../../shared/sourceIdentity'
import type { LlmWikiPromotionReceipt } from '../../shared/llmWikiPromotion'

export type { StoredModelProvider }

const TRIAGE_STATES = new Set<TriageState>(['new', 'viewed', 'saved', 'dismissed'])
type PersistedSourceHealth = Exclude<SourceHealth, 'no_results'>
const SOURCE_HEALTH = new Set<PersistedSourceHealth>([
  'idle',
  'refreshing',
  'healthy',
  'partial',
  'failed'
])

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

type SourceContentRow = DashboardRow & { updated_at: string }

type DiscoveryRecordRow = Omit<SourceContentRow, 'score' | 'triage_state' | 'reasons_json'> & {
  external_id: string
  authors_json: string
  categories_json: string
  topics_json: string
  language: string | null
  stars: number | null
}

const DASHBOARD_COLUMNS =
  'id, source, item_kind, title, summary, url, published_at, score, triage_state, reasons_json'

function dashboardItem(row: DashboardRow): DashboardItem {
  return {
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
      .prepare('SELECT prompt, updated_at FROM discover_personalization WHERE singleton_id = 1')
      .get() as { prompt: string; updated_at: string } | undefined

    if (!row) return null
    return {
      prompt: discoverPersonalizationPromptSchema.parse(row.prompt),
      updatedAt: row.updated_at
    }
  }

  getLlmWikiVaultPath(): string | null {
    return readLlmWikiVaultPath(this.#database)
  }

  saveLlmWikiVaultPath(vaultPath: string | null): string | null {
    return saveLlmWikiVaultPath(this.#database, vaultPath)
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
        `SELECT ${DASHBOARD_COLUMNS}
         FROM discovery_item
         WHERE in_daily_inbox = 1
           AND source IN (${sourcePlaceholders})
           AND excluded = 0
           AND triage_state != 'dismissed'
         ORDER BY score DESC, published_at DESC, id ASC
         LIMIT ?`
      )
      .all(...ACTIVE_TODAY_SOURCE_IDS, limit) as DashboardRow[]

    return rows.map(dashboardItem)
  }

  listSavedItems(limit = 100): DashboardItem[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new Error('Saved-items limit must be between 1 and 500')
    }

    const rows = this.#database
      .prepare(
        `SELECT ${DASHBOARD_COLUMNS}
         FROM discovery_item
         WHERE excluded = 0 AND triage_state = 'saved'
         ORDER BY triage_updated_at DESC, score DESC, id ASC
         LIMIT ?`
      )
      .all(limit) as DashboardRow[]

    return rows.map(dashboardItem)
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
    const candidateStart =
      source === 'folo:611'
        ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)).toISOString()
        : windowStart
    const arxivWindowEnd = new Date(start)
    arxivWindowEnd.setUTCDate(arxivWindowEnd.getUTCDate() + 1)
    const datePredicate =
      source === 'arxiv'
        ? 'published_at >= ? AND published_at < ?'
        : '(published_at >= ? OR updated_at >= ?)'
    const rows = this.#database
      .prepare(
        `SELECT ${DASHBOARD_COLUMNS}, updated_at
         FROM discovery_item
         WHERE source = ? AND excluded = 0 AND ${datePredicate}
         ORDER BY CASE WHEN updated_at > published_at THEN updated_at ELSE published_at END DESC,
                  score DESC, id ASC
         LIMIT 200`
      )
      .all(
        source,
        candidateStart,
        source === 'arxiv' ? arxivWindowEnd.toISOString() : candidateStart
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
      items: rows
        .filter(
          (row) =>
            source !== 'folo:611' ||
            Date.parse(row.updated_at) >= start.getTime() ||
            publicationIntervalEnd({
              source: row.source,
              summary: row.summary,
              publishedAt: row.published_at
            }) >= start.getTime()
        )
        .map((row) => ({ ...dashboardItem(row), updatedAt: row.updated_at }))
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
      .prepare(`SELECT ${DASHBOARD_COLUMNS} FROM discovery_item WHERE id = ?`)
      .get(id) as DashboardRow | undefined

    return row ? dashboardItem(row) : null
  }

  getSavedSourceUpdate(id: string) {
    return getSavedSourceUpdate(this.#database, id)
  }

  applySavedSourceUpdate(request: SavedSourceUpdateRequest, updatedAt = new Date().toISOString()) {
    return applySavedSourceUpdate(
      this.#database,
      savedSourceUpdateRequestSchema.parse(request),
      updatedAt
    )
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
    discoverSnapshots.saveDiscoverSnapshot(this.#database, snapshot)
  }

  getLatestDiscoverSnapshot(): DiscoverSnapshot | null {
    return discoverSnapshots.getLatestDiscoverSnapshot(this.#database)
  }
  getDiscoverSnapshot(id: string): DiscoverSnapshot | null {
    return discoverSnapshots.getDiscoverSnapshot(this.#database, id)
  }

  getDiscoverSourcePreference(): DiscoverSourcePreference {
    return discoverSourcePreferences.readDiscoverSourcePreference(this.#database)
  }

  /** Validates 1–22 unique current sources; an invalid request writes nothing. */
  saveDiscoverSourcePreference(sources: unknown, updatedAt?: string): DiscoverSourcePreference {
    return discoverSourcePreferences.saveDiscoverSourcePreference(
      this.#database,
      sources,
      updatedAt
    )
  }

  searchLocal(query: string, scope?: LocalSearchScope): LocalSearchResponse {
    return searchPersistedLocal(this.#database, query, scope)
  }

  saveDiscoverResult(
    sessionId: string,
    itemId: string,
    updatedAt = new Date().toISOString()
  ): void {
    discoverSnapshots.saveDiscoverResult(this.#database, sessionId, itemId, updatedAt)
  }

  materializeDiscoverResultForAnalysis(
    sessionId: string,
    itemId: string,
    updatedAt = new Date().toISOString()
  ): void {
    discoverSnapshots.materializeDiscoverResultForAnalysis(
      this.#database,
      sessionId,
      itemId,
      updatedAt
    )
  }

  materializeDiscoverResultForLlmWikiPromotion(
    sessionId: string,
    itemId: string,
    updatedAt = new Date().toISOString()
  ): void {
    discoverSnapshots.materializeDiscoverResultForLlmWikiPromotion(
      this.#database,
      sessionId,
      itemId,
      updatedAt
    )
  }

  materializeDiscoverResultForLlmWikiInboxCapture(
    sessionId: string,
    itemId: string,
    updatedAt = new Date().toISOString()
  ): void {
    discoverSnapshots.materializeDiscoverResultForLlmWikiInboxCapture(
      this.#database,
      sessionId,
      itemId,
      updatedAt
    )
  }

  recordSourceRun(
    source: DiscoverySource,
    status: PersistedSourceHealth,
    completedAt = new Date().toISOString(),
    errorMessage: string | null = null,
    resultCount: number | null = null,
    recordSearchEvent = true
  ): void {
    if (!isDiscoverySource(source)) throw new Error(`Unsupported discovery source: ${source}`)
    if (!SOURCE_HEALTH.has(status)) throw new Error(`Unsupported source health: ${status}`)
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

      if (recordSearchEvent && status !== 'idle' && status !== 'refreshing') {
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
    return modelProviders.saveModelProvider(this.#database, profile, secretCiphertext)
  }

  getModelProvider(id?: string): StoredModelProvider | null {
    return modelProviders.getModelProvider(this.#database, id)
  }

  clearModelProviderCredential(id?: string, updatedAt?: string): StoredModelProvider {
    return modelProviders.clearModelProviderCredential(this.#database, id, updatedAt)
  }

  replaceModelProviderCredential(id: string, expected: Buffer, replacement: Buffer): boolean {
    return modelProviders.replaceModelProviderCredential(this.#database, id, expected, replacement)
  }

  saveAnalysis(
    artifact: AnalysisArtifact,
    usage: { readonly inputTokens: number | null; readonly outputTokens: number | null }
  ): void {
    analysisArtifacts.saveAnalysis(this.#database, artifact, usage)
  }

  saveLlmWikiPromotionReceipt(receipt: LlmWikiPromotionReceipt): void {
    analysisArtifacts.saveLlmWikiPromotionReceipt(this.#database, receipt)
  }

  getLatestLlmWikiPromotionReceipt(itemId: string): LlmWikiPromotionReceipt | null {
    return analysisArtifacts.getLatestLlmWikiPromotionReceipt(this.#database, itemId)
  }

  reconcileInterruptedLlmWikiPromotions(completedAt?: string): number {
    return analysisArtifacts.reconcileInterruptedLlmWikiPromotions(this.#database, completedAt)
  }

  getLatestAnalysis(itemId: string): AnalysisArtifact | null {
    return analysisArtifacts.getLatestAnalysis(this.#database, itemId)
  }

  getAnalysisArtifact(analysisId: string): AnalysisArtifact | null {
    return analysisArtifacts.getAnalysisArtifact(this.#database, analysisId)
  }

  getDashboardSnapshot(now = new Date()): DashboardSnapshot {
    const profile = this.getInterestProfile()
    const items = this.listDashboardItems()
    const savedItems = this.listSavedItems()
    const sourceRuns = this.#database
      .prepare('SELECT source, status, completed_at, error_message, result_count FROM source_run')
      .all() as SourceRunRow[]
    const sourceHealthDetails = readSourceHealthDetails(this.#database, sourceRuns)
    const sourceHealth = Object.fromEntries(
      ACTIVE_TODAY_SOURCE_IDS.map((source) => [source, sourceHealthDetails[source]!.status])
    ) as DashboardSnapshot['sourceHealth']
    const configuredSources = new Set<DiscoverySource>(
      ACTIVE_TODAY_SOURCE_IDS.filter((source) => source !== 'arxiv' && source !== 'github')
    )
    const arxiv = profile?.arxiv
    const github = profile?.github
    if (arxiv && (arxiv.categories.length || arxiv.keywords.length)) configuredSources.add('arxiv')
    if (github && (github.keywords.length || github.topics.length || github.languages.length)) {
      configuredSources.add('github')
    }
    const refreshTimes = [...configuredSources].map((source) => {
      const run = sourceRuns.find((entry) => entry.source === source)
      return run && run.status !== 'idle' && run.status !== 'refreshing' ? run.completed_at : null
    })
    const lastRefreshAt = refreshTimes.includes(null) ? null : (refreshTimes.sort().at(-1) ?? null)
    const countBySource = (source: DiscoverySource) =>
      items.filter((item) => item.source === source).length
    const bySource = Object.fromEntries(
      ACTIVE_TODAY_SOURCE_IDS.map((source) => [source, countBySource(source)])
    ) as NonNullable<DashboardSnapshot['counts']['bySource']>

    return {
      date: localDateKey(now),
      profileName: profile?.name ?? null,
      lastRefreshAt,
      sourceHealth,
      sourceHealthDetails,
      counts: {
        total: items.length,
        arxiv: countBySource('arxiv'),
        github: countBySource('github'),
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

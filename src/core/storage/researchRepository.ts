import type Database from 'better-sqlite3'
import { interestProfileSchema, type InterestProfile } from '../interests/interestProfile'
import type {
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
import type { ModelProtocol, ModelProviderSummary } from '../../shared/models'
import type { AnalysisArtifact } from '../../shared/models'
import {
  DISCOVER_PERSONALIZATION_PROMPT_MAX_LENGTH,
  discoverPersonalizationPromptSchema,
  type DiscoverPersonalizationSettings
} from '../../shared/personalization'
import { localDateKey } from '../../shared/date'
import { parseDiscoverPlan } from '../discover/discoverPlan'
import { buildAnalyticsSnapshot } from './analyticsRepository'
import { ACTIVE_TODAY_SOURCE_IDS, isDiscoverySource } from '../../shared/sourceIdentity'

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

interface SourceContentRow extends DashboardRow {
  updated_at: string
}

interface SourceRunRow {
  source: DiscoverySource
  status: PersistedSourceHealth
  completed_at: string
  result_count: number | null
}

export interface StoredModelProvider {
  readonly id: string
  readonly name: string
  readonly protocol: ModelProtocol
  readonly baseUrl: string
  readonly model: string
  readonly secretCiphertext: Buffer | null
  readonly updatedAt: string
}

interface ModelProviderRow {
  id: string
  name: string
  protocol: ModelProtocol
  base_url: string
  model: string
  secret_ciphertext: Buffer | null
  updated_at: string
}

interface AnalysisArtifactRow {
  id: string
  item_id: string
  provider_id: string
  provider_name: string
  model: string
  prompt_version: string
  source_hash: string
  content: string
  created_at: string
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

function parseStringList(value: string): string[] {
  const parsed: unknown = JSON.parse(value)
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error('The local index contains an invalid string list')
  }
  return [...parsed]
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
    if (options.migrate !== false) this.#migrate()
  }

  #migrate(): void {
    this.#database.pragma('journal_mode = WAL')
    this.#database.pragma('foreign_keys = OFF')
    const migrate = this.#database.transaction(() => {
      this.#database.exec(`
      CREATE TABLE IF NOT EXISTS interest_profile (
        singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
        profile_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS discover_personalization (
        singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
        prompt TEXT NOT NULL CHECK (
          length(prompt) <= ${DISCOVER_PERSONALIZATION_PROMPT_MAX_LENGTH}
        ),
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS discovery_item (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        item_kind TEXT NOT NULL
          CHECK (item_kind IN ('paper', 'repository', 'article', 'model', 'dataset', 'post')),
        external_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        url TEXT NOT NULL,
        published_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        authors_json TEXT NOT NULL,
        categories_json TEXT NOT NULL,
        topics_json TEXT NOT NULL,
        language TEXT,
        stars INTEGER,
        score REAL NOT NULL,
        excluded INTEGER NOT NULL CHECK (excluded IN (0, 1)),
        reasons_json TEXT NOT NULL,
        in_daily_inbox INTEGER NOT NULL DEFAULT 1 CHECK (in_daily_inbox IN (0, 1)),
        triage_state TEXT NOT NULL DEFAULT 'new'
          CHECK (triage_state IN ('new', 'viewed', 'saved', 'dismissed')),
        triage_updated_at TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS discovery_item_inbox
        ON discovery_item(excluded, triage_state, score DESC, published_at DESC);

      CREATE TABLE IF NOT EXISTS source_run (
        source TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('idle', 'refreshing', 'healthy', 'partial', 'failed')),
        completed_at TEXT NOT NULL,
        error_message TEXT,
        result_count INTEGER
      );

      CREATE TABLE IF NOT EXISTS source_search_event (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('healthy', 'partial', 'failed')),
        completed_at TEXT NOT NULL,
        result_count INTEGER NOT NULL CHECK (result_count >= 0)
      );

      CREATE INDEX IF NOT EXISTS source_search_event_by_time
        ON source_search_event(completed_at DESC, id DESC);

      CREATE TABLE IF NOT EXISTS model_provider (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        protocol TEXT NOT NULL
          CHECK (protocol IN ('openai-compatible', 'anthropic-compatible')),
        base_url TEXT NOT NULL,
        model TEXT NOT NULL,
        secret_ciphertext BLOB,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS analysis_artifact (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES discovery_item(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL,
        provider_name TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_version TEXT NOT NULL,
        source_hash TEXT NOT NULL,
        content TEXT NOT NULL,
        input_tokens INTEGER,
        output_tokens INTEGER,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS analysis_artifact_by_item
        ON analysis_artifact(item_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS discover_session (
        id TEXT PRIMARY KEY,
        intent TEXT NOT NULL,
        runner TEXT NOT NULL CHECK (runner IN ('model-provider', 'codex', 'claude')),
        status TEXT NOT NULL CHECK (status IN ('completed', 'partial', 'no_results', 'failed')),
        plan_json TEXT NOT NULL,
        provenance_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS discover_source_run (
        session_id TEXT NOT NULL REFERENCES discover_session(id) ON DELETE CASCADE,
        source TEXT NOT NULL,
        status TEXT NOT NULL
          CHECK (status IN ('not_searched', 'healthy', 'partial', 'no_results', 'failed')),
        result_count INTEGER NOT NULL CHECK (result_count >= 0),
        error_message TEXT,
        PRIMARY KEY(session_id, source)
      );

      CREATE TABLE IF NOT EXISTS discover_result (
        session_id TEXT NOT NULL REFERENCES discover_session(id) ON DELETE CASCADE,
        item_id TEXT NOT NULL,
        source TEXT NOT NULL,
        item_kind TEXT NOT NULL
          CHECK (item_kind IN ('paper', 'repository', 'article', 'model', 'dataset', 'post')),
        external_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        url TEXT NOT NULL,
        published_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        authors_json TEXT NOT NULL,
        categories_json TEXT NOT NULL,
        topics_json TEXT NOT NULL,
        language TEXT,
        stars INTEGER,
        score REAL NOT NULL,
        reasons_json TEXT NOT NULL,
        result_rank INTEGER NOT NULL CHECK (result_rank >= 0),
        PRIMARY KEY(session_id, item_id)
      );

      CREATE INDEX IF NOT EXISTS discover_session_latest
        ON discover_session(created_at DESC, id DESC);
    `)

      const analysisColumns = new Set(
        (this.#database.pragma('table_info(analysis_artifact)') as Array<{ name: string }>).map(
          (column) => column.name
        )
      )
      if (!analysisColumns.has('source_hash')) {
        this.#database.exec(
          "ALTER TABLE analysis_artifact ADD COLUMN source_hash TEXT NOT NULL DEFAULT 'legacy-unavailable'"
        )
      }

      const sourceRunColumns = new Set(
        (this.#database.pragma('table_info(source_run)') as Array<{ name: string }>).map(
          (column) => column.name
        )
      )
      if (!sourceRunColumns.has('result_count')) {
        this.#database.exec('ALTER TABLE source_run ADD COLUMN result_count INTEGER')
      }

      const discoveryColumns = new Set(
        (this.#database.pragma('table_info(discovery_item)') as Array<{ name: string }>).map(
          (column) => column.name
        )
      )
      if (!discoveryColumns.has('triage_updated_at')) {
        this.#database.exec('ALTER TABLE discovery_item ADD COLUMN triage_updated_at TEXT')
        this.#database.exec(
          'UPDATE discovery_item SET triage_updated_at = last_seen_at WHERE triage_updated_at IS NULL'
        )
      }
      if (!discoveryColumns.has('in_daily_inbox')) {
        this.#database.exec(
          'ALTER TABLE discovery_item ADD COLUMN in_daily_inbox INTEGER NOT NULL DEFAULT 1'
        )
      }

      const discoveryDefinition = this.#database
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'discovery_item'")
        .get() as { sql: string }
      if (
        !discoveryColumns.has('item_kind') ||
        discoveryDefinition.sql.includes("source IN ('arxiv', 'github')")
      ) {
        const itemKindExpression = discoveryColumns.has('item_kind')
          ? 'item_kind'
          : "CASE source WHEN 'arxiv' THEN 'paper' WHEN 'github' THEN 'repository' ELSE 'article' END"
        this.#database.exec(`
          CREATE TABLE discovery_item_generic (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            item_kind TEXT NOT NULL
              CHECK (item_kind IN ('paper', 'repository', 'article', 'model', 'dataset', 'post')),
            external_id TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT NOT NULL,
            url TEXT NOT NULL,
            published_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            authors_json TEXT NOT NULL,
            categories_json TEXT NOT NULL,
            topics_json TEXT NOT NULL,
            language TEXT,
            stars INTEGER,
            score REAL NOT NULL,
            excluded INTEGER NOT NULL CHECK (excluded IN (0, 1)),
            reasons_json TEXT NOT NULL,
            in_daily_inbox INTEGER NOT NULL DEFAULT 1 CHECK (in_daily_inbox IN (0, 1)),
            triage_state TEXT NOT NULL DEFAULT 'new'
              CHECK (triage_state IN ('new', 'viewed', 'saved', 'dismissed')),
            triage_updated_at TEXT NOT NULL,
            first_seen_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL
          );
          INSERT INTO discovery_item_generic(
            id, source, item_kind, external_id, title, summary, url, published_at, updated_at,
            authors_json, categories_json, topics_json, language, stars, score, excluded,
            reasons_json, in_daily_inbox, triage_state, triage_updated_at, first_seen_at, last_seen_at
          )
          SELECT id, source, ${itemKindExpression}, external_id, title, summary, url,
                 published_at, updated_at, authors_json, categories_json, topics_json,
                 language, stars, score, excluded, reasons_json, in_daily_inbox,
                 triage_state, triage_updated_at, first_seen_at, last_seen_at
          FROM discovery_item;
          DROP TABLE discovery_item;
          ALTER TABLE discovery_item_generic RENAME TO discovery_item;
          CREATE INDEX discovery_item_inbox
            ON discovery_item(excluded, triage_state, score DESC, published_at DESC);
        `)
      }

      for (const table of ['source_run', 'source_search_event'] as const) {
        const definition = this.#database
          .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
          .get(table) as { sql: string }
        if (!definition.sql.includes("source IN ('arxiv', 'github')")) continue
        if (table === 'source_run') {
          this.#database.exec(`
            CREATE TABLE source_run_generic (
              source TEXT PRIMARY KEY,
              status TEXT NOT NULL CHECK (status IN ('idle', 'refreshing', 'healthy', 'partial', 'failed')),
              completed_at TEXT NOT NULL,
              error_message TEXT,
              result_count INTEGER
            );
            INSERT INTO source_run_generic SELECT * FROM source_run;
            DROP TABLE source_run;
            ALTER TABLE source_run_generic RENAME TO source_run;
          `)
        } else {
          this.#database.exec(`
            CREATE TABLE source_search_event_generic (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              source TEXT NOT NULL,
              status TEXT NOT NULL CHECK (status IN ('healthy', 'partial', 'failed')),
              completed_at TEXT NOT NULL,
              result_count INTEGER NOT NULL CHECK (result_count >= 0)
            );
            INSERT INTO source_search_event_generic SELECT * FROM source_search_event;
            DROP TABLE source_search_event;
            ALTER TABLE source_search_event_generic RENAME TO source_search_event;
            CREATE INDEX source_search_event_by_time
              ON source_search_event(completed_at DESC, id DESC);
          `)
        }
      }

      const discoverSourceRunDefinition = this.#database
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'discover_source_run'"
        )
        .get() as { sql: string }
      if (
        discoverSourceRunDefinition.sql.includes("source IN ('arxiv', 'github')") ||
        !discoverSourceRunDefinition.sql.includes("'partial'")
      ) {
        this.#database.exec(`
          CREATE TABLE discover_source_run_generic (
            session_id TEXT NOT NULL REFERENCES discover_session(id) ON DELETE CASCADE,
            source TEXT NOT NULL,
            status TEXT NOT NULL
              CHECK (status IN ('not_searched', 'healthy', 'partial', 'no_results', 'failed')),
            result_count INTEGER NOT NULL CHECK (result_count >= 0),
            error_message TEXT,
            PRIMARY KEY(session_id, source)
          );
          INSERT INTO discover_source_run_generic(
            session_id, source, status, result_count, error_message
          )
          SELECT session_id, source, status, result_count, error_message
          FROM discover_source_run;
          DROP TABLE discover_source_run;
          ALTER TABLE discover_source_run_generic RENAME TO discover_source_run;
        `)
      }

      const discoverResultColumns = new Set(
        (this.#database.pragma('table_info(discover_result)') as Array<{ name: string }>).map(
          (column) => column.name
        )
      )
      const discoverResultDefinition = this.#database
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'discover_result'")
        .get() as { sql: string }
      if (
        !discoverResultColumns.has('item_kind') ||
        discoverResultDefinition.sql.includes("source IN ('arxiv', 'github')")
      ) {
        const itemKindExpression = discoverResultColumns.has('item_kind')
          ? 'item_kind'
          : "CASE source WHEN 'arxiv' THEN 'paper' WHEN 'github' THEN 'repository' ELSE 'article' END"
        this.#database.exec(`
          CREATE TABLE discover_result_generic (
            session_id TEXT NOT NULL REFERENCES discover_session(id) ON DELETE CASCADE,
            item_id TEXT NOT NULL,
            source TEXT NOT NULL,
            item_kind TEXT NOT NULL
              CHECK (item_kind IN ('paper', 'repository', 'article', 'model', 'dataset', 'post')),
            external_id TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT NOT NULL,
            url TEXT NOT NULL,
            published_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            authors_json TEXT NOT NULL,
            categories_json TEXT NOT NULL,
            topics_json TEXT NOT NULL,
            language TEXT,
            stars INTEGER,
            score REAL NOT NULL,
            reasons_json TEXT NOT NULL,
            result_rank INTEGER NOT NULL CHECK (result_rank >= 0),
            PRIMARY KEY(session_id, item_id)
          );
          INSERT INTO discover_result_generic(
            session_id, item_id, source, item_kind, external_id, title, summary, url,
            published_at, updated_at, authors_json, categories_json, topics_json,
            language, stars, score, reasons_json, result_rank
          )
          SELECT session_id, item_id, source, ${itemKindExpression}, external_id, title,
                 summary, url, published_at, updated_at, authors_json, categories_json,
                 topics_json, language, stars, score, reasons_json, result_rank
          FROM discover_result;
          DROP TABLE discover_result;
          ALTER TABLE discover_result_generic RENAME TO discover_result;
        `)
      }

      // Account synchronization was withdrawn. Remove any local encrypted credential and
      // bookkeeping tables while keeping the user's local research data intact.
      this.#database.exec(`
        DROP TABLE IF EXISTS google_sync_conflict;
        DROP TABLE IF EXISTS google_sync_account;
        DROP TABLE IF EXISTS sync_local_state;
      `)
    })
    try {
      migrate()
    } finally {
      this.#database.pragma('foreign_keys = ON')
    }
    const foreignKeyViolations = this.#database.pragma('foreign_key_check') as unknown[]
    if (foreignKeyViolations.length > 0) {
      throw new Error('The local index migration introduced a foreign-key violation')
    }
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
    this.#database
      .prepare(
        `INSERT INTO model_provider(
           id, name, protocol, base_url, model, secret_ciphertext, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           protocol = excluded.protocol,
           base_url = excluded.base_url,
           model = excluded.model,
           secret_ciphertext = COALESCE(
             excluded.secret_ciphertext,
             model_provider.secret_ciphertext
           ),
           updated_at = excluded.updated_at`
      )
      .run(
        profile.id,
        profile.name,
        profile.protocol,
        profile.baseUrl,
        profile.model,
        secretCiphertext ?? null,
        profile.updatedAt
      )

    return this.getModelProvider(profile.id)!
  }

  getModelProvider(id = 'default'): StoredModelProvider | null {
    const row = this.#database
      .prepare(
        `SELECT id, name, protocol, base_url, model, secret_ciphertext, updated_at
         FROM model_provider WHERE id = ?`
      )
      .get(id) as ModelProviderRow | undefined

    return row
      ? {
          id: row.id,
          name: row.name,
          protocol: row.protocol,
          baseUrl: row.base_url,
          model: row.model,
          secretCiphertext: row.secret_ciphertext,
          updatedAt: row.updated_at
        }
      : null
  }

  saveAnalysis(
    artifact: AnalysisArtifact,
    usage: { readonly inputTokens: number | null; readonly outputTokens: number | null }
  ): void {
    this.#database
      .prepare(
        `INSERT INTO analysis_artifact(
           id, item_id, provider_id, provider_name, model, prompt_version,
           source_hash, content, input_tokens, output_tokens, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        artifact.id,
        artifact.itemId,
        artifact.providerId,
        artifact.providerName,
        artifact.model,
        artifact.promptVersion,
        artifact.sourceHash,
        artifact.content,
        usage.inputTokens,
        usage.outputTokens,
        artifact.createdAt
      )
  }

  getLatestAnalysis(itemId: string): AnalysisArtifact | null {
    const row = this.#database
      .prepare(
        `SELECT id, item_id, provider_id, provider_name, model, prompt_version,
                source_hash, content, created_at
         FROM analysis_artifact
         WHERE item_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 1`
      )
      .get(itemId) as AnalysisArtifactRow | undefined

    return row
      ? {
          id: row.id,
          itemId: row.item_id,
          providerId: row.provider_id,
          providerName: row.provider_name,
          model: row.model,
          promptVersion: row.prompt_version,
          sourceHash: row.source_hash,
          content: row.content,
          createdAt: row.created_at
        }
      : null
  }

  getDashboardSnapshot(now = new Date()): DashboardSnapshot {
    const profile = this.getInterestProfile()
    const items = this.listDashboardItems()
    const savedItems = this.listSavedItems()
    const sourceRuns = this.#database
      .prepare('SELECT source, status, completed_at, result_count FROM source_run')
      .all() as SourceRunRow[]
    const healthFor = (source: DiscoverySource): SourceHealth => {
      const run = sourceRuns.find((candidate) => candidate.source === source)
      if (!run) return 'idle'
      return run.status === 'healthy' && run.result_count === 0 ? 'no_results' : run.status
    }
    const sourceHealth = Object.fromEntries(
      ACTIVE_TODAY_SOURCE_IDS.map((source) => [source, healthFor(source)])
    ) as DashboardSnapshot['sourceHealth']
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

import type Database from 'better-sqlite3'
import { interestProfileSchema, type InterestProfile } from '../interests/interestProfile'
import type { RankedDiscoveryItem } from '../../shared/discovery'
import type { DashboardItem, DashboardSnapshot, SourceHealth, TriageState } from '../../shared/api'
import type { ModelProtocol, ModelProviderSummary } from '../../shared/models'
import type { AnalysisArtifact } from '../../shared/models'
import { localDateKey } from '../../shared/date'

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
  source: 'arxiv' | 'github'
  title: string
  summary: string
  url: string
  published_at: string
  score: number
  triage_state: TriageState
  reasons_json: string
}

interface SourceRunRow {
  source: 'arxiv' | 'github'
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

function parseStringList(value: string): string[] {
  const parsed: unknown = JSON.parse(value)
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error('The local index contains an invalid string list')
  }
  return [...parsed]
}

export class ResearchRepository {
  readonly #database: Database.Database

  constructor(database: Database.Database, options: { readonly migrate?: boolean } = {}) {
    this.#database = database
    if (options.migrate !== false) this.#migrate()
  }

  #migrate(): void {
    this.#database.pragma('foreign_keys = ON')
    this.#database.pragma('journal_mode = WAL')
    const migrate = this.#database.transaction(() => {
      this.#database.exec(`
      CREATE TABLE IF NOT EXISTS interest_profile (
        singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
        profile_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS discovery_item (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL CHECK (source IN ('arxiv', 'github')),
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
        triage_state TEXT NOT NULL DEFAULT 'new'
          CHECK (triage_state IN ('new', 'viewed', 'saved', 'dismissed')),
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS discovery_item_inbox
        ON discovery_item(excluded, triage_state, score DESC, published_at DESC);

      CREATE TABLE IF NOT EXISTS source_run (
        source TEXT PRIMARY KEY CHECK (source IN ('arxiv', 'github')),
        status TEXT NOT NULL CHECK (status IN ('idle', 'refreshing', 'healthy', 'partial', 'failed')),
        completed_at TEXT NOT NULL,
        error_message TEXT,
        result_count INTEGER
      );

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
    })
    migrate()
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

  upsertRankedItems(
    items: readonly RankedDiscoveryItem[],
    seenAt = new Date().toISOString()
  ): void {
    const statement = this.#database.prepare(`
      INSERT INTO discovery_item(
        id, source, external_id, title, summary, url, published_at, updated_at,
        authors_json, categories_json, topics_json, language, stars, score,
        excluded, reasons_json, first_seen_at, last_seen_at
      ) VALUES (
        @id, @source, @externalId, @title, @summary, @url, @publishedAt, @updatedAt,
        @authors, @categories, @topics, @language, @stars, @score,
        @excluded, @reasons, @seenAt, @seenAt
      )
      ON CONFLICT(id) DO UPDATE SET
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
          seenAt
        })
      }
    })

    writeItems(items)
  }

  setTriageState(id: string, state: TriageState): void {
    if (!TRIAGE_STATES.has(state)) {
      throw new Error(`Unsupported triage state: ${state}`)
    }

    const result = this.#database
      .prepare('UPDATE discovery_item SET triage_state = ? WHERE id = ?')
      .run(state, id)
    if (result.changes === 0) {
      throw new Error(`Unknown discovery item: ${id}`)
    }
  }

  listDashboardItems(limit = 100): DashboardItem[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new Error('Dashboard limit must be between 1 and 500')
    }

    const rows = this.#database
      .prepare(
        `SELECT id, source, title, summary, url, published_at, score,
                triage_state, reasons_json
         FROM discovery_item
         WHERE excluded = 0 AND triage_state != 'dismissed'
         ORDER BY score DESC, published_at DESC, id ASC
         LIMIT ?`
      )
      .all(limit) as DashboardRow[]

    return rows.map((row) => ({
      id: row.id,
      source: row.source,
      title: row.title,
      summary: row.summary,
      url: row.url,
      publishedAt: row.published_at,
      score: row.score,
      triageState: row.triage_state,
      reasons: parseStringList(row.reasons_json)
    }))
  }

  getDiscoveryItem(id: string): DashboardItem | null {
    const row = this.#database
      .prepare(
        `SELECT id, source, title, summary, url, published_at, score,
                triage_state, reasons_json
         FROM discovery_item WHERE id = ?`
      )
      .get(id) as DashboardRow | undefined

    return row
      ? {
          id: row.id,
          source: row.source,
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

  recordSourceRun(
    source: 'arxiv' | 'github',
    status: PersistedSourceHealth,
    completedAt = new Date().toISOString(),
    errorMessage: string | null = null,
    resultCount: number | null = null
  ): void {
    if (!SOURCE_HEALTH.has(status)) {
      throw new Error(`Unsupported source health: ${status}`)
    }
    if (resultCount !== null && (!Number.isInteger(resultCount) || resultCount < 0)) {
      throw new Error('Source result count must be a non-negative integer')
    }

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
    const sourceRuns = this.#database
      .prepare('SELECT source, status, completed_at, result_count FROM source_run')
      .all() as SourceRunRow[]
    const healthFor = (source: 'arxiv' | 'github'): SourceHealth => {
      const run = sourceRuns.find((candidate) => candidate.source === source)
      if (!run) return 'idle'
      return run.status === 'healthy' && run.result_count === 0 ? 'no_results' : run.status
    }
    const sourceHealth: DashboardSnapshot['sourceHealth'] = {
      arxiv: healthFor('arxiv'),
      github: healthFor('github')
    }
    const configuredSources = new Set<'arxiv' | 'github'>()
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
    const hasInterruptedConfiguredSource = sourceRuns.some(
      (run) => configuredSources.has(run.source) && run.status === 'refreshing'
    )
    const refreshTimes = hasInterruptedConfiguredSource
      ? []
      : sourceRuns
          .filter((run) => run.status !== 'idle' && run.status !== 'refreshing')
          .map((run) => run.completed_at)
          .sort()

    return {
      date: localDateKey(now),
      profileName: profile?.name ?? null,
      lastRefreshAt: refreshTimes.at(-1) ?? null,
      sourceHealth,
      counts: {
        total: items.length,
        arxiv: items.filter((item) => item.source === 'arxiv').length,
        github: items.filter((item) => item.source === 'github').length,
        unread: items.filter((item) => item.triageState === 'new').length
      },
      items
    }
  }

  close(): void {
    this.#database.close()
  }
}

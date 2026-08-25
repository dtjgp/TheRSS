import type Database from 'better-sqlite3'
import { DISCOVER_PERSONALIZATION_PROMPT_MAX_LENGTH } from '../../shared/personalization'

/**
 * Creates and migrates the local research schema in place.
 *
 * Extracted from ResearchRepository's constructor, where it accounted for roughly a
 * quarter of the file. It depends on nothing but the database handle, so keeping it
 * beside the query methods only obscured both.
 */
export function migrateResearchDatabase(database: Database.Database): void {
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = OFF')
  const migrate = database.transaction(() => {
    database.exec(`
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

    CREATE TABLE IF NOT EXISTS llm_wiki_promotion_receipt (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      item_id TEXT NOT NULL REFERENCES discovery_item(id) ON DELETE CASCADE,
      arxiv_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (
        status IN (
          'running', 'completed', 'partial', 'blocked',
          'no-change', 'no-source', 'skipped', 'failed'
        )
      ),
      runner TEXT NOT NULL CHECK (runner = 'codex'),
      version TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      contract_hash TEXT NOT NULL,
      evidence_tier TEXT NOT NULL CHECK (
        evidence_tier IN ('pending', 'full-text-verified', 'partial', 'no-source')
      ),
      summary TEXT NOT NULL,
      created_paths_json TEXT NOT NULL,
      updated_paths_json TEXT NOT NULL,
      pdf_path TEXT,
      sidecar_path TEXT,
      note_path TEXT,
      audit_path TEXT,
      blockers_json TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS llm_wiki_promotion_receipt_by_item
      ON llm_wiki_promotion_receipt(item_id, sequence DESC);

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
      (database.pragma('table_info(analysis_artifact)') as Array<{ name: string }>).map(
        (column) => column.name
      )
    )
    if (!analysisColumns.has('source_hash')) {
      database.exec(
        "ALTER TABLE analysis_artifact ADD COLUMN source_hash TEXT NOT NULL DEFAULT 'legacy-unavailable'"
      )
    }

    const sourceRunColumns = new Set(
      (database.pragma('table_info(source_run)') as Array<{ name: string }>).map(
        (column) => column.name
      )
    )
    if (!sourceRunColumns.has('result_count')) {
      database.exec('ALTER TABLE source_run ADD COLUMN result_count INTEGER')
    }

    const discoveryColumns = new Set(
      (database.pragma('table_info(discovery_item)') as Array<{ name: string }>).map(
        (column) => column.name
      )
    )
    if (!discoveryColumns.has('triage_updated_at')) {
      database.exec('ALTER TABLE discovery_item ADD COLUMN triage_updated_at TEXT')
      database.exec(
        'UPDATE discovery_item SET triage_updated_at = last_seen_at WHERE triage_updated_at IS NULL'
      )
    }
    if (!discoveryColumns.has('in_daily_inbox')) {
      database.exec(
        'ALTER TABLE discovery_item ADD COLUMN in_daily_inbox INTEGER NOT NULL DEFAULT 1'
      )
    }

    const discoveryDefinition = database
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'discovery_item'")
      .get() as { sql: string }
    if (
      !discoveryColumns.has('item_kind') ||
      discoveryDefinition.sql.includes("source IN ('arxiv', 'github')")
    ) {
      const itemKindExpression = discoveryColumns.has('item_kind')
        ? 'item_kind'
        : "CASE source WHEN 'arxiv' THEN 'paper' WHEN 'github' THEN 'repository' ELSE 'article' END"
      database.exec(`
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
      const definition = database
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(table) as { sql: string }
      if (!definition.sql.includes("source IN ('arxiv', 'github')")) continue
      if (table === 'source_run') {
        database.exec(`
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
        database.exec(`
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

    const discoverSourceRunDefinition = database
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'discover_source_run'"
      )
      .get() as { sql: string }
    if (
      discoverSourceRunDefinition.sql.includes("source IN ('arxiv', 'github')") ||
      !discoverSourceRunDefinition.sql.includes("'partial'")
    ) {
      database.exec(`
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
      (database.pragma('table_info(discover_result)') as Array<{ name: string }>).map(
        (column) => column.name
      )
    )
    const discoverResultDefinition = database
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'discover_result'")
      .get() as { sql: string }
    if (
      !discoverResultColumns.has('item_kind') ||
      discoverResultDefinition.sql.includes("source IN ('arxiv', 'github')")
    ) {
      const itemKindExpression = discoverResultColumns.has('item_kind')
        ? 'item_kind'
        : "CASE source WHEN 'arxiv' THEN 'paper' WHEN 'github' THEN 'repository' ELSE 'article' END"
      database.exec(`
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
    database.exec(`
      DROP TABLE IF EXISTS google_sync_conflict;
      DROP TABLE IF EXISTS google_sync_account;
      DROP TABLE IF EXISTS sync_local_state;
    `)
  })
  try {
    migrate()
  } finally {
    database.pragma('foreign_keys = ON')
  }
  const foreignKeyViolations = database.pragma('foreign_key_check') as unknown[]
  if (foreignKeyViolations.length > 0) {
    throw new Error('The local index migration introduced a foreign-key violation')
  }
}

import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { buildAnalyticsSnapshot } from './analyticsRepository'

describe('buildAnalyticsSnapshot', () => {
  it('counts typed papers from every deployed source instead of assuming arXiv', () => {
    const database = new Database(':memory:')
    database.exec(`
      CREATE TABLE source_search_event (
        id INTEGER PRIMARY KEY,
        completed_at TEXT NOT NULL,
        result_count INTEGER NOT NULL
      );
      CREATE TABLE discover_session (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL
      );
      CREATE TABLE discover_result (
        session_id TEXT NOT NULL,
        item_id TEXT NOT NULL
      );
      CREATE TABLE discovery_item (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        item_kind TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL
      );
      CREATE TABLE analysis_artifact (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        provider_name TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      INSERT INTO discovery_item VALUES (
        'folo:64:paper:edge', 'folo:64', 'paper', 'Edge paper',
        'https://huggingface.co/papers/edge'
      );
      INSERT INTO discovery_item VALUES (
        'folo:182:article:update', 'folo:182', 'article', 'OpenAI update',
        'https://openai.com/news/update'
      );
      INSERT INTO analysis_artifact VALUES (
        'analysis:paper', 'folo:64:paper:edge', 'Codex CLI', 'codex-cli',
        '2026-08-19T10:00:00.000Z'
      );
      INSERT INTO analysis_artifact VALUES (
        'analysis:article', 'folo:182:article:update', 'Codex CLI', 'codex-cli',
        '2026-08-19T11:00:00.000Z'
      );
    `)

    const snapshot = buildAnalyticsSnapshot(database, new Date('2026-08-19T12:00:00.000Z'))

    expect(snapshot.totals.deepAnalyses).toBe(2)
    expect(snapshot.totals.analyzedPapers).toBe(1)
    database.close()
  })
})

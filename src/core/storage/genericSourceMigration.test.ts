import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import type { RankedDiscoveryItem } from '../../shared/discovery'
import { ResearchRepository } from './researchRepository'

function createLegacyDatabase(): Database.Database {
  const database = new Database(':memory:')
  database.pragma('foreign_keys = ON')
  database.exec(`
    CREATE TABLE discovery_item (
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
      in_daily_inbox INTEGER NOT NULL DEFAULT 1 CHECK (in_daily_inbox IN (0, 1)),
      triage_state TEXT NOT NULL CHECK (triage_state IN ('new', 'viewed', 'saved', 'dismissed')),
      triage_updated_at TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
    CREATE TABLE source_run (
      source TEXT PRIMARY KEY CHECK (source IN ('arxiv', 'github')),
      status TEXT NOT NULL CHECK (status IN ('idle', 'refreshing', 'healthy', 'partial', 'failed')),
      completed_at TEXT NOT NULL,
      error_message TEXT,
      result_count INTEGER
    );
    CREATE TABLE source_search_event (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL CHECK (source IN ('arxiv', 'github')),
      status TEXT NOT NULL CHECK (status IN ('healthy', 'partial', 'failed')),
      completed_at TEXT NOT NULL,
      result_count INTEGER NOT NULL CHECK (result_count >= 0)
    );
    CREATE TABLE analysis_artifact (
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
    INSERT INTO discovery_item VALUES (
      'arxiv:legacy', 'arxiv', 'legacy', 'Legacy saved paper', 'Legacy summary',
      'https://arxiv.org/abs/legacy', '2026-08-18T00:00:00.000Z',
      '2026-08-18T00:00:00.000Z', '[]', '[]', '[]', NULL, NULL, 10, 0,
      '["Legacy reason"]', 1, 'saved', '2026-08-18T09:00:00.000Z',
      '2026-08-18T09:00:00.000Z', '2026-08-18T09:00:00.000Z'
    );
    INSERT INTO source_run VALUES ('arxiv', 'healthy', '2026-08-18T09:00:00.000Z', NULL, 1);
    INSERT INTO source_search_event(source, status, completed_at, result_count)
    VALUES ('arxiv', 'healthy', '2026-08-18T09:00:00.000Z', 1);
    INSERT INTO analysis_artifact VALUES (
      'analysis:legacy', 'arxiv:legacy', 'provider', 'Provider', 'model',
      'discovery-analysis-v1', '${'a'.repeat(64)}', 'Preserved analysis', NULL, NULL,
      '2026-08-18T10:00:00.000Z'
    );
  `)
  return database
}

const huggingFaceItem: RankedDiscoveryItem = {
  item: {
    id: 'folo:64:model:research/model-a',
    source: 'folo:64',
    kind: 'model',
    externalId: 'research/model-a',
    title: 'research/model-a',
    summary: 'An efficient edge model.',
    url: 'https://huggingface.co/research/model-a',
    publishedAt: '2026-08-19T08:00:00.000Z',
    updatedAt: '2026-08-19T08:00:00.000Z',
    authors: [],
    categories: [],
    topics: ['edge-ai'],
    language: null,
    stars: null,
    metrics: { downloads: 12 }
  },
  score: 24,
  excluded: false,
  reasons: [
    {
      kind: 'recency',
      value: '0d',
      weight: 14,
      label: 'Published today'
    }
  ]
}

describe('generic source migration', () => {
  it('removes the legacy source constraint without losing Saved or analysis history', () => {
    const database = createLegacyDatabase()
    const repository = new ResearchRepository(database)

    repository.upsertRankedItems([huggingFaceItem], '2026-08-19T09:00:00.000Z')
    repository.recordSourceRun('folo:64', 'healthy', '2026-08-19T09:00:00.000Z', null, 1)

    expect(repository.getDiscoveryItem(huggingFaceItem.item.id)).toMatchObject({
      source: 'folo:64',
      kind: 'model'
    })
    expect(repository.listSavedItems()).toContainEqual(
      expect.objectContaining({ id: 'arxiv:legacy', source: 'arxiv', kind: 'paper' })
    )
    expect(repository.getLatestAnalysis('arxiv:legacy')).toMatchObject({
      id: 'analysis:legacy',
      content: 'Preserved analysis'
    })
    expect(
      repository.getAnalyticsSnapshot(new Date('2026-08-19T12:00:00.000Z')).totals
    ).toMatchObject({ todayResults: 2, deepAnalyses: 1 })
    expect(database.pragma('foreign_key_check')).toEqual([])
    for (const table of ['discovery_item', 'source_run', 'source_search_event']) {
      const row = database
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(table) as { sql: string }
      expect(row.sql).not.toContain("source IN ('arxiv', 'github')")
    }

    repository.close()
  })

  it('atomically replaces one successful source edition while retaining Saved history', () => {
    const repository = new ResearchRepository(new Database(':memory:'))
    repository.upsertRankedItems([huggingFaceItem], '2026-08-19T08:00:00.000Z')
    repository.setTriageState(huggingFaceItem.item.id, 'saved')
    const replacement: RankedDiscoveryItem = {
      ...huggingFaceItem,
      item: {
        ...huggingFaceItem.item,
        id: 'folo:64:model:research/model-b',
        externalId: 'research/model-b',
        title: 'research/model-b'
      }
    }

    repository.replaceDailySourceItems('folo:64', [replacement], '2026-08-19T09:00:00.000Z')

    expect(repository.listDashboardItems().map((item) => item.id)).toEqual([
      'folo:64:model:research/model-b'
    ])
    expect(repository.listSavedItems()).toContainEqual(
      expect.objectContaining({ id: huggingFaceItem.item.id, triageState: 'saved' })
    )
    repository.close()
  })
})

import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import type {
  DiscoverSnapshot,
  DiscoverSourceOutcome,
  DiscoverResultItem
} from '../../shared/discover'
import { DISCOVER_SOURCE_IDS } from '../../shared/discover'
import type { DiscoveryItemKind, DiscoverySource } from '../../shared/discovery'
import { ResearchRepository } from './researchRepository'

const NOT_SEARCHED: DiscoverSourceOutcome = {
  status: 'not_searched',
  resultCount: 0,
  error: null
}

function sourceRecord<Value>(
  createValue: (source: DiscoverySource) => Value
): Record<DiscoverySource, Value> {
  return Object.fromEntries(
    DISCOVER_SOURCE_IDS.map((source) => [source, createValue(source)])
  ) as Record<DiscoverySource, Value>
}

function discoverSnapshotWithDataset(): DiscoverSnapshot {
  const sourceOutcomes = sourceRecord(() => ({ ...NOT_SEARCHED }))
  sourceOutcomes['folo:64'] = {
    status: 'partial',
    resultCount: 1,
    error: 'One bounded record was rejected'
  }

  const byKind = Object.fromEntries(
    (
      [
        'paper',
        'repository',
        'article',
        'model',
        'dataset',
        'post'
      ] as const satisfies readonly DiscoveryItemKind[]
    ).map((kind) => [kind, kind === 'dataset' ? 1 : 0])
  ) as Record<DiscoveryItemKind, number>
  const bySource = sourceRecord((source) => (source === 'folo:64' ? 1 : 0))
  const item: DiscoverResultItem = {
    id: 'folo:64:dataset:edge-corpus',
    source: 'folo:64',
    kind: 'dataset',
    externalId: 'edge-corpus',
    title: 'Edge deployment corpus',
    summary: 'A dataset for constrained edge inference research.',
    url: 'https://huggingface.co/datasets/example/edge-corpus',
    publishedAt: '2026-08-18T08:00:00.000Z',
    updatedAt: '2026-08-18T09:00:00.000Z',
    authors: ['Example Lab'],
    categories: [],
    topics: ['edge-ai'],
    language: null,
    stars: null,
    metrics: {},
    score: 74,
    reasons: ['Summary matches “edge deployment”'],
    saved: false
  }

  return {
    id: 'discover-session-all-sources',
    intent: 'Find edge deployment datasets',
    runner: 'codex',
    status: 'completed',
    createdAt: '2026-08-19T10:00:00.000Z',
    plan: {
      version: 'discover-plan-v1',
      intentSummary: 'Find data for edge deployment studies.',
      arxiv: { categories: [], keywords: ['edge deployment'], excludeKeywords: [] },
      github: { keywords: ['edge deployment'], topics: [], languages: [] },
      rationale: 'Search across the selected research sources.'
    },
    provenance: {
      providerId: 'local-agent:codex',
      providerName: 'Codex CLI',
      model: 'codex-cli',
      promptVersion: 'semantic-discover-v1',
      personalizationApplied: false,
      inputHash: 'a'.repeat(64),
      createdAt: '2026-08-19T10:00:00.000Z'
    },
    sourceOutcomes,
    counts: {
      total: 1,
      arxiv: 0,
      github: 0,
      byKind,
      bySource
    },
    items: [item]
  }
}

function createLegacyDiscoverDatabase(): Database.Database {
  const database = new Database(':memory:')
  database.exec(`
    CREATE TABLE discover_session (
      id TEXT PRIMARY KEY,
      intent TEXT NOT NULL,
      runner TEXT NOT NULL CHECK (runner IN ('model-provider', 'codex', 'claude')),
      status TEXT NOT NULL CHECK (status IN ('completed', 'partial', 'no_results', 'failed')),
      plan_json TEXT NOT NULL,
      provenance_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE discover_source_run (
      session_id TEXT NOT NULL REFERENCES discover_session(id) ON DELETE CASCADE,
      source TEXT NOT NULL CHECK (source IN ('arxiv', 'github')),
      status TEXT NOT NULL CHECK (status IN ('not_searched', 'healthy', 'no_results', 'failed')),
      result_count INTEGER NOT NULL CHECK (result_count >= 0),
      error_message TEXT,
      PRIMARY KEY(session_id, source)
    );
    CREATE TABLE discover_result (
      session_id TEXT NOT NULL REFERENCES discover_session(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL,
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
      reasons_json TEXT NOT NULL,
      result_rank INTEGER NOT NULL CHECK (result_rank >= 0),
      PRIMARY KEY(session_id, item_id)
    );
  `)
  database
    .prepare(
      `INSERT INTO discover_session(
         id, intent, runner, status, plan_json, provenance_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      'legacy-discover-session',
      'Find pruning work',
      'codex',
      'partial',
      JSON.stringify({
        version: 'discover-plan-v1',
        intentSummary: 'Find pruning work.',
        arxiv: {
          categories: ['cs.LG'],
          keywords: ['structured pruning'],
          excludeKeywords: []
        },
        github: { keywords: ['structured pruning'], topics: [], languages: ['Python'] },
        rationale: 'Cover papers and implementations.'
      }),
      JSON.stringify({
        providerId: 'local-agent:codex',
        providerName: 'Codex CLI',
        model: 'codex-cli',
        promptVersion: 'semantic-discover-v1',
        inputHash: 'b'.repeat(64),
        createdAt: '2026-08-16T10:00:00.000Z'
      }),
      '2026-08-16T10:00:00.000Z'
    )
  database.exec(`
    INSERT INTO discover_source_run VALUES
      ('legacy-discover-session', 'arxiv', 'healthy', 1, NULL),
      ('legacy-discover-session', 'github', 'failed', 0, 'rate limited');
    INSERT INTO discover_result VALUES (
      'legacy-discover-session', 'arxiv:2608.00001', 'arxiv', '2608.00001',
      'Legacy pruning paper', 'Legacy abstract', 'https://arxiv.org/abs/2608.00001',
      '2026-08-15T08:00:00.000Z', '2026-08-15T08:00:00.000Z',
      '["A. Researcher"]', '["cs.LG"]', '[]', NULL, NULL, 61,
      '["Title matches pruning"]', 0
    );
  `)
  return database
}

describe('ResearchRepository Discover migration', () => {
  it('removes the legacy two-source constraints without losing old sessions', () => {
    const database = createLegacyDiscoverDatabase()
    const repository = new ResearchRepository(database)

    const sourceRunDefinition = database
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'discover_source_run'"
      )
      .pluck()
      .get() as string
    const resultDefinition = database
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'discover_result'")
      .pluck()
      .get() as string
    const resultColumns = database.pragma('table_info(discover_result)') as Array<{ name: string }>
    const migratedResult = database
      .prepare(
        `SELECT source, item_kind, title, result_rank
         FROM discover_result WHERE session_id = ? AND item_id = ?`
      )
      .get('legacy-discover-session', 'arxiv:2608.00001')

    expect(sourceRunDefinition).not.toContain("source IN ('arxiv', 'github')")
    expect(sourceRunDefinition).toContain("'partial'")
    expect(resultDefinition).not.toContain("source IN ('arxiv', 'github')")
    expect(resultColumns.map((column) => column.name)).toContain('item_kind')
    expect(migratedResult).toEqual({
      source: 'arxiv',
      item_kind: 'paper',
      title: 'Legacy pruning paper',
      result_rank: 0
    })

    const restored = repository.getLatestDiscoverSnapshot()!
    expect(restored.items).toEqual([
      expect.objectContaining({
        id: 'arxiv:2608.00001',
        source: 'arxiv',
        kind: 'paper',
        title: 'Legacy pruning paper'
      })
    ])
    expect(restored.sourceOutcomes.arxiv).toEqual({
      status: 'healthy',
      resultCount: 1,
      error: null
    })
    expect(restored.sourceOutcomes.github).toEqual({
      status: 'failed',
      resultCount: 0,
      error: 'rate limited'
    })
    expect(restored.sourceOutcomes['folo:64']).toEqual(NOT_SEARCHED)
    expect(restored.counts.bySource['folo:64']).toBe(0)
    expect(restored.provenance.personalizationApplied).toBe(false)
    repository.close()
  })

  it('round-trips every active source and preserves item kind when promoting to Saved', () => {
    const database = new Database(':memory:')
    const repository = new ResearchRepository(database)
    const snapshot = discoverSnapshotWithDataset()

    repository.saveDiscoverSnapshot(snapshot)

    const restored = repository.getLatestDiscoverSnapshot()!
    expect(Object.keys(restored.sourceOutcomes)).toEqual(DISCOVER_SOURCE_IDS)
    expect(restored.sourceOutcomes['folo:64']).toEqual({
      status: 'partial',
      resultCount: 1,
      error: 'One bounded record was rejected'
    })
    expect(restored.counts).toEqual(snapshot.counts)
    expect(restored.items).toEqual(snapshot.items)

    repository.saveDiscoverResult(
      snapshot.id,
      'folo:64:dataset:edge-corpus',
      '2026-08-19T10:05:00.000Z'
    )

    expect(repository.listSavedItems()).toEqual([
      expect.objectContaining({
        id: 'folo:64:dataset:edge-corpus',
        source: 'folo:64',
        kind: 'dataset',
        triageState: 'saved'
      })
    ])
    expect(
      database
        .prepare('SELECT item_kind FROM discovery_item WHERE id = ?')
        .pluck()
        .get('folo:64:dataset:edge-corpus')
    ).toBe('dataset')
    repository.close()
  })
})

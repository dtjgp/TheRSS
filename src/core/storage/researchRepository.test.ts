import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import type { InterestProfile } from '../interests/interestProfile'
import type { DiscoveryItem, RankedDiscoveryItem } from '../../shared/discovery'
import { DISCOVER_SOURCE_IDS, type DiscoverSnapshot } from '../../shared/discover'
import { ResearchRepository } from './researchRepository'

const profile: InterestProfile = {
  name: 'Edge intelligence',
  arxiv: {
    categories: ['cs.LG', 'cs.NI'],
    keywords: ['structured pruning'],
    excludeKeywords: ['medical imaging']
  },
  github: {
    keywords: ['model compression'],
    topics: ['edge-ai'],
    languages: ['Python']
  }
}

function rankedItem(overrides: Partial<DiscoveryItem> = {}): RankedDiscoveryItem {
  return {
    item: {
      id: 'arxiv:2608.00001',
      source: 'arxiv',
      kind: 'paper',
      externalId: '2608.00001',
      title: 'Structured pruning for edge deployment',
      summary: 'A resource-aware method.',
      url: 'https://arxiv.org/abs/2608.00001',
      publishedAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
      authors: ['A. Researcher'],
      categories: ['cs.LG'],
      topics: [],
      language: null,
      stars: null,
      metrics: {},
      ...overrides
    },
    score: 62,
    excluded: false,
    reasons: [
      {
        kind: 'keyword',
        value: 'structured pruning',
        field: 'title',
        weight: 30,
        label: 'Title matches “structured pruning”'
      }
    ]
  }
}

function createRepository(): ResearchRepository {
  return new ResearchRepository(new Database(':memory:'))
}

function discoverSnapshot(): DiscoverSnapshot {
  const sourceOutcomes = Object.fromEntries(
    DISCOVER_SOURCE_IDS.map((source) => [
      source,
      source === 'arxiv'
        ? { status: 'healthy', resultCount: 1, error: null }
        : source === 'github'
          ? { status: 'failed', resultCount: 0, error: 'rate limited' }
          : { status: 'not_searched', resultCount: 0, error: null }
    ])
  ) as DiscoverSnapshot['sourceOutcomes']
  const bySource = Object.fromEntries(
    DISCOVER_SOURCE_IDS.map((source) => [source, source === 'arxiv' ? 1 : 0])
  ) as DiscoverSnapshot['counts']['bySource']

  return {
    id: 'discover-session-1',
    intent: 'semantic communication pruning',
    runner: 'codex',
    status: 'partial',
    createdAt: '2026-08-16T10:00:00.000Z',
    plan: {
      version: 'discover-plan-v1',
      intentSummary: 'Find pruning-aware semantic communication work.',
      arxiv: {
        categories: ['cs.LG'],
        keywords: ['semantic communication', 'structured pruning'],
        excludeKeywords: []
      },
      github: { keywords: ['model compression'], topics: [], languages: ['Python'] },
      rationale: 'Cover papers and implementations.'
    },
    provenance: {
      providerId: 'local-agent:codex',
      providerName: 'Codex CLI',
      model: 'codex-cli',
      promptVersion: 'semantic-discover-v1',
      inputHash: 'a'.repeat(64),
      createdAt: '2026-08-16T10:00:00.000Z'
    },
    sourceOutcomes,
    counts: {
      total: 1,
      arxiv: 1,
      github: 0,
      byKind: { paper: 1, repository: 0, article: 0, model: 0, dataset: 0, post: 0 },
      bySource
    },
    items: [
      {
        ...rankedItem().item,
        score: 62,
        reasons: ['Title matches “structured pruning”'],
        saved: false
      }
    ]
  }
}

describe('ResearchRepository', () => {
  it('adds provenance and result-count columns to an existing initial database', () => {
    const database = new Database(':memory:')
    database.exec(`
      CREATE TABLE analysis_artifact (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        provider_name TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_version TEXT NOT NULL,
        content TEXT NOT NULL,
        input_tokens INTEGER,
        output_tokens INTEGER,
        created_at TEXT NOT NULL
      );
      CREATE TABLE source_run (
        source TEXT PRIMARY KEY CHECK (source IN ('arxiv', 'github')),
        status TEXT NOT NULL CHECK (status IN ('idle', 'refreshing', 'healthy', 'partial', 'failed')),
        completed_at TEXT NOT NULL,
        error_message TEXT
      );
      INSERT INTO source_run(source, status, completed_at, error_message)
      VALUES ('arxiv', 'healthy', '2026-08-14T09:00:00.000Z', NULL);
    `)

    const repository = new ResearchRepository(database)
    const analysisColumns = database.pragma('table_info(analysis_artifact)') as Array<{
      name: string
    }>
    const sourceRunColumns = database.pragma('table_info(source_run)') as Array<{ name: string }>

    expect(analysisColumns.map((column) => column.name)).toContain('source_hash')
    expect(sourceRunColumns.map((column) => column.name)).toContain('result_count')
    expect(
      repository.getAnalyticsSnapshot(new Date('2026-08-15T12:00:00.000Z')).totals.todayResults
    ).toBe(0)
    repository.close()
  })

  it('adds and backfills the triage timestamp in an existing discovery database', () => {
    const database = new Database(':memory:')
    database.exec(`
      CREATE TABLE discovery_item (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
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
        excluded INTEGER NOT NULL,
        reasons_json TEXT NOT NULL,
        triage_state TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );
      INSERT INTO discovery_item VALUES (
        'arxiv:legacy', 'arxiv', 'legacy', 'Legacy paper', 'Legacy summary',
        'https://arxiv.org/abs/legacy', '2026-08-14T00:00:00.000Z',
        '2026-08-14T00:00:00.000Z', '[]', '[]', '[]', NULL, NULL, 1, 0, '[]',
        'saved', '2026-08-14T09:00:00.000Z', '2026-08-15T10:00:00.000Z'
      );
    `)

    const repository = new ResearchRepository(database)
    const columns = database.pragma('table_info(discovery_item)') as Array<{ name: string }>
    const migrated = database
      .prepare('SELECT triage_updated_at FROM discovery_item WHERE id = ?')
      .get('arxiv:legacy') as { triage_updated_at: string }

    expect(columns.map((column) => column.name)).toContain('triage_updated_at')
    expect(migrated.triage_updated_at).toBe('2026-08-15T10:00:00.000Z')
    repository.close()
  })

  it('removes withdrawn synchronization credentials and metadata during migration', () => {
    const database = new Database(':memory:')
    database.exec(`
      CREATE TABLE sync_local_state (singleton_id INTEGER PRIMARY KEY);
      CREATE TABLE google_sync_account (
        singleton_id INTEGER PRIMARY KEY,
        refresh_token_ciphertext BLOB NOT NULL
      );
      CREATE TABLE google_sync_conflict (singleton_id INTEGER PRIMARY KEY);
      INSERT INTO google_sync_account VALUES (1, X'656E63727970746564');
    `)

    const repository = new ResearchRepository(database)
    const remaining = database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN (
           'sync_local_state', 'google_sync_account', 'google_sync_conflict'
         )`
      )
      .all()

    expect(remaining).toEqual([])
    repository.close()
  })

  it('persists one validated interest profile', () => {
    const repository = createRepository()

    expect(repository.getInterestProfile()).toBeNull()
    repository.saveInterestProfile(profile, '2026-08-15T10:00:00.000Z')

    expect(repository.getInterestProfile()).toEqual(profile)
    repository.close()
  })

  it('upserts ranked items while preserving the user triage state', () => {
    const repository = createRepository()
    repository.upsertRankedItems([rankedItem()], '2026-08-15T10:00:00.000Z')
    repository.setTriageState('arxiv:2608.00001', 'saved')

    repository.upsertRankedItems(
      [rankedItem({ summary: 'A revised abstract.' })],
      '2026-08-15T11:00:00.000Z'
    )

    const [item] = repository.listDashboardItems()
    expect(item!.summary).toBe('A revised abstract.')
    expect(item!.triageState).toBe('saved')
    repository.close()
  })

  it('keeps source-only history out of Today and returns the rolling 30-day window', () => {
    const repository = createRepository()
    const source = 'folo:302' as const
    const recent = rankedItem({
      id: 'folo:302:article:recent',
      source,
      kind: 'article',
      externalId: 'recent',
      title: 'Recent BAAI signal',
      url: 'https://www.baai.ac.cn/news/recent',
      publishedAt: '2026-08-10T08:00:00.000Z',
      updatedAt: '2026-08-10T08:00:00.000Z'
    })
    const recentlyUpdated = rankedItem({
      id: 'folo:302:article:updated',
      source,
      kind: 'article',
      externalId: 'updated',
      title: 'Updated BAAI signal',
      url: 'https://www.baai.ac.cn/news/updated',
      publishedAt: '2026-06-01T08:00:00.000Z',
      updatedAt: '2026-08-18T08:00:00.000Z'
    })
    const old = rankedItem({
      id: 'folo:302:article:old',
      source,
      kind: 'article',
      externalId: 'old',
      title: 'Old BAAI signal',
      url: 'https://www.baai.ac.cn/news/old',
      publishedAt: '2026-06-01T08:00:00.000Z',
      updatedAt: '2026-06-02T08:00:00.000Z'
    })

    repository.upsertSourceHistoryItems([recent, recentlyUpdated, old], '2026-08-19T09:00:00.000Z')

    expect(repository.listDashboardItems()).toEqual([])
    expect(
      repository.getSourceContentSnapshot(source, new Date('2026-08-19T12:00:00.000Z'))
    ).toMatchObject({
      source,
      status: 'cached',
      windowDays: 30,
      windowStart: '2026-07-20T12:00:00.000Z',
      windowEnd: '2026-08-19T12:00:00.000Z',
      lastIndexedAt: '2026-08-19T09:00:00.000Z',
      items: [
        { id: 'folo:302:article:updated', updatedAt: '2026-08-18T08:00:00.000Z' },
        { id: 'folo:302:article:recent', updatedAt: '2026-08-10T08:00:00.000Z' }
      ]
    })
    repository.close()
  })

  it('limits arXiv Sources browsing to papers published on the current local day', () => {
    const repository = createRepository()
    const today = rankedItem({
      id: 'arxiv:2608.00002',
      externalId: '2608.00002',
      title: 'Today paper',
      publishedAt: '2026-08-19T08:00:00.000Z',
      updatedAt: '2026-08-19T08:00:00.000Z'
    })
    const oldUpdatedToday = rankedItem({
      id: 'arxiv:2608.00001',
      externalId: '2608.00001',
      title: 'Older paper revised today',
      publishedAt: '2026-08-18T08:00:00.000Z',
      updatedAt: '2026-08-19T09:00:00.000Z'
    })
    repository.upsertSourceHistoryItems([today, oldUpdatedToday], '2026-08-19T10:00:00.000Z')

    const now = new Date('2026-08-19T12:00:00.000Z')
    const localDayStart = new Date(now)
    localDayStart.setUTCHours(0, 0, 0, 0)
    expect(repository.getSourceContentSnapshot('arxiv', now)).toMatchObject({
      source: 'arxiv',
      windowDays: 1,
      windowStart: localDayStart.toISOString(),
      windowEnd: '2026-08-19T12:00:00.000Z',
      items: [{ id: 'arxiv:2608.00002' }]
    })
    repository.close()
  })

  it('hides excluded and dismissed signals and orders the rest by score', () => {
    const repository = createRepository()
    const highScore = rankedItem()
    const lowScore: RankedDiscoveryItem = {
      ...rankedItem({
        id: 'github:owner/repo',
        externalId: 'owner/repo',
        source: 'github',
        title: 'owner/repo',
        url: 'https://github.com/owner/repo',
        language: 'Python',
        stars: 20
      }),
      score: 25
    }
    const excluded: RankedDiscoveryItem = {
      ...rankedItem({
        id: 'arxiv:2608.00002',
        externalId: '2608.00002',
        title: 'Medical imaging benchmark'
      }),
      score: 0,
      excluded: true
    }

    repository.upsertRankedItems([lowScore, excluded, highScore], '2026-08-15T10:00:00.000Z')
    repository.setTriageState(highScore.item.id, 'dismissed')

    expect(repository.listDashboardItems().map((item) => item.id)).toEqual(['github:owner/repo'])
    repository.close()
  })

  it('builds dashboard counts from persisted items', () => {
    const repository = createRepository()
    repository.saveInterestProfile(profile, '2026-08-15T10:00:00.000Z')
    repository.upsertRankedItems(
      [
        rankedItem(),
        {
          ...rankedItem({
            id: 'github:owner/repo',
            externalId: 'owner/repo',
            source: 'github',
            title: 'owner/repo',
            url: 'https://github.com/owner/repo'
          }),
          score: 25
        }
      ],
      '2026-08-15T10:05:00.000Z'
    )
    repository.setTriageState('github:owner/repo', 'viewed')
    repository.recordSourceRun('arxiv', 'healthy', '2026-08-15T10:05:00.000Z')

    expect(repository.getDashboardSnapshot(new Date('2026-08-15T12:00:00.000Z'))).toMatchObject({
      date: '2026-08-15',
      profileName: 'Edge intelligence',
      lastRefreshAt: null,
      sourceHealth: { arxiv: 'healthy', github: 'idle' },
      counts: { total: 2, arxiv: 1, github: 1, unread: 1 }
    })
    repository.close()
  })

  it('does not treat an interrupted refreshing run as a completed daily refresh', () => {
    const repository = createRepository()
    repository.saveInterestProfile(profile, '2026-08-15T09:00:00.000Z')
    repository.recordSourceRun('arxiv', 'refreshing', '2026-08-15T10:00:00.000Z')

    expect(
      repository.getDashboardSnapshot(new Date('2026-08-15T10:05:00.000Z')).lastRefreshAt
    ).toBeNull()

    repository.recordSourceRun('arxiv', 'failed', '2026-08-15T10:06:00.000Z', 'offline')
    expect(
      repository.getDashboardSnapshot(new Date('2026-08-15T10:07:00.000Z')).lastRefreshAt
    ).toBeNull()
    repository.close()
  })

  it('retries when one configured source completes before another is interrupted', () => {
    const repository = createRepository()
    repository.saveInterestProfile(profile, '2026-08-15T09:00:00.000Z')
    repository.recordSourceRun('arxiv', 'healthy', '2026-08-15T10:00:00.000Z', null, 2)
    repository.recordSourceRun('github', 'refreshing', '2026-08-15T10:00:00.000Z')

    expect(
      repository.getDashboardSnapshot(new Date('2026-08-15T10:05:00.000Z')).lastRefreshAt
    ).toBeNull()
    repository.close()
  })

  it('rejects invalid list limits and updates for unknown items', () => {
    const repository = createRepository()

    expect(() => repository.listDashboardItems(0)).toThrow('between 1 and 500')
    expect(() => repository.getAnalyticsSnapshot(new Date(), 0)).toThrow('between 1 and 90 days')
    expect(() => repository.getAnalyticsSnapshot(new Date(), 91)).toThrow('between 1 and 90 days')
    expect(() => repository.setTriageState('missing', 'saved')).toThrow('Unknown discovery item')
    repository.close()
  })

  it('round-trips Discover sessions without polluting the Today inbox', () => {
    const repository = createRepository()
    const snapshot = discoverSnapshot()

    repository.saveDiscoverSnapshot(snapshot)

    expect(repository.getLatestDiscoverSnapshot()).toEqual(snapshot)
    expect(repository.listDashboardItems()).toEqual([])
    repository.close()
  })

  it('keeps retired-source history recoverable but excludes it from Today', () => {
    const repository = createRepository()
    const retired = rankedItem({
      id: 'folo:2:post:retired',
      source: 'folo:2',
      kind: 'article',
      externalId: 'retired',
      title: 'Retired X signal',
      url: 'https://x.com/example/status/1'
    })

    repository.upsertRankedItems([retired], '2026-08-19T09:00:00.000Z')
    repository.setTriageState(retired.item.id, 'saved', '2026-08-19T09:01:00.000Z')

    expect(repository.listDashboardItems()).toEqual([])
    expect(repository.listSavedItems()).toEqual([
      expect.objectContaining({ id: retired.item.id, triageState: 'saved' })
    ])
    repository.close()
  })

  it('promotes a Discover result into Saved while keeping it out of Today', () => {
    const repository = createRepository()
    repository.saveDiscoverSnapshot(discoverSnapshot())

    repository.saveDiscoverResult(
      'discover-session-1',
      'arxiv:2608.00001',
      '2026-08-16T10:05:00.000Z'
    )

    expect(repository.listDashboardItems()).toEqual([])
    expect(repository.listSavedItems()).toEqual([
      expect.objectContaining({ id: 'arxiv:2608.00001', triageState: 'saved' })
    ])
    expect(repository.getLatestDiscoverSnapshot()?.items[0]?.saved).toBe(true)
    repository.close()
  })

  it('retains a saved Discover item when a later Today refresh observes it', () => {
    const repository = createRepository()
    repository.saveDiscoverSnapshot(discoverSnapshot())
    repository.saveDiscoverResult('discover-session-1', 'arxiv:2608.00001')

    repository.upsertRankedItems([rankedItem()], '2026-08-17T10:00:00.000Z')

    expect(repository.listDashboardItems()).toEqual([
      expect.objectContaining({ id: 'arxiv:2608.00001', triageState: 'saved' })
    ])
    expect(repository.listSavedItems()).toHaveLength(1)
    expect(repository.findSavedItemIds(['arxiv:2608.00001', 'github:missing'])).toEqual([
      'arxiv:2608.00001'
    ])
    repository.close()
  })

  it('aggregates daily search result volume and deep-analysis history without inventing old Today runs', () => {
    const repository = createRepository()
    repository.upsertRankedItems([rankedItem()], '2026-08-15T08:00:00.000Z')

    repository.recordSourceRun('arxiv', 'refreshing', '2026-08-15T09:00:00.000Z')
    repository.recordSourceRun('arxiv', 'healthy', '2026-08-15T09:01:00.000Z', null, 3)
    repository.recordSourceRun('github', 'failed', '2026-08-15T09:01:00.000Z', 'offline')
    repository.recordSourceRun('arxiv', 'healthy', '2026-08-16T09:01:00.000Z', null, 2)
    repository.saveDiscoverSnapshot(discoverSnapshot())

    repository.saveAnalysis(
      {
        id: 'analysis-1',
        itemId: 'arxiv:2608.00001',
        providerId: 'default',
        providerName: 'DeepSeek',
        model: 'deepseek-chat',
        promptVersion: 'discovery-analysis-v1',
        sourceHash: 'a'.repeat(64),
        content: 'Analysis one',
        createdAt: '2026-08-16T11:00:00.000Z'
      },
      { inputTokens: 20, outputTokens: 10 }
    )
    repository.saveAnalysis(
      {
        id: 'analysis-2',
        itemId: 'arxiv:2608.00001',
        providerId: 'local-agent:codex',
        providerName: 'Codex CLI',
        model: 'codex-cli',
        promptVersion: 'discovery-analysis-v1',
        sourceHash: 'b'.repeat(64),
        content: 'Analysis two',
        createdAt: '2026-08-16T12:00:00.000Z'
      },
      { inputTokens: null, outputTokens: null }
    )

    expect(repository.getAnalyticsSnapshot(new Date('2026-08-17T12:00:00.000Z'), 3)).toEqual({
      generatedAt: '2026-08-17T12:00:00.000Z',
      windowDays: 3,
      trackingStartedAt: '2026-08-15T09:01:00.000Z',
      totals: {
        searchResults: 6,
        todayResults: 5,
        discoverResults: 1,
        deepAnalyses: 2,
        analyzedPapers: 1
      },
      daily: [
        {
          date: '2026-08-15',
          searchResults: 3,
          todayResults: 3,
          discoverResults: 0,
          deepAnalyses: 0
        },
        {
          date: '2026-08-16',
          searchResults: 3,
          todayResults: 2,
          discoverResults: 1,
          deepAnalyses: 2
        },
        {
          date: '2026-08-17',
          searchResults: 0,
          todayResults: 0,
          discoverResults: 0,
          deepAnalyses: 0
        }
      ],
      analyzedItems: [
        {
          analysisId: 'analysis-2',
          itemId: 'arxiv:2608.00001',
          source: 'arxiv',
          title: 'Structured pruning for edge deployment',
          url: 'https://arxiv.org/abs/2608.00001',
          providerName: 'Codex CLI',
          model: 'codex-cli',
          createdAt: '2026-08-16T12:00:00.000Z'
        },
        {
          analysisId: 'analysis-1',
          itemId: 'arxiv:2608.00001',
          source: 'arxiv',
          title: 'Structured pruning for edge deployment',
          url: 'https://arxiv.org/abs/2608.00001',
          providerName: 'DeepSeek',
          model: 'deepseek-chat',
          createdAt: '2026-08-16T11:00:00.000Z'
        }
      ]
    })

    repository.close()
  })
})

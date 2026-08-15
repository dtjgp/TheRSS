import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import type { InterestProfile } from '../interests/interestProfile'
import type { DiscoveryItem, RankedDiscoveryItem } from '../../shared/discovery'
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
    `)

    const repository = new ResearchRepository(database)
    const analysisColumns = database.pragma('table_info(analysis_artifact)') as Array<{
      name: string
    }>
    const sourceRunColumns = database.pragma('table_info(source_run)') as Array<{ name: string }>

    expect(analysisColumns.map((column) => column.name)).toContain('source_hash')
    expect(sourceRunColumns.map((column) => column.name)).toContain('result_count')
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
      lastRefreshAt: '2026-08-15T10:05:00.000Z',
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
    ).toBe('2026-08-15T10:06:00.000Z')
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
    expect(() => repository.setTriageState('missing', 'saved')).toThrow('Unknown discovery item')
    repository.close()
  })
})

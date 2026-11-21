import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import type { DiscoveryItem, RankedDiscoveryItem } from '../../shared/discovery'
import { DISCOVER_SOURCE_IDS, type DiscoverSnapshot } from '../../shared/discover'
import { ResearchRepository } from './researchRepository'

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
      personalizationApplied: false,
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

describe('ResearchRepository Discover and Analytics', () => {
  it('persists one local Discover personalization prompt', () => {
    const repository = createRepository()

    repository.saveDiscoverPersonalizationPrompt(
      'I focus on reproducible edge intelligence systems and demand-response user modeling.',
      '2026-08-20T09:00:00.000Z'
    )

    expect(repository.getDiscoverPersonalizationSettings()).toEqual({
      prompt:
        'I focus on reproducible edge intelligence systems and demand-response user modeling.',
      updatedAt: '2026-08-20T09:00:00.000Z'
    })

    repository.saveDiscoverPersonalizationPrompt('  \n  ', '2026-08-20T09:05:00.000Z')
    expect(repository.getDiscoverPersonalizationSettings()).toEqual({
      prompt: '',
      updatedAt: '2026-08-20T09:05:00.000Z'
    })
    repository.close()
  })

  it.each([
    ['semantic-discover-v2', undefined],
    ['semantic-discover-v3', undefined],
    ['semantic-discover-v3', 'true']
  ] as const)('rejects %s provenance with personalization flag %s', (promptVersion, flag) => {
    const database = new Database(':memory:')
    const repository = new ResearchRepository(database)
    repository.saveDiscoverSnapshot({
      ...discoverSnapshot(),
      provenance: {
        ...discoverSnapshot().provenance,
        promptVersion,
        personalizationApplied: true
      }
    })
    database.prepare('UPDATE discover_session SET provenance_json = ? WHERE id = ?').run(
      JSON.stringify({
        providerId: 'local-agent:codex',
        providerName: 'Codex CLI',
        model: 'codex-cli',
        promptVersion,
        personalizationApplied: flag,
        inputHash: 'a'.repeat(64),
        createdAt: '2026-08-16T10:00:00.000Z'
      }),
      'discover-session-1'
    )

    expect(() => repository.getLatestDiscoverSnapshot()).toThrow(
      'The local index contains invalid Discover provenance'
    )
    repository.close()
  })

  it('defaults legacy v1 Discover provenance without a personalization flag to false', () => {
    const database = new Database(':memory:')
    const repository = new ResearchRepository(database)
    const snapshot = discoverSnapshot()
    repository.saveDiscoverSnapshot(snapshot)
    database
      .prepare('UPDATE discover_session SET provenance_json = ? WHERE id = ?')
      .run(
        JSON.stringify({ ...snapshot.provenance, personalizationApplied: undefined }),
        snapshot.id
      )

    expect(repository.getLatestDiscoverSnapshot()).toEqual(snapshot)
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

  it.each([
    ['semantic-discover-v2', true],
    ['semantic-discover-v3', false],
    ['semantic-discover-v3', true]
  ] as const)(
    'round-trips %s with personalizationApplied=%s',
    (promptVersion, personalizationApplied) => {
      const repository = createRepository()
      const snapshot = discoverSnapshot()
      const isV3 = promptVersion === 'semantic-discover-v3'
      const session: DiscoverSnapshot = {
        ...snapshot,
        plan: isV3
          ? {
              ...snapshot.plan,
              constraintGroups: [
                ['semantic communication'],
                ['structured pruning', 'channel pruning']
              ]
            }
          : snapshot.plan,
        provenance: { ...snapshot.provenance, promptVersion, personalizationApplied },
        items: isV3
          ? snapshot.items.map((item) => ({
              ...item,
              reasons: [...item.reasons, 'Covers all 2 intent constraints']
            }))
          : snapshot.items
      }

      repository.saveDiscoverSnapshot(session)

      expect(repository.getLatestDiscoverSnapshot()).toEqual(session)
      expect(repository.getDiscoverSnapshot(session.id)).toEqual(session)
      repository.close()
    }
  )

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

  it('materializes a Discover result for analysis without silently saving it', () => {
    const repository = createRepository()
    const snapshot = discoverSnapshot()
    const nonPaperId = 'arxiv:discover-repository'
    repository.saveDiscoverSnapshot({
      ...snapshot,
      sourceOutcomes: {
        ...snapshot.sourceOutcomes,
        arxiv: { status: 'healthy', resultCount: 2, error: null }
      },
      counts: {
        ...snapshot.counts,
        total: 2,
        byKind: { ...snapshot.counts.byKind, repository: 1 },
        bySource: { ...snapshot.counts.bySource, arxiv: 2 }
      },
      items: [
        ...snapshot.items,
        {
          ...snapshot.items[0]!,
          id: nonPaperId,
          kind: 'repository',
          externalId: 'discover-repository',
          title: 'Repository-shaped Discover result',
          url: 'https://arxiv.org/abs/discover-repository'
        }
      ]
    })

    repository.materializeDiscoverResultForAnalysis(
      'discover-session-1',
      'arxiv:2608.00001',
      '2026-08-16T10:05:00.000Z'
    )

    expect(repository.getDiscoveryItem('arxiv:2608.00001')).toEqual(
      expect.objectContaining({ id: 'arxiv:2608.00001', triageState: 'viewed' })
    )
    expect(repository.listSavedItems()).toEqual([])
    expect(repository.getLatestDiscoverSnapshot()?.items[0]?.saved).toBe(false)

    repository.saveDiscoverResult('discover-session-1', 'arxiv:2608.00001')
    repository.materializeDiscoverResultForAnalysis('discover-session-1', 'arxiv:2608.00001')
    expect(repository.getDiscoveryItem('arxiv:2608.00001')?.triageState).toBe('saved')

    expect(() =>
      repository.materializeDiscoverResultForAnalysis('discover-session-1', nonPaperId)
    ).toThrow('Discover analysis is available only for paper results')
    expect(repository.getDiscoveryItem(nonPaperId)).toBeNull()
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

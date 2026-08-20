import { describe, expect, it, vi } from 'vitest'
import type { DiscoveryItem } from '../../shared/discovery'
import {
  DISCOVER_SOURCE_IDS,
  type DiscoverPlan,
  type DiscoverPlannerProvenance
} from '../../shared/discover'
import {
  CONFIGURED_SOURCE_DEFINITIONS,
  getConfiguredSourceDefinition
} from '../sources/catalog/configuredSources'
import { DiscoverService } from './discoverService'

const plan: DiscoverPlan = {
  version: 'discover-plan-v1',
  intentSummary: 'Find pruning-aware semantic communication work.',
  arxiv: {
    categories: ['cs.LG', 'eess.SP'],
    keywords: ['semantic communication', 'structured pruning'],
    excludeKeywords: []
  },
  github: {
    keywords: ['model compression'],
    topics: ['semantic-communication'],
    languages: ['Python']
  },
  rationale: 'Cover academic terminology and implementations.'
}

const provenance: DiscoverPlannerProvenance = {
  providerId: 'local-agent:codex',
  providerName: 'Codex CLI',
  model: 'codex-cli',
  promptVersion: 'semantic-discover-v1',
  personalizationApplied: false,
  inputHash: 'a'.repeat(64),
  createdAt: '2026-08-16T10:00:00.000Z'
}

function item(overrides: Partial<DiscoveryItem> = {}): DiscoveryItem {
  return {
    id: 'arxiv:2608.00001',
    source: 'arxiv',
    kind: 'paper',
    externalId: '2608.00001',
    title: 'Structured pruning for semantic communication',
    summary: 'A resource-aware semantic communication method.',
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
  }
}

function setup(overrides: Record<string, unknown> = {}) {
  const planner = {
    plan: vi.fn().mockResolvedValue({ plan, provenance })
  }
  const fetchArxiv = vi.fn().mockResolvedValue([item()])
  const fetchGitHub = vi.fn().mockResolvedValue([
    item({
      id: 'github:owner/repo',
      source: 'github',
      kind: 'repository',
      externalId: 'owner/repo',
      title: 'owner/repo',
      url: 'https://github.com/owner/repo',
      categories: [],
      topics: ['semantic-communication'],
      language: 'Python',
      stars: 42
    })
  ])
  const fetchConfiguredSource = vi.fn().mockResolvedValue({ items: [], rejectedCount: 0 })
  const repository = {
    findSavedItemIds: vi.fn().mockReturnValue([]),
    saveDiscoverSnapshot: vi.fn()
  }
  const service = new DiscoverService({
    planner,
    fetchArxiv,
    fetchGitHub,
    fetchConfiguredSource,
    repository,
    createSessionId: () => 'discover-session-1',
    ...overrides
  })
  return {
    service,
    planner,
    fetchArxiv,
    fetchGitHub,
    fetchConfiguredSource,
    repository
  }
}

describe('DiscoverService', () => {
  it('executes a validated plan through both adapters and persists explainable results', async () => {
    const { service, planner, fetchArxiv, fetchGitHub, repository } = setup()
    const request = {
      intent: 'semantic communication pruning for edge deployment',
      runner: 'codex' as const,
      sources: ['arxiv', 'github'] as Array<'arxiv' | 'github'>
    }

    const result = await service.search(request, {
      now: new Date('2026-08-16T10:00:00.000Z')
    })

    expect(planner.plan).toHaveBeenCalledWith(request, new Date('2026-08-16T10:00:00.000Z'))
    expect(fetchArxiv).toHaveBeenCalledWith(plan.arxiv)
    expect(fetchGitHub).toHaveBeenCalledWith(plan.github, {
      now: new Date('2026-08-16T10:00:00.000Z'),
      token: undefined
    })
    expect(result).toMatchObject({
      id: 'discover-session-1',
      intent: request.intent,
      runner: 'codex',
      status: 'completed',
      sourceOutcomes: {
        arxiv: { status: 'healthy', resultCount: 1, error: null },
        github: { status: 'healthy', resultCount: 1, error: null }
      },
      counts: {
        total: 2,
        arxiv: 1,
        github: 1,
        byKind: { paper: 1, repository: 1 },
        bySource: { arxiv: 1, github: 1 }
      }
    })
    expect(Object.keys(result.sourceOutcomes)).toEqual(DISCOVER_SOURCE_IDS)
    expect(result.items[0]?.reasons.length).toBeGreaterThan(0)
    expect(repository.saveDiscoverSnapshot).toHaveBeenCalledWith(result)
  })

  it('keeps successful results and reports a partial source failure', async () => {
    const fetchGitHub = vi.fn().mockRejectedValue(new Error(`private ${'x'.repeat(800)}`))
    const { service } = setup({ fetchGitHub })

    const result = await service.search({
      intent: 'edge AI pruning',
      runner: 'model-provider',
      sources: ['arxiv', 'github']
    })

    expect(result.status).toBe('partial')
    expect(result.items).toHaveLength(1)
    expect(result.sourceOutcomes.github.status).toBe('failed')
    expect(result.sourceOutcomes.github.error?.length).toBeLessThanOrEqual(500)
  })

  it('distinguishes all-source failure and successful empty searches', async () => {
    const failed = setup({
      fetchArxiv: vi.fn().mockRejectedValue(new Error('offline')),
      fetchGitHub: vi.fn().mockRejectedValue(new Error('rate limited'))
    })
    const empty = setup({
      fetchArxiv: vi.fn().mockResolvedValue([]),
      fetchGitHub: vi.fn().mockResolvedValue([])
    })
    const request = {
      intent: 'edge AI pruning',
      runner: 'claude' as const,
      sources: ['arxiv', 'github'] as Array<'arxiv' | 'github'>
    }

    await expect(failed.service.search(request)).resolves.toMatchObject({
      status: 'failed',
      items: []
    })
    await expect(empty.service.search(request)).resolves.toMatchObject({
      status: 'no_results',
      items: []
    })
  })

  it('does not call an unselected source and deduplicates by stable source identity', async () => {
    const older = item({ updatedAt: '2026-08-13T00:00:00.000Z', summary: 'Older metadata.' })
    const newer = item({ updatedAt: '2026-08-15T00:00:00.000Z', summary: 'Newer metadata.' })
    const { service, fetchGitHub } = setup({
      fetchArxiv: vi.fn().mockResolvedValue([older, newer])
    })

    const result = await service.search({
      intent: 'edge AI pruning',
      runner: 'codex',
      sources: ['arxiv']
    })

    expect(fetchGitHub).not.toHaveBeenCalled()
    expect(result.sourceOutcomes.github.status).toBe('not_searched')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.summary).toBe('Newer metadata.')
  })

  it('does not execute sources when planning fails', async () => {
    const planner = { plan: vi.fn().mockRejectedValue(new Error('invalid plan')) }
    const { service, fetchArxiv, fetchGitHub } = setup({ planner })

    await expect(
      service.search({ intent: 'edge AI pruning', runner: 'codex', sources: ['arxiv'] })
    ).rejects.toThrow('invalid plan')
    expect(fetchArxiv).not.toHaveBeenCalled()
    expect(fetchGitHub).not.toHaveBeenCalled()
  })

  it('marks results that are already present in Saved', async () => {
    const repository = {
      findSavedItemIds: vi.fn().mockReturnValue(['arxiv:2608.00001']),
      saveDiscoverSnapshot: vi.fn()
    }
    const { service } = setup({ repository })

    const result = await service.search({
      intent: 'edge AI pruning',
      runner: 'codex',
      sources: ['arxiv']
    })

    expect(repository.findSavedItemIds).toHaveBeenCalledWith(['arxiv:2608.00001'])
    expect(result.items[0]?.saved).toBe(true)
  })

  it('executes configured sources with the transient semantic profile and HF token', async () => {
    const configuredPaper = item({
      id: 'folo:302:paper:edge-pruning',
      source: 'folo:302',
      externalId: 'edge-pruning',
      title: 'Structured pruning for edge systems',
      url: 'https://example.org/edge-pruning',
      categories: []
    })
    const configuredModel = item({
      id: 'folo:64:model:org/model',
      source: 'folo:64',
      kind: 'model',
      externalId: 'org/model',
      title: 'Edge model compression',
      url: 'https://huggingface.co/org/model',
      categories: [],
      metrics: { downloads: 100 }
    })
    const fetchConfiguredSource = vi
      .fn()
      .mockImplementation(async (definition: { id: string }) => ({
        items: definition.id === 'folo:302' ? [configuredPaper] : [configuredModel],
        rejectedCount: 0
      }))
    const { service } = setup({
      configuredDefinitions: [
        getConfiguredSourceDefinition('folo:302'),
        getConfiguredSourceDefinition('folo:64')
      ],
      fetchConfiguredSource
    })
    const now = new Date('2026-08-16T10:00:00.000Z')

    const result = await service.search(
      {
        intent: 'edge model compression',
        runner: 'codex',
        sources: ['folo:302', 'folo:64']
      },
      { now, huggingFaceToken: '  hf-placeholder  ' }
    )

    expect(fetchConfiguredSource).toHaveBeenNthCalledWith(
      1,
      getConfiguredSourceDefinition('folo:302'),
      {
        name: `Discover: ${plan.intentSummary}`,
        arxiv: plan.arxiv,
        github: plan.github
      },
      { now }
    )
    expect(fetchConfiguredSource).toHaveBeenNthCalledWith(
      2,
      getConfiguredSourceDefinition('folo:64'),
      {
        name: `Discover: ${plan.intentSummary}`,
        arxiv: plan.arxiv,
        github: plan.github
      },
      { now, huggingFaceToken: 'hf-placeholder' }
    )
    expect(result.sourceOutcomes).toMatchObject({
      arxiv: { status: 'not_searched' },
      github: { status: 'not_searched' },
      'folo:302': { status: 'healthy', resultCount: 1 },
      'folo:64': { status: 'healthy', resultCount: 1 }
    })
    expect(result.counts).toMatchObject({
      total: 2,
      arxiv: 0,
      github: 0,
      byKind: { paper: 1, model: 1 },
      bySource: { 'folo:302': 1, 'folo:64': 1 }
    })
  })

  it('keeps only configured-source records with a semantic match reason', async () => {
    const semanticMatch = item({
      id: 'folo:302:article:semantic',
      source: 'folo:302',
      kind: 'article',
      externalId: 'semantic',
      title: 'Structured pruning reaches edge systems',
      url: 'https://example.org/semantic',
      categories: []
    })
    const recencyOnly = item({
      id: 'folo:302:article:popular',
      source: 'folo:302',
      kind: 'article',
      externalId: 'popular',
      title: 'Popular general technology news',
      summary: 'A broad industry update.',
      url: 'https://example.org/popular',
      categories: [],
      stars: 50_000
    })
    const { service } = setup({
      configuredDefinitions: [getConfiguredSourceDefinition('folo:302')],
      fetchConfiguredSource: vi.fn().mockResolvedValue({
        items: [semanticMatch, recencyOnly],
        rejectedCount: 0
      })
    })

    const result = await service.search(
      { intent: 'edge pruning', runner: 'claude', sources: ['folo:302'] },
      { now: new Date('2026-08-16T10:00:00.000Z') }
    )

    expect(result.items.map((candidate) => candidate.id)).toEqual([semanticMatch.id])
    expect(result.items[0]?.reasons).toContain('Title matches “structured pruning”')
    expect(result.sourceOutcomes['folo:302']).toMatchObject({
      status: 'healthy',
      resultCount: 1
    })
  })

  it('does not treat short keyword substrings as browse-source semantic evidence', async () => {
    const aiPlan: DiscoverPlan = {
      ...plan,
      arxiv: { categories: [], keywords: ['ai'], excludeKeywords: [] },
      github: { keywords: [], topics: [], languages: [] }
    }
    const planner = { plan: vi.fn().mockResolvedValue({ plan: aiPlan, provenance }) }
    const substringOnly = item({
      id: 'folo:302:article:chair',
      source: 'folo:302',
      kind: 'article',
      externalId: 'chair',
      title: 'The chair said markets would recover',
      summary: 'A general finance update.',
      url: 'https://example.org/chair',
      categories: []
    })
    const { service } = setup({
      planner,
      configuredDefinitions: [getConfiguredSourceDefinition('folo:302')],
      fetchConfiguredSource: vi.fn().mockResolvedValue({
        items: [substringOnly],
        rejectedCount: 0
      })
    })

    const result = await service.search({
      intent: 'AI systems',
      runner: 'codex',
      sources: ['folo:302']
    })

    expect(result.items).toEqual([])
    expect(result.sourceOutcomes['folo:302']?.status).toBe('no_results')
  })

  it('preserves substring matching for CJK semantic phrases', async () => {
    const cjkPlan: DiscoverPlan = {
      ...plan,
      arxiv: { categories: [], keywords: ['结构化剪枝'], excludeKeywords: [] },
      github: { keywords: [], topics: [], languages: [] }
    }
    const planner = { plan: vi.fn().mockResolvedValue({ plan: cjkPlan, provenance }) }
    const cjkMatch = item({
      id: 'folo:302:article:cjk',
      source: 'folo:302',
      kind: 'article',
      externalId: 'cjk',
      title: '面向边缘部署的结构化剪枝方法',
      summary: '一种资源感知的神经网络压缩技术。',
      url: 'https://example.org/cjk',
      categories: []
    })
    const { service } = setup({
      planner,
      configuredDefinitions: [getConfiguredSourceDefinition('folo:302')],
      fetchConfiguredSource: vi.fn().mockResolvedValue({
        items: [cjkMatch],
        rejectedCount: 0
      })
    })

    const result = await service.search({
      intent: '结构化剪枝',
      runner: 'codex',
      sources: ['folo:302']
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.id).toBe(cjkMatch.id)
  })

  it('deduplicates equivalent URLs across sources before reporting counts', async () => {
    const duplicate = item({
      id: 'folo:302:paper:duplicate',
      source: 'folo:302',
      externalId: 'duplicate',
      url: 'https://arxiv.org/abs/2608.00001?utm_source=feed',
      categories: []
    })
    const { service } = setup({
      configuredDefinitions: [getConfiguredSourceDefinition('folo:302')],
      fetchConfiguredSource: vi.fn().mockResolvedValue({ items: [duplicate], rejectedCount: 0 })
    })

    const result = await service.search({
      intent: 'structured pruning',
      runner: 'codex',
      sources: ['arxiv', 'folo:302']
    })

    expect(result.items).toHaveLength(1)
    expect(result.counts.total).toBe(1)
    expect(Object.values(result.counts.bySource).reduce((sum, count) => sum + count, 0)).toBe(1)
    expect(
      ['arxiv', 'folo:302'].reduce(
        (sum, source) =>
          sum + (result.sourceOutcomes[source as 'arxiv' | 'folo:302']?.resultCount ?? 0),
        0
      )
    ).toBe(1)
  })

  it('prefers an already-saved candidate when deduplicating equivalent records', async () => {
    const repository = {
      findSavedItemIds: vi.fn().mockReturnValue(['arxiv:2608.00001']),
      saveDiscoverSnapshot: vi.fn()
    }
    const higherScoredDuplicate = item({
      id: 'folo:302:paper:saved-duplicate',
      source: 'folo:302',
      externalId: 'saved-duplicate',
      url: 'https://arxiv.org/abs/2608.00001?utm_source=feed',
      categories: [],
      topics: ['semantic-communication'],
      language: 'Python'
    })
    const { service } = setup({
      repository,
      configuredDefinitions: [getConfiguredSourceDefinition('folo:302')],
      fetchConfiguredSource: vi.fn().mockResolvedValue({
        items: [higherScoredDuplicate],
        rejectedCount: 0
      })
    })

    const result = await service.search({
      intent: 'structured pruning',
      runner: 'codex',
      sources: ['arxiv', 'folo:302']
    })

    expect(repository.findSavedItemIds).toHaveBeenCalledWith([
      'arxiv:2608.00001',
      higherScoredDuplicate.id
    ])
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({ id: 'arxiv:2608.00001', saved: true })
  })

  it('chunks Saved lookups before applying the 100-result session cap', async () => {
    const candidates = Array.from({ length: 101 }, (_, index) =>
      item({
        id: `folo:302:article:${index}`,
        source: 'folo:302',
        kind: 'article',
        externalId: String(index),
        title: `Structured pruning signal ${index}`,
        url: `https://example.org/signals/${index}`,
        categories: []
      })
    )
    const findSavedItemIds = vi.fn((itemIds: readonly string[]) => {
      if (itemIds.length > 100) throw new Error('Saved lookup accepts at most 100 item IDs')
      return []
    })
    const repository = { findSavedItemIds, saveDiscoverSnapshot: vi.fn() }
    const { service } = setup({
      repository,
      configuredDefinitions: [getConfiguredSourceDefinition('folo:302')],
      fetchConfiguredSource: vi.fn().mockResolvedValue({
        items: candidates,
        rejectedCount: 0
      })
    })

    const result = await service.search({
      intent: 'structured pruning',
      runner: 'codex',
      sources: ['folo:302']
    })

    expect(findSavedItemIds).toHaveBeenCalledTimes(2)
    expect(findSavedItemIds.mock.calls.every(([itemIds]) => itemIds.length <= 100)).toBe(true)
    expect(result.items).toHaveLength(100)
  })

  it('bounds configured-source concurrency', async () => {
    const sourceIds = ['folo:302', 'folo:611', 'folo:444', 'folo:182', 'folo:77'] as const
    const definitions = sourceIds.map(getConfiguredSourceDefinition)
    let active = 0
    let maximumActive = 0
    const fetchConfiguredSource = vi.fn().mockImplementation(async () => {
      active += 1
      maximumActive = Math.max(maximumActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      return { items: [], rejectedCount: 0 }
    })
    const { service } = setup({
      configuredDefinitions: definitions,
      fetchConfiguredSource,
      concurrency: 2
    })

    await service.search({
      intent: 'edge pruning',
      runner: 'codex',
      sources: [...sourceIds]
    })

    expect(fetchConfiguredSource).toHaveBeenCalledTimes(definitions.length)
    expect(maximumActive).toBe(2)
  })

  it('executes every selected active source through its owned adapter', async () => {
    const { service, fetchArxiv, fetchGitHub, fetchConfiguredSource } = setup({
      configuredDefinitions: CONFIGURED_SOURCE_DEFINITIONS,
      concurrency: 8
    })

    const result = await service.search({
      intent: 'edge model compression',
      runner: 'model-provider',
      sources: [...DISCOVER_SOURCE_IDS]
    })

    expect(fetchArxiv).toHaveBeenCalledOnce()
    expect(fetchGitHub).toHaveBeenCalledOnce()
    expect(fetchConfiguredSource).toHaveBeenCalledTimes(CONFIGURED_SOURCE_DEFINITIONS.length)
    expect(
      DISCOVER_SOURCE_IDS.every(
        (source) => result.sourceOutcomes[source]?.status !== 'not_searched'
      )
    ).toBe(true)
  })

  it('preserves partial normalization evidence from a configured source', async () => {
    const partialItem = item({
      id: 'folo:302:article:partial',
      source: 'folo:302',
      kind: 'article',
      externalId: 'partial',
      title: 'Structured pruning for edge deployment',
      url: 'https://example.org/partial',
      categories: []
    })
    const { service } = setup({
      configuredDefinitions: [getConfiguredSourceDefinition('folo:302')],
      fetchConfiguredSource: vi.fn().mockResolvedValue({
        items: [partialItem],
        rejectedCount: 2
      })
    })

    const result = await service.search({
      intent: 'edge pruning',
      runner: 'codex',
      sources: ['folo:302']
    })

    expect(result.status).toBe('partial')
    expect(result.sourceOutcomes['folo:302']).toEqual({
      status: 'partial',
      resultCount: 1,
      error: '2 invalid entries were ignored'
    })
    expect(result.items).toHaveLength(1)
  })

  it('reports an all-invalid configured payload as failed', async () => {
    const { service } = setup({
      configuredDefinitions: [getConfiguredSourceDefinition('folo:302')],
      fetchConfiguredSource: vi.fn().mockResolvedValue({ items: [], rejectedCount: 20 })
    })

    const result = await service.search({
      intent: 'edge pruning',
      runner: 'codex',
      sources: ['folo:302']
    })

    expect(result.status).toBe('failed')
    expect(result.sourceOutcomes['folo:302']).toEqual({
      status: 'failed',
      resultCount: 0,
      error: '20 invalid entries were ignored'
    })
  })

  it('rejects unsafe concurrency bounds at construction', () => {
    expect(() => setup({ concurrency: 0 })).toThrow(
      'Discover source concurrency must be between 1 and 8'
    )
    expect(() => setup({ concurrency: 9 })).toThrow(
      'Discover source concurrency must be between 1 and 8'
    )
  })
})

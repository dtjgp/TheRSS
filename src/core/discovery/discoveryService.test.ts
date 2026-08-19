import Database from 'better-sqlite3'
import { describe, expect, it, vi } from 'vitest'
import type { InterestProfile } from '../interests/interestProfile'
import type { DiscoveryItem } from '../../shared/discovery'
import { ResearchRepository } from '../storage/researchRepository'
import { DiscoveryService } from './discoveryService'
import { getConfiguredSourceDefinition } from '../sources/catalog/configuredSources'
import { rankDiscoveryItem } from '../ranking/rankDiscoveryItem'

const githubPlaceholderCredential = ['github', 'example'].join('-')

const profile: InterestProfile = {
  name: 'Edge intelligence',
  arxiv: {
    categories: ['cs.LG'],
    keywords: ['structured pruning'],
    excludeKeywords: []
  },
  github: {
    keywords: ['model compression'],
    topics: [],
    languages: ['Python']
  }
}

const paper: DiscoveryItem = {
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
  metrics: {}
}

function setup() {
  const repository = new ResearchRepository(new Database(':memory:'))
  repository.saveInterestProfile(profile, '2026-08-15T08:00:00.000Z')
  return repository
}

describe('DiscoveryService', () => {
  it('refreshes independent sources, ranks results and persists the dashboard', async () => {
    const repository = setup()
    const fetchArxiv = vi.fn().mockResolvedValue([paper])
    const fetchGitHub = vi.fn().mockResolvedValue([])
    const service = new DiscoveryService(repository, {
      fetchArxiv,
      fetchGitHub,
      configuredDefinitions: []
    })

    const dashboard = await service.refresh({
      now: new Date('2026-08-15T10:00:00.000Z')
    })

    expect(fetchArxiv).toHaveBeenCalledWith(profile.arxiv)
    expect(fetchGitHub).toHaveBeenCalledWith(profile.github, {
      now: new Date('2026-08-15T10:00:00.000Z'),
      token: undefined
    })
    expect(dashboard.items[0]).toMatchObject({
      id: paper.id,
      score: 62,
      reasons: ['Title matches “structured pruning”', 'arXiv category cs.LG', 'Published 1 day ago']
    })
    expect(dashboard.sourceHealth).toMatchObject({ arxiv: 'healthy', github: 'no_results' })
    repository.close()
  })

  it('keeps successful source results when the other source fails', async () => {
    const repository = setup()
    const service = new DiscoveryService(repository, {
      fetchArxiv: vi.fn().mockResolvedValue([paper]),
      fetchGitHub: vi.fn().mockRejectedValue(new Error('rate limited')),
      configuredDefinitions: []
    })

    const dashboard = await service.refresh({
      now: new Date('2026-08-15T10:00:00.000Z')
    })

    expect(dashboard.items).toHaveLength(1)
    expect(dashboard.sourceHealth).toMatchObject({ arxiv: 'healthy', github: 'failed' })
    repository.close()
  })

  it('requires an interest profile before any network request', async () => {
    const repository = new ResearchRepository(new Database(':memory:'))
    const fetchArxiv = vi.fn()
    const fetchGitHub = vi.fn()
    const service = new DiscoveryService(repository, {
      fetchArxiv,
      fetchGitHub,
      configuredDefinitions: []
    })

    await expect(service.refresh()).rejects.toThrow('Configure your research interests first')
    expect(fetchArxiv).not.toHaveBeenCalled()
    expect(fetchGitHub).not.toHaveBeenCalled()
    repository.close()
  })

  it('refreshes a configured adapter, records partial parsing and persists its typed item', async () => {
    const repository = setup()
    const fetchConfiguredSource = vi.fn().mockResolvedValue({
      items: [
        {
          ...paper,
          id: 'folo:64:model:org/model',
          source: 'folo:64',
          kind: 'model',
          externalId: 'org/model',
          title: 'Structured pruning model',
          url: 'https://huggingface.co/org/model',
          categories: [],
          topics: ['model-compression'],
          metrics: { downloads: 20 }
        }
      ],
      rejectedCount: 1
    })
    const service = new DiscoveryService(repository, {
      fetchArxiv: vi.fn().mockResolvedValue([]),
      fetchGitHub: vi.fn().mockResolvedValue([]),
      configuredDefinitions: [getConfiguredSourceDefinition('folo:64')],
      fetchConfiguredSource
    })

    const dashboard = await service.refresh({
      now: new Date('2026-08-15T10:00:00.000Z'),
      huggingFaceToken: 'hf_example'
    })

    expect(fetchConfiguredSource).toHaveBeenCalledWith(
      getConfiguredSourceDefinition('folo:64'),
      profile,
      { now: new Date('2026-08-15T10:00:00.000Z'), huggingFaceToken: 'hf_example' }
    )
    expect(dashboard.items).toContainEqual(
      expect.objectContaining({ source: 'folo:64', kind: 'model' })
    )
    expect(dashboard.sourceHealth['folo:64']).toBe('partial')
    repository.close()
  })

  it('deduplicates a configured copy against the higher-scoring canonical paper', async () => {
    const repository = setup()
    const duplicate = {
      ...paper,
      id: 'folo:302:article:duplicate',
      source: 'folo:302' as const,
      kind: 'article' as const,
      externalId: 'duplicate',
      url: `${paper.url}?utm_source=feed`,
      categories: []
    }
    const service = new DiscoveryService(repository, {
      fetchArxiv: vi.fn().mockResolvedValue([paper]),
      fetchGitHub: vi.fn().mockResolvedValue([]),
      configuredDefinitions: [getConfiguredSourceDefinition('folo:302')],
      fetchConfiguredSource: vi.fn().mockResolvedValue({ items: [duplicate], rejectedCount: 0 })
    })

    const dashboard = await service.refresh({ now: new Date('2026-08-15T10:00:00.000Z') })

    expect(dashboard.items.map((item) => item.id)).toEqual([paper.id])
    expect(dashboard.sourceHealth['folo:302']).toBe('healthy')
    repository.close()
  })

  it('preserves the last verified configured edition when its next refresh fails', async () => {
    const repository = setup()
    const prior = {
      ...paper,
      id: 'folo:64:model:prior',
      source: 'folo:64' as const,
      kind: 'model' as const,
      externalId: 'prior',
      title: 'Prior verified model',
      url: 'https://huggingface.co/org/prior'
    }
    repository.upsertRankedItems([rankDiscoveryItem(prior, profile, new Date('2026-08-14'))])
    const service = new DiscoveryService(repository, {
      fetchArxiv: vi.fn().mockResolvedValue([]),
      fetchGitHub: vi.fn().mockResolvedValue([]),
      configuredDefinitions: [getConfiguredSourceDefinition('folo:64')],
      fetchConfiguredSource: vi.fn().mockRejectedValue(new Error('offline'))
    })

    const dashboard = await service.refresh({ now: new Date('2026-08-15T10:00:00.000Z') })

    expect(dashboard.items).toContainEqual(expect.objectContaining({ id: prior.id }))
    expect(dashboard.sourceHealth['folo:64']).toBe('failed')
    repository.close()
  })

  it('refreshes one source history without changing Today membership or analytics', async () => {
    const repository = setup()
    const configuredArticle: DiscoveryItem = {
      ...paper,
      id: 'folo:302:article:recent',
      source: 'folo:302',
      kind: 'article',
      externalId: 'recent',
      title: 'Recent BAAI source signal',
      url: 'https://www.baai.ac.cn/news/recent',
      publishedAt: '2026-08-10T08:00:00.000Z',
      updatedAt: '2026-08-18T08:00:00.000Z'
    }
    const fetchConfiguredSource = vi.fn().mockResolvedValue({
      items: [configuredArticle],
      rejectedCount: 0
    })
    const service = new DiscoveryService(repository, {
      configuredDefinitions: [getConfiguredSourceDefinition('folo:302')],
      fetchConfiguredSource
    })

    const snapshot = await service.refreshSourceContent('folo:302', {
      now: new Date('2026-08-19T12:00:00.000Z')
    })

    expect(fetchConfiguredSource).toHaveBeenCalledWith(
      getConfiguredSourceDefinition('folo:302'),
      profile,
      { now: new Date('2026-08-19T12:00:00.000Z') }
    )
    expect(snapshot).toMatchObject({
      source: 'folo:302',
      status: 'fetched',
      returnedCount: 1,
      rejectedCount: 0,
      items: [{ id: configuredArticle.id }]
    })
    expect(repository.listDashboardItems()).toEqual([])
    expect(repository.getAnalyticsSnapshot().totals.todayResults).toBe(0)
    repository.close()
  })

  it('refreshes arXiv source history without interests while GitHub keeps its interest query', async () => {
    const repository = setup()
    const repositoryItem: DiscoveryItem = {
      ...paper,
      id: 'github:owner/recent',
      source: 'github',
      kind: 'repository',
      externalId: 'owner/recent',
      title: 'owner/recent',
      url: 'https://github.com/owner/recent',
      language: 'Python',
      stars: 20
    }
    const fetchArxivRecent = vi.fn().mockResolvedValue([paper])
    const fetchGitHub = vi.fn().mockResolvedValue([repositoryItem])
    const service = new DiscoveryService(repository, {
      fetchArxivRecent,
      fetchGitHub,
      configuredDefinitions: []
    })
    const now = new Date('2026-08-19T12:00:00.000Z')

    const arxiv = await service.refreshSourceContent('arxiv', { now })
    const github = await service.refreshSourceContent('github', {
      now,
      githubToken: githubPlaceholderCredential
    })

    expect(fetchArxivRecent).toHaveBeenCalledWith({ now })
    expect(fetchGitHub).toHaveBeenCalledWith(profile.github, {
      now,
      token: githubPlaceholderCredential
    })
    expect(arxiv.status).toBe('fetched')
    expect(github.status).toBe('fetched')
    expect(repository.listDashboardItems()).toEqual([])
    repository.close()
  })

  it('can browse a configured public source without a profile and reports an empty result honestly', async () => {
    const repository = new ResearchRepository(new Database(':memory:'))
    const fetchConfiguredSource = vi.fn().mockResolvedValue({ items: [], rejectedCount: 0 })
    const service = new DiscoveryService(repository, {
      configuredDefinitions: [getConfiguredSourceDefinition('folo:302')],
      fetchConfiguredSource
    })
    const now = new Date('2026-08-19T12:00:00.000Z')

    const snapshot = await service.refreshSourceContent('folo:302', { now })

    expect(fetchConfiguredSource).toHaveBeenCalledWith(
      getConfiguredSourceDefinition('folo:302'),
      {
        name: 'Source browsing',
        arxiv: { categories: [], keywords: [], excludeKeywords: [] },
        github: { keywords: [], topics: [], languages: [] }
      },
      { now }
    )
    expect(snapshot).toMatchObject({ status: 'no_results', returnedCount: 0, rejectedCount: 0 })
    repository.close()
  })

  it('reports partial source-only normalization and forwards an optional Hugging Face token', async () => {
    const repository = setup()
    const fetchConfiguredSource = vi.fn().mockResolvedValue({
      items: [
        {
          ...paper,
          id: 'folo:64:model:recent',
          source: 'folo:64',
          kind: 'model',
          externalId: 'recent',
          url: 'https://huggingface.co/org/recent'
        }
      ],
      rejectedCount: 2
    })
    const service = new DiscoveryService(repository, {
      configuredDefinitions: [getConfiguredSourceDefinition('folo:64')],
      fetchConfiguredSource
    })
    const now = new Date('2026-08-19T12:00:00.000Z')

    const snapshot = await service.refreshSourceContent('folo:64', {
      now,
      huggingFaceToken: 'hf_example'
    })

    expect(fetchConfiguredSource).toHaveBeenCalledWith(
      getConfiguredSourceDefinition('folo:64'),
      profile,
      { now, huggingFaceToken: 'hf_example' }
    )
    expect(snapshot).toMatchObject({ status: 'partial', returnedCount: 1, rejectedCount: 2 })
    repository.close()
  })

  it('lets arXiv Sources browse without interests but still guards GitHub and X queries', async () => {
    const repository = new ResearchRepository(new Database(':memory:'))
    const fetchArxivRecent = vi.fn().mockResolvedValue([])
    const service = new DiscoveryService(repository, {
      configuredDefinitions: [],
      fetchArxivRecent
    })

    await expect(service.refreshSourceContent('arxiv')).resolves.toMatchObject({
      status: 'no_results',
      returnedCount: 0
    })
    expect(fetchArxivRecent).toHaveBeenCalledOnce()
    await expect(service.refreshSourceContent('github')).rejects.toThrow(
      'Configure GitHub interests'
    )
    await expect(service.refreshSourceContent('folo:2')).rejects.toThrow(
      'Configure research interests'
    )
    await expect(service.refreshSourceContent('folo:64')).rejects.toThrow(
      'has no configured retrieval adapter'
    )
    await expect(
      service.refreshSourceContent('folo:999999' as DiscoveryItem['source'])
    ).rejects.toThrow('Unsupported discovery source')
    repository.close()
  })
})

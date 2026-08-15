import Database from 'better-sqlite3'
import { describe, expect, it, vi } from 'vitest'
import type { InterestProfile } from '../interests/interestProfile'
import type { DiscoveryItem } from '../../shared/discovery'
import { ResearchRepository } from '../storage/researchRepository'
import { DiscoveryService } from './discoveryService'

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
  stars: null
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
    const service = new DiscoveryService(repository, { fetchArxiv, fetchGitHub })

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
    expect(dashboard.sourceHealth).toEqual({ arxiv: 'healthy', github: 'healthy' })
    repository.close()
  })

  it('keeps successful source results when the other source fails', async () => {
    const repository = setup()
    const service = new DiscoveryService(repository, {
      fetchArxiv: vi.fn().mockResolvedValue([paper]),
      fetchGitHub: vi.fn().mockRejectedValue(new Error('rate limited'))
    })

    const dashboard = await service.refresh({
      now: new Date('2026-08-15T10:00:00.000Z')
    })

    expect(dashboard.items).toHaveLength(1)
    expect(dashboard.sourceHealth).toEqual({ arxiv: 'healthy', github: 'failed' })
    repository.close()
  })

  it('requires an interest profile before any network request', async () => {
    const repository = new ResearchRepository(new Database(':memory:'))
    const fetchArxiv = vi.fn()
    const fetchGitHub = vi.fn()
    const service = new DiscoveryService(repository, { fetchArxiv, fetchGitHub })

    await expect(service.refresh()).rejects.toThrow('Configure your research interests first')
    expect(fetchArxiv).not.toHaveBeenCalled()
    expect(fetchGitHub).not.toHaveBeenCalled()
    repository.close()
  })
})

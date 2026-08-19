import { describe, expect, it, vi } from 'vitest'
import type { DiscoveryItem } from '../../shared/discovery'
import type { DiscoverPlan, DiscoverPlannerProvenance } from '../../shared/discover'
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
      externalId: 'owner/repo',
      title: 'owner/repo',
      url: 'https://github.com/owner/repo',
      categories: [],
      topics: ['semantic-communication'],
      language: 'Python',
      stars: 42
    })
  ])
  const repository = {
    findSavedItemIds: vi.fn().mockReturnValue([]),
    saveDiscoverSnapshot: vi.fn()
  }
  const service = new DiscoverService({
    planner,
    fetchArxiv,
    fetchGitHub,
    repository,
    createSessionId: () => 'discover-session-1',
    ...overrides
  })
  return { service, planner, fetchArxiv, fetchGitHub, repository }
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
      counts: { total: 2, arxiv: 1, github: 1 }
    })
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
})

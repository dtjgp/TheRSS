import Database from 'better-sqlite3'
import { describe, expect, it, vi } from 'vitest'
import type { RankedDiscoveryItem } from '../../shared/discovery'
import { ProviderService, type SecretCipher } from '../models/providerService'
import { ResearchRepository } from '../storage/researchRepository'
import { AnalysisService } from './analysisService'

class FakeSecretCipher implements SecretCipher {
  isAvailable(): boolean {
    return true
  }
  encrypt(value: string): Buffer {
    return Buffer.from(value)
  }
  decrypt(value: Buffer): string {
    return value.toString()
  }
}

const rankedItem: RankedDiscoveryItem = {
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
    metrics: {}
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

function setup() {
  const repository = new ResearchRepository(new Database(':memory:'))
  repository.upsertRankedItems([rankedItem], '2026-08-15T10:00:00.000Z')
  const providers = new ProviderService(repository, new FakeSecretCipher())
  providers.save({
    name: 'Local model',
    protocol: 'openai-compatible',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'research-model'
  })
  return { repository, providers }
}

describe('AnalysisService', () => {
  it('analyzes one persisted item and stores a provenance-bearing artifact', async () => {
    const { repository, providers } = setup()
    const gateway = vi.fn().mockResolvedValue({
      content: '## Research fit\nHighly relevant.',
      inputTokens: 120,
      outputTokens: 24
    })
    const service = new AnalysisService(repository, providers, gateway)

    const artifact = await service.analyzeItem('arxiv:2608.00001', {
      now: new Date('2026-08-15T12:00:00.000Z'),
      idFactory: () => 'analysis-1'
    })

    expect(artifact).toEqual({
      id: 'analysis-1',
      itemId: 'arxiv:2608.00001',
      providerId: 'default',
      providerName: 'Local model',
      model: 'research-model',
      promptVersion: 'llm-wiki-paper-l1-v1',
      sourceHash: 'edc71265ddad97262e686e86523de7ae647accbd0ca09853baa3ec2aef42bec2',
      content: '## Research fit\nHighly relevant.',
      createdAt: '2026-08-15T12:00:00.000Z'
    })
    expect(repository.getLatestAnalysis('arxiv:2608.00001')).toEqual(artifact)
    expect(gateway).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'arxiv:2608.00001' }),
      expect.objectContaining({ id: 'default', model: 'research-model' })
    )
    repository.close()
  })

  it('does not call a provider for an unknown local item', async () => {
    const { repository, providers } = setup()
    const gateway = vi.fn()
    const service = new AnalysisService(repository, providers, gateway)

    await expect(service.analyzeItem('missing')).rejects.toThrow('Unknown discovery item')
    expect(gateway).not.toHaveBeenCalled()
    repository.close()
  })

  it('routes a local Codex request without requiring the model provider gateway', async () => {
    const { repository, providers } = setup()
    const modelGateway = vi.fn()
    const localAgentGateway = vi.fn().mockResolvedValue({
      content: '## Research fit\nCodex found a strong match.',
      providerId: 'local-agent:codex',
      providerName: 'Codex CLI',
      model: 'codex-cli',
      inputTokens: null,
      outputTokens: null
    })
    const service = new AnalysisService(repository, providers, modelGateway, localAgentGateway)

    const artifact = await service.analyzeItem('arxiv:2608.00001', {
      runner: 'codex',
      now: new Date('2026-08-15T12:00:00.000Z'),
      idFactory: () => 'analysis-codex'
    })

    expect(artifact).toMatchObject({
      id: 'analysis-codex',
      providerId: 'local-agent:codex',
      providerName: 'Codex CLI',
      model: 'codex-cli',
      promptVersion: 'llm-wiki-paper-l1-v1',
      sourceHash: 'edc71265ddad97262e686e86523de7ae647accbd0ca09853baa3ec2aef42bec2'
    })
    expect(modelGateway).not.toHaveBeenCalled()
    expect(localAgentGateway).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'arxiv:2608.00001' }),
      'codex'
    )
    expect(repository.getLatestAnalysis('arxiv:2608.00001')).toEqual(artifact)
    repository.close()
  })

  it('reopens an immutable historical artifact and marks it stale after source changes', async () => {
    const { repository, providers } = setup()
    const gateway = vi
      .fn()
      .mockResolvedValueOnce({ content: 'Original analysis', inputTokens: 10, outputTokens: 5 })
      .mockResolvedValueOnce({ content: 'Updated analysis', inputTokens: 11, outputTokens: 6 })
    const service = new AnalysisService(repository, providers, gateway)
    await service.analyzeItem('arxiv:2608.00001', {
      now: new Date('2026-08-15T12:00:00.000Z'),
      idFactory: () => 'analysis-original'
    })
    repository.upsertRankedItems(
      [
        {
          ...rankedItem,
          item: { ...rankedItem.item, summary: 'A revised source abstract.' }
        }
      ],
      '2026-08-16T12:00:00.000Z'
    )
    await service.analyzeItem('arxiv:2608.00001', {
      now: new Date('2026-08-16T13:00:00.000Z'),
      idFactory: () => 'analysis-updated'
    })

    await expect(service.getAnalysisArtifact('analysis-original')).resolves.toMatchObject({
      freshness: 'stale',
      artifact: { id: 'analysis-original', content: 'Original analysis' }
    })
    await expect(service.getAnalysisArtifact('analysis-updated')).resolves.toMatchObject({
      freshness: 'current',
      artifact: { id: 'analysis-updated', content: 'Updated analysis' }
    })
    repository.close()
  })
})

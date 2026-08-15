import type { DiscoveryItem } from '../shared/discovery'
import type { ModelAnalysisResponse } from '../core/models/modelGateway'

export const e2ePaper: DiscoveryItem = {
  id: 'arxiv:2608.00001',
  source: 'arxiv',
  externalId: '2608.00001',
  title: 'Structured pruning for edge deployment',
  summary: 'A deterministic fixture for the packaged discovery workflow.',
  url: 'https://arxiv.org/abs/2608.00001',
  publishedAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
  authors: ['TheRSS Fixture'],
  categories: ['cs.LG'],
  topics: [],
  language: null,
  stars: null
}

export const e2eRepository: DiscoveryItem = {
  id: 'github:therss/fixture',
  source: 'github',
  externalId: 'TheRSS/fixture',
  title: 'TheRSS/fixture',
  summary: 'A deterministic model-compression repository fixture.',
  url: 'https://github.com/owner/repo',
  publishedAt: '2026-08-13T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
  authors: [],
  categories: [],
  topics: ['model-compression'],
  language: 'TypeScript',
  stars: 42
}

export async function e2eAnalysis(): Promise<ModelAnalysisResponse> {
  return {
    content:
      '## Research fit\nE2E fixture analysis passed.\n\n## Evidence boundary\nDiscovery metadata only.',
    inputTokens: 20,
    outputTokens: 12
  }
}

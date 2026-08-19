import type { DiscoveryItem } from '../shared/discovery'
import type { ModelAnalysisResponse } from '../core/models/modelGateway'

export const e2ePaper: DiscoveryItem = {
  id: 'arxiv:2608.00001',
  source: 'arxiv',
  kind: 'paper',
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
  stars: null,
  metrics: {}
}

export const e2eRepository: DiscoveryItem = {
  id: 'github:therss/fixture',
  source: 'github',
  kind: 'repository',
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
  stars: 42,
  metrics: {}
}

export const e2eConfiguredArticle: DiscoveryItem = {
  ...e2ePaper,
  id: 'folo:302:article:fixture',
  source: 'folo:302',
  kind: 'article',
  externalId: 'fixture',
  title: 'BAAI edge intelligence fixture',
  summary: 'A configured-source fixture for the unified daily stream.',
  url: 'https://www.baai.ac.cn/news/fixture',
  categories: [],
  topics: ['edge-ai']
}

export const e2eDiscoverPaper: DiscoveryItem = {
  ...e2ePaper,
  id: 'arxiv:2608.99999',
  externalId: '2608.99999',
  title: 'Semantic expansion search for edge intelligence',
  summary: 'A Discover-only fixture matching semantic communication and structured pruning.',
  url: 'https://arxiv.org/abs/2608.99999'
}

export const e2eDiscoverRepository: DiscoveryItem = {
  ...e2eRepository,
  id: 'github:therss/semantic-fixture',
  externalId: 'TheRSS/semantic-fixture',
  title: 'TheRSS/semantic-fixture',
  summary: 'A Discover-only repository fixture for model compression and edge inference.',
  url: 'https://github.com/TheRSS/semantic-fixture'
}

export async function e2eAnalysis(): Promise<ModelAnalysisResponse> {
  return {
    content:
      '## 快速决策卡\nResearch fit: direct · Evidence state: abstract-only / provisional\n\n## TL;DR\nE2E fixture analysis passed.\n\n## 关键主张与证据台账\n[TBD] — discovery metadata only.\n\n## 审稿人式评估\nThis fixture does not establish full-paper claims.',
    inputTokens: 20,
    outputTokens: 12
  }
}

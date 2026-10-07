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

/**
 * The Sources view keeps a rolling 30-day window from the real clock, so a fixed fixture date
 * ages out. The refreshed configured-source item is dated three days before the run instead.
 */
export function e2eRecentConfiguredArticle(now = new Date()): DiscoveryItem {
  const published = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
  return { ...e2eConfiguredArticle, publishedAt: published, updatedAt: published }
}

export const e2eDiscoverPaper: DiscoveryItem = {
  ...e2ePaper,
  id: 'arxiv:2608.99999',
  externalId: '2608.99999',
  title: 'Semantic expansion search for edge intelligence',
  summary:
    'A Discover-only fixture matching semantic communication and structured pruning. '.repeat(12) +
    'Full fixture summary ends here.',
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

export const e2eDiscoverConfiguredArticle: DiscoveryItem = {
  ...e2eConfiguredArticle,
  id: 'folo:302:article:discover-fixture',
  externalId: 'discover-fixture',
  title: 'BAAI structured pruning research fixture',
  summary:
    'A configured-source Discover fixture connecting structured pruning, semantic communication, and edge deployment.',
  url: 'https://www.baai.ac.cn/news/discover-fixture'
}

export async function waitForE2eDiscoverStage(enabled: boolean): Promise<void> {
  if (!enabled) return
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 750)
  })
}

const DAY = 24 * 60 * 60 * 1000

/**
 * Discover results dated from the run clock, so Sources (a rolling 30-day window) keeps showing
 * them. All results move together: the paper and the configured-source article share a UTC
 * midnight three days back and the repository is a day older, the same order as the fixed
 * fixture dates, so ranking and the first selected result do not change.
 */
export function e2eDiscoverResultsAt(now = new Date()) {
  const day = Math.floor((now.getTime() - 3 * DAY) / DAY) * DAY
  const at = (time: number) => new Date(time).toISOString()
  return {
    paper: { ...e2eDiscoverPaper, publishedAt: at(day), updatedAt: at(day) },
    repository: { ...e2eDiscoverRepository, publishedAt: at(day - DAY), updatedAt: at(day) },
    article: { ...e2eDiscoverConfiguredArticle, publishedAt: at(day), updatedAt: at(day) }
  }
}

export function createE2eDiscoverFetchers(delayEnabled: boolean) {
  const wait = () => waitForE2eDiscoverStage(delayEnabled)
  return {
    fetchArxiv: async () => {
      await wait()
      return [e2eDiscoverResultsAt().paper]
    },
    fetchGitHub: async () => {
      await wait()
      return [e2eDiscoverResultsAt().repository]
    },
    fetchConfiguredSource: async (definition: { readonly id: string }) => {
      await wait()
      return {
        items: definition.id === 'folo:302' ? [e2eDiscoverResultsAt().article] : [],
        rejectedCount: 0
      }
    }
  }
}

export async function e2eAnalysis(): Promise<ModelAnalysisResponse> {
  return {
    content:
      '## 快速决策卡\nResearch fit: direct · Evidence state: abstract-only / provisional\n\n## TL;DR\nE2E fixture analysis passed.\n\n## 关键主张与证据台账\n[TBD] — discovery metadata only.\n\n## 审稿人式评估\nThis fixture does not establish full-paper claims.',
    inputTokens: 20,
    outputTokens: 12
  }
}

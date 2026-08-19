import type { ArxivInterest, GitHubInterest, InterestProfile } from '../interests/interestProfile'
import type { DiscoveryItem, DiscoverySource, RankedDiscoveryItem } from '../../shared/discovery'
import type { DashboardSnapshot, SourceContentSnapshot } from '../../shared/api'
import { isDiscoverySource } from '../../shared/sourceIdentity'
import { rankDiscoveryItem } from '../ranking/rankDiscoveryItem'
import { fetchArxivItems, fetchArxivRecentItems } from '../sources/arxiv/arxivClient'
import { fetchGitHubRadarItems } from '../sources/github/githubClient'
import {
  CONFIGURED_SOURCE_DEFINITIONS,
  type ConfiguredSourceDefinition
} from '../sources/catalog/configuredSources'
import {
  fetchConfiguredSourceBatch,
  type FetchConfiguredSourceOptions
} from '../sources/catalog/configuredSourceAdapter'
import type { NormalizedSourceBatch } from '../sources/catalog/sourceNormalizer'
import type { ResearchRepository } from '../storage/researchRepository'

interface GitHubFetchOptions {
  readonly now: Date
  readonly token?: string | undefined
}

interface DiscoveryDependencies {
  readonly fetchArxiv?: (interest: ArxivInterest) => Promise<DiscoveryItem[]>
  readonly fetchArxivRecent?: (options: { readonly now: Date }) => Promise<DiscoveryItem[]>
  readonly fetchGitHub?: (
    interest: GitHubInterest,
    options: GitHubFetchOptions
  ) => Promise<DiscoveryItem[]>
  readonly fetchConfiguredSource?: (
    definition: ConfiguredSourceDefinition,
    profile: InterestProfile,
    options: FetchConfiguredSourceOptions
  ) => Promise<NormalizedSourceBatch>
  readonly configuredDefinitions?: readonly ConfiguredSourceDefinition[]
  readonly concurrency?: number
}

interface RefreshOptions {
  readonly now?: Date
  readonly githubToken?: string
  readonly huggingFaceToken?: string
}

interface RefreshJob {
  readonly source: DiscoverySource
  readonly fetch: () => Promise<NormalizedSourceBatch>
}

interface SuccessfulRefresh {
  readonly source: DiscoverySource
  readonly returnedCount: number
  readonly rejectedCount: number
  readonly ranked: readonly RankedDiscoveryItem[]
}

const SOURCE_BROWSE_PROFILE: InterestProfile = {
  name: 'Source browsing',
  arxiv: { categories: [], keywords: [], excludeKeywords: [] },
  github: { keywords: [], topics: [], languages: [] }
}

function hasArxivRules(interest: ArxivInterest): boolean {
  return interest.categories.length + interest.keywords.length > 0
}

function hasGitHubRules(interest: GitHubInterest): boolean {
  return interest.keywords.length + interest.topics.length + interest.languages.length > 0
}

function boundedErrorMessage(reason: unknown): string {
  return (reason instanceof Error ? reason.message : 'Unknown source error').slice(0, 500)
}

function configuredSourceId(definition: ConfiguredSourceDefinition): DiscoverySource {
  if (!isDiscoverySource(definition.id)) {
    throw new Error(`Configured definition ${definition.id} is not an active source`)
  }
  return definition.id
}

function canonicalUrl(value: string): string {
  const url = new URL(value)
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('utm_') || key === 'ref' || key === 'source') url.searchParams.delete(key)
  }
  url.hash = ''
  return url.toString().replace(/\/$/u, '')
}

function titleKey(value: string): string | null {
  const normalized = value
    .toLocaleLowerCase()
    .replaceAll(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
  return normalized.length >= 24 ? normalized : null
}

function deduplicateAcrossSources(
  successful: readonly SuccessfulRefresh[]
): ReadonlyMap<DiscoverySource, readonly RankedDiscoveryItem[]> {
  const winners: RankedDiscoveryItem[] = []
  for (const refresh of successful) {
    for (const ranked of refresh.ranked) {
      const title = titleKey(ranked.item.title)
      const duplicateIndex = winners.findIndex(
        (winner) =>
          canonicalUrl(winner.item.url) === canonicalUrl(ranked.item.url) ||
          (title !== null && titleKey(winner.item.title) === title)
      )
      if (duplicateIndex < 0) {
        winners.push(ranked)
      } else if (ranked.score > winners[duplicateIndex]!.score) {
        winners.splice(duplicateIndex, 1, ranked)
      }
    }
  }
  return new Map(
    successful.map(({ source }) => [
      source,
      winners.filter((ranked) => ranked.item.source === source)
    ])
  )
}

function validateConcurrency(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 8) {
    throw new Error('Source refresh concurrency must be between 1 and 8')
  }
  return value
}

export class DiscoveryService {
  readonly #repository: ResearchRepository
  readonly #fetchArxiv: NonNullable<DiscoveryDependencies['fetchArxiv']>
  readonly #fetchArxivRecent: NonNullable<DiscoveryDependencies['fetchArxivRecent']>
  readonly #fetchGitHub: NonNullable<DiscoveryDependencies['fetchGitHub']>
  readonly #fetchConfiguredSource: NonNullable<DiscoveryDependencies['fetchConfiguredSource']>
  readonly #configuredDefinitions: readonly ConfiguredSourceDefinition[]
  readonly #concurrency: number

  constructor(repository: ResearchRepository, dependencies: DiscoveryDependencies = {}) {
    this.#repository = repository
    this.#fetchArxiv = dependencies.fetchArxiv ?? ((interest) => fetchArxivItems(interest))
    this.#fetchArxivRecent =
      dependencies.fetchArxivRecent ?? ((options) => fetchArxivRecentItems(options))
    this.#fetchGitHub =
      dependencies.fetchGitHub ?? ((interest, options) => fetchGitHubRadarItems(interest, options))
    this.#fetchConfiguredSource = dependencies.fetchConfiguredSource ?? fetchConfiguredSourceBatch
    this.#configuredDefinitions =
      dependencies.configuredDefinitions ?? CONFIGURED_SOURCE_DEFINITIONS
    this.#concurrency = validateConcurrency(dependencies.concurrency ?? 4)
  }

  async refreshSourceContent(
    source: DiscoverySource,
    options: RefreshOptions = {}
  ): Promise<SourceContentSnapshot> {
    if (!isDiscoverySource(source)) throw new Error(`Unsupported discovery source: ${source}`)
    const profile = this.#repository.getInterestProfile()
    const now = options.now ?? new Date()
    let batch: NormalizedSourceBatch

    if (source === 'arxiv') {
      batch = { items: await this.#fetchArxivRecent({ now }), rejectedCount: 0 }
    } else if (source === 'github') {
      if (!profile || !hasGitHubRules(profile.github)) {
        throw new Error('Configure GitHub interests before refreshing this source')
      }
      batch = {
        items: await this.#fetchGitHub(profile.github, {
          now,
          token: options.githubToken?.trim() || undefined
        }),
        rejectedCount: 0
      }
    } else {
      const definition = this.#configuredDefinitions.find((candidate) => candidate.id === source)
      if (!definition) throw new Error(`Source ${source} has no configured retrieval adapter`)
      batch = await this.#fetchConfiguredSource(definition, profile ?? SOURCE_BROWSE_PROFILE, {
        now,
        ...(options.huggingFaceToken?.trim()
          ? { huggingFaceToken: options.huggingFaceToken.trim() }
          : {})
      })
    }

    const ranked = batch.items.map((item) => ({
      ...rankDiscoveryItem(item, profile ?? SOURCE_BROWSE_PROFILE, now),
      excluded: false
    }))
    this.#repository.upsertSourceHistoryItems(ranked, now.toISOString())
    const cached = this.#repository.getSourceContentSnapshot(source, now)
    return {
      ...cached,
      status:
        batch.rejectedCount > 0 ? 'partial' : batch.items.length > 0 ? 'fetched' : 'no_results',
      returnedCount: batch.items.length,
      rejectedCount: batch.rejectedCount
    }
  }

  async refresh(options: RefreshOptions = {}): Promise<DashboardSnapshot> {
    const profile = this.#repository.getInterestProfile()
    if (!profile) throw new Error('Configure your research interests first')

    const now = options.now ?? new Date()
    const completedAt = now.toISOString()
    const jobs: RefreshJob[] = []

    if (hasArxivRules(profile.arxiv)) {
      jobs.push({
        source: 'arxiv',
        fetch: async () => ({ items: await this.#fetchArxiv(profile.arxiv), rejectedCount: 0 })
      })
    }
    if (hasGitHubRules(profile.github)) {
      jobs.push({
        source: 'github',
        fetch: async () => ({
          items: await this.#fetchGitHub(profile.github, {
            now,
            token: options.githubToken?.trim() || undefined
          }),
          rejectedCount: 0
        })
      })
    }
    jobs.push(
      ...this.#configuredDefinitions.map((definition): RefreshJob => ({
        source: configuredSourceId(definition),
        fetch: () =>
          this.#fetchConfiguredSource(definition, profile, {
            now,
            ...(options.huggingFaceToken?.trim()
              ? { huggingFaceToken: options.huggingFaceToken.trim() }
              : {})
          })
      }))
    )

    jobs.forEach((job) => this.#repository.recordSourceRun(job.source, 'refreshing', completedAt))
    const successful: SuccessfulRefresh[] = []
    for (let offset = 0; offset < jobs.length; offset += this.#concurrency) {
      const batch = jobs.slice(offset, offset + this.#concurrency)
      const results = await Promise.allSettled(batch.map((job) => job.fetch()))
      results.forEach((result, index) => {
        const source = batch[index]!.source
        if (result.status === 'fulfilled') {
          successful.push({
            source,
            returnedCount: result.value.items.length,
            rejectedCount: result.value.rejectedCount,
            ranked: result.value.items.map((item) => rankDiscoveryItem(item, profile, now))
          })
        } else {
          this.#repository.recordSourceRun(
            source,
            'failed',
            completedAt,
            boundedErrorMessage(result.reason)
          )
        }
      })
    }

    const uniqueBySource = deduplicateAcrossSources(successful)
    for (const result of successful) {
      try {
        this.#repository.replaceDailySourceItems(
          result.source,
          uniqueBySource.get(result.source) ?? [],
          completedAt
        )
        this.#repository.recordSourceRun(
          result.source,
          result.rejectedCount > 0 ? 'partial' : 'healthy',
          completedAt,
          result.rejectedCount > 0 ? `${result.rejectedCount} invalid entries were ignored` : null,
          result.returnedCount
        )
      } catch (error) {
        this.#repository.recordSourceRun(
          result.source,
          'failed',
          completedAt,
          boundedErrorMessage(error)
        )
      }
    }

    return this.#repository.getDashboardSnapshot(now)
  }
}

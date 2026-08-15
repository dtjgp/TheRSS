import type { ArxivInterest, GitHubInterest } from '../interests/interestProfile'
import type { DiscoveryItem, RankedDiscoveryItem } from '../../shared/discovery'
import type { DashboardSnapshot } from '../../shared/api'
import { rankDiscoveryItem } from '../ranking/rankDiscoveryItem'
import { fetchArxivItems } from '../sources/arxiv/arxivClient'
import { fetchGitHubRadarItems } from '../sources/github/githubClient'
import type { ResearchRepository } from '../storage/researchRepository'

interface GitHubFetchOptions {
  readonly now: Date
  readonly token?: string | undefined
}

interface DiscoveryDependencies {
  readonly fetchArxiv?: (interest: ArxivInterest) => Promise<DiscoveryItem[]>
  readonly fetchGitHub?: (
    interest: GitHubInterest,
    options: GitHubFetchOptions
  ) => Promise<DiscoveryItem[]>
}

interface RefreshOptions {
  readonly now?: Date
  readonly githubToken?: string
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

export class DiscoveryService {
  readonly #repository: ResearchRepository
  readonly #fetchArxiv: NonNullable<DiscoveryDependencies['fetchArxiv']>
  readonly #fetchGitHub: NonNullable<DiscoveryDependencies['fetchGitHub']>

  constructor(repository: ResearchRepository, dependencies: DiscoveryDependencies = {}) {
    this.#repository = repository
    this.#fetchArxiv = dependencies.fetchArxiv ?? ((interest) => fetchArxivItems(interest))
    this.#fetchGitHub =
      dependencies.fetchGitHub ?? ((interest, options) => fetchGitHubRadarItems(interest, options))
  }

  async refresh(options: RefreshOptions = {}): Promise<DashboardSnapshot> {
    const profile = this.#repository.getInterestProfile()
    if (!profile) throw new Error('Configure your research interests first')

    const now = options.now ?? new Date()
    const completedAt = now.toISOString()
    const jobs: Array<{
      source: 'arxiv' | 'github'
      promise: Promise<DiscoveryItem[]>
    }> = []

    if (hasArxivRules(profile.arxiv)) {
      this.#repository.recordSourceRun('arxiv', 'refreshing', completedAt)
      jobs.push({ source: 'arxiv', promise: this.#fetchArxiv(profile.arxiv) })
    }
    if (hasGitHubRules(profile.github)) {
      this.#repository.recordSourceRun('github', 'refreshing', completedAt)
      jobs.push({
        source: 'github',
        promise: this.#fetchGitHub(profile.github, {
          now,
          token: options.githubToken?.trim() || undefined
        })
      })
    }

    const results = await Promise.allSettled(jobs.map((job) => job.promise))
    const rankedItems: RankedDiscoveryItem[] = []
    results.forEach((result, index) => {
      const source = jobs[index]!.source
      if (result.status === 'fulfilled') {
        rankedItems.push(...result.value.map((item) => rankDiscoveryItem(item, profile, now)))
        this.#repository.recordSourceRun(source, 'healthy', completedAt, null, result.value.length)
      } else {
        this.#repository.recordSourceRun(
          source,
          'failed',
          completedAt,
          boundedErrorMessage(result.reason)
        )
      }
    })

    this.#repository.upsertRankedItems(rankedItems, completedAt)
    return this.#repository.getDashboardSnapshot(now)
  }
}

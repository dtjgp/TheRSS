import { randomUUID } from 'node:crypto'
import type { DiscoveryItem, RankedDiscoveryItem } from '../../shared/discovery'
import {
  discoverSearchRequestSchema,
  type DiscoverPlan,
  type DiscoverSearchRequest,
  type DiscoverSnapshot,
  type DiscoverSource,
  type DiscoverSourceOutcome,
  type DiscoverStatus
} from '../../shared/discover'
import type { ArxivInterest, GitHubInterest, InterestProfile } from '../interests/interestProfile'
import { rankDiscoveryItem } from '../ranking/rankDiscoveryItem'
import { fetchArxivItems } from '../sources/arxiv/arxivClient'
import { fetchGitHubRadarItems } from '../sources/github/githubClient'
import type { DiscoverPlannerService } from './discoverPlanner'

interface GitHubFetchOptions {
  readonly now: Date
  readonly token?: string | undefined
}

interface DiscoverRepository {
  findSavedItemIds(itemIds: readonly string[]): readonly string[]
  saveDiscoverSnapshot(snapshot: DiscoverSnapshot): void
}

interface DiscoverDependencies {
  readonly planner: Pick<DiscoverPlannerService, 'plan'>
  readonly repository: DiscoverRepository
  readonly fetchArxiv?: (interest: ArxivInterest) => Promise<DiscoveryItem[]>
  readonly fetchGitHub?: (
    interest: GitHubInterest,
    options: GitHubFetchOptions
  ) => Promise<DiscoveryItem[]>
  readonly createSessionId?: () => string
}

interface DiscoverOptions {
  readonly now?: Date
  readonly githubToken?: string
}

interface SourceJob {
  readonly source: DiscoverSource
  readonly promise: Promise<DiscoveryItem[]>
}

function profileFromPlan(plan: DiscoverPlan): InterestProfile {
  return {
    name: `Discover: ${plan.intentSummary}`,
    arxiv: {
      categories: [...plan.arxiv.categories],
      keywords: [...plan.arxiv.keywords],
      excludeKeywords: [...plan.arxiv.excludeKeywords]
    },
    github: {
      keywords: [...plan.github.keywords],
      topics: [...plan.github.topics],
      languages: [...plan.github.languages]
    }
  }
}

function boundedError(reason: unknown): string {
  return (reason instanceof Error ? reason.message : 'Unknown source error').slice(0, 500)
}

function initialOutcome(): DiscoverSourceOutcome {
  return { status: 'not_searched', resultCount: 0, error: null }
}

function newestByIdentity(items: readonly DiscoveryItem[]): DiscoveryItem[] {
  const unique = new Map<string, DiscoveryItem>()
  for (const item of items) {
    const current = unique.get(item.id)
    if (!current || item.updatedAt > current.updatedAt) unique.set(item.id, item)
  }
  return [...unique.values()]
}

function overallStatus(
  requestedSources: readonly DiscoverSource[],
  outcomes: DiscoverSnapshot['sourceOutcomes'],
  resultCount: number
): DiscoverStatus {
  const statuses = requestedSources.map((source) => outcomes[source].status)
  const failedCount = statuses.filter((status) => status === 'failed').length
  if (failedCount === statuses.length) return 'failed'
  if (failedCount > 0) return 'partial'
  return resultCount === 0 ? 'no_results' : 'completed'
}

function rankedResult(ranked: RankedDiscoveryItem, saved: boolean) {
  return {
    ...ranked.item,
    score: ranked.score,
    reasons: ranked.reasons.map((reason) => reason.label),
    saved
  }
}

export class DiscoverService {
  readonly #planner: Pick<DiscoverPlannerService, 'plan'>
  readonly #repository: DiscoverRepository
  readonly #fetchArxiv: NonNullable<DiscoverDependencies['fetchArxiv']>
  readonly #fetchGitHub: NonNullable<DiscoverDependencies['fetchGitHub']>
  readonly #createSessionId: () => string

  constructor(dependencies: DiscoverDependencies) {
    this.#planner = dependencies.planner
    this.#repository = dependencies.repository
    this.#fetchArxiv = dependencies.fetchArxiv ?? ((interest) => fetchArxivItems(interest))
    this.#fetchGitHub =
      dependencies.fetchGitHub ?? ((interest, options) => fetchGitHubRadarItems(interest, options))
    this.#createSessionId = dependencies.createSessionId ?? (() => `discover:${randomUUID()}`)
  }

  async search(
    candidate: DiscoverSearchRequest,
    options: DiscoverOptions = {}
  ): Promise<DiscoverSnapshot> {
    const request = discoverSearchRequestSchema.parse(candidate)
    const now = options.now ?? new Date()
    const { plan, provenance } = await this.#planner.plan(request, now)
    const profile = profileFromPlan(plan)
    const jobs: SourceJob[] = []

    if (request.sources.includes('arxiv')) {
      jobs.push({ source: 'arxiv', promise: this.#fetchArxiv(profile.arxiv) })
    }
    if (request.sources.includes('github')) {
      jobs.push({
        source: 'github',
        promise: this.#fetchGitHub(profile.github, {
          now,
          token: options.githubToken?.trim() || undefined
        })
      })
    }

    const sourceOutcomes: Record<DiscoverSource, DiscoverSourceOutcome> = {
      arxiv: initialOutcome(),
      github: initialOutcome()
    }
    const sourceItems: DiscoveryItem[] = []
    const settled = await Promise.allSettled(jobs.map((job) => job.promise))
    settled.forEach((result, index) => {
      const source = jobs[index]!.source
      if (result.status === 'fulfilled') {
        sourceOutcomes[source] = {
          status: result.value.length === 0 ? 'no_results' : 'healthy',
          resultCount: result.value.length,
          error: null
        }
        sourceItems.push(...result.value)
      } else {
        sourceOutcomes[source] = {
          status: 'failed',
          resultCount: 0,
          error: boundedError(result.reason)
        }
      }
    })

    const rankedItems = newestByIdentity(sourceItems)
      .map((item) => rankDiscoveryItem(item, profile, now))
      .filter((ranked) => !ranked.excluded)
      .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id))
      .slice(0, 100)
    const savedItemIds = new Set(
      this.#repository.findSavedItemIds(rankedItems.map((ranked) => ranked.item.id))
    )
    const items = rankedItems.map((ranked) =>
      rankedResult(ranked, savedItemIds.has(ranked.item.id))
    )
    const snapshot: DiscoverSnapshot = {
      id: this.#createSessionId(),
      intent: request.intent,
      runner: request.runner,
      status: overallStatus(request.sources, sourceOutcomes, items.length),
      createdAt: now.toISOString(),
      plan,
      provenance,
      sourceOutcomes,
      counts: {
        total: items.length,
        arxiv: items.filter((item) => item.source === 'arxiv').length,
        github: items.filter((item) => item.source === 'github').length
      },
      items
    }
    this.#repository.saveDiscoverSnapshot(snapshot)
    return snapshot
  }
}

import { randomUUID } from 'node:crypto'
import type { DiscoveryItem, DiscoveryItemKind, RankedDiscoveryItem } from '../../shared/discovery'
import {
  DISCOVER_SOURCE_IDS,
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
import {
  fetchConfiguredSourceBatch,
  type FetchConfiguredSourceOptions
} from '../sources/catalog/configuredSourceAdapter'
import {
  CONFIGURED_SOURCE_DEFINITIONS,
  type ConfiguredSourceDefinition
} from '../sources/catalog/configuredSources'
import type { NormalizedSourceBatch } from '../sources/catalog/sourceNormalizer'
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
  readonly fetchConfiguredSource?: (
    definition: ConfiguredSourceDefinition,
    profile: InterestProfile,
    options: FetchConfiguredSourceOptions
  ) => Promise<NormalizedSourceBatch>
  readonly configuredDefinitions?: readonly ConfiguredSourceDefinition[]
  readonly concurrency?: number
  readonly createSessionId?: () => string
}

interface DiscoverOptions {
  readonly now?: Date
  readonly githubToken?: string
  readonly huggingFaceToken?: string
}

interface SourceJob {
  readonly source: DiscoverSource
  readonly browseOnly: boolean
  readonly fetch: () => Promise<NormalizedSourceBatch>
}

const SAVED_LOOKUP_BATCH_SIZE = 100
const CJK_SCRIPT_PATTERN =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u

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

function isPreferredDuplicate(
  candidate: RankedDiscoveryItem,
  current: RankedDiscoveryItem
): boolean {
  if (candidate.score !== current.score) return candidate.score > current.score
  if (candidate.item.updatedAt !== current.item.updatedAt) {
    return candidate.item.updatedAt > current.item.updatedAt
  }
  const candidateSourceIndex = DISCOVER_SOURCE_IDS.indexOf(candidate.item.source)
  const currentSourceIndex = DISCOVER_SOURCE_IDS.indexOf(current.item.source)
  if (candidateSourceIndex !== currentSourceIndex) return candidateSourceIndex < currentSourceIndex
  return candidate.item.id.localeCompare(current.item.id) < 0
}

function deduplicateRanked(
  items: readonly RankedDiscoveryItem[],
  savedItemIds: ReadonlySet<string>
): RankedDiscoveryItem[] {
  const winners: RankedDiscoveryItem[] = []
  for (const candidate of items) {
    const candidateTitle = titleKey(candidate.item.title)
    const duplicateIndex = winners.findIndex((current) => {
      const sameIdentity = current.item.id === candidate.item.id
      const sameUrl = canonicalUrl(current.item.url) === canonicalUrl(candidate.item.url)
      const sameTitle = candidateTitle !== null && candidateTitle === titleKey(current.item.title)
      return sameIdentity || sameUrl || sameTitle
    })
    if (duplicateIndex < 0) {
      winners.push(candidate)
    } else {
      const current = winners[duplicateIndex]!
      const candidateSaved = savedItemIds.has(candidate.item.id)
      const currentSaved = savedItemIds.has(current.item.id)
      if (
        (candidateSaved && !currentSaved) ||
        (candidateSaved === currentSaved && isPreferredDuplicate(candidate, current))
      ) {
        winners.splice(duplicateIndex, 1, candidate)
      }
    }
  }
  return winners
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function includesWholeTerm(value: string, term: string): boolean {
  const trimmed = term.trim()
  if (!trimmed) return false
  if (CJK_SCRIPT_PATTERN.test(trimmed)) {
    return value.toLocaleLowerCase().includes(trimmed.toLocaleLowerCase())
  }
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(trimmed)}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(
    value
  )
}

function hasSemanticMatch(ranked: RankedDiscoveryItem): boolean {
  return ranked.reasons.some((reason) => {
    if (reason.kind === 'keyword') {
      return includesWholeTerm(`${ranked.item.title}\n${ranked.item.summary}`, reason.value)
    }
    return reason.kind === 'category' || reason.kind === 'topic' || reason.kind === 'language'
  })
}

function validateConcurrency(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 8) {
    throw new Error('Discover source concurrency must be between 1 and 8')
  }
  return value
}

function outcomeRecord(): Record<DiscoverSource, DiscoverSourceOutcome> {
  return Object.fromEntries(
    DISCOVER_SOURCE_IDS.map((source) => [source, initialOutcome()])
  ) as Record<DiscoverSource, DiscoverSourceOutcome>
}

function sourceCountRecord(): Record<DiscoverSource, number> {
  return Object.fromEntries(DISCOVER_SOURCE_IDS.map((source) => [source, 0])) as Record<
    DiscoverSource,
    number
  >
}

function kindCountRecord(): Record<DiscoveryItemKind, number> {
  return {
    paper: 0,
    repository: 0,
    article: 0,
    model: 0,
    dataset: 0,
    post: 0
  }
}

function findSavedCandidateIds(
  repository: DiscoverRepository,
  itemIds: readonly string[]
): ReadonlySet<string> {
  const uniqueIds = [...new Set(itemIds)]
  const savedIds = new Set<string>()
  for (let offset = 0; offset < uniqueIds.length; offset += SAVED_LOOKUP_BATCH_SIZE) {
    repository
      .findSavedItemIds(uniqueIds.slice(offset, offset + SAVED_LOOKUP_BATCH_SIZE))
      .forEach((itemId) => savedIds.add(itemId))
  }
  return savedIds
}

function overallStatus(
  requestedSources: readonly DiscoverSource[],
  outcomes: DiscoverSnapshot['sourceOutcomes'],
  resultCount: number
): DiscoverStatus {
  const statuses = requestedSources.map(
    (source) => outcomes[source]?.status ?? ('not_searched' as const)
  )
  const failedCount = statuses.filter((status) => status === 'failed').length
  if (failedCount === statuses.length) return 'failed'
  if (failedCount > 0 || statuses.includes('partial')) return 'partial'
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
  readonly #fetchConfiguredSource: NonNullable<DiscoverDependencies['fetchConfiguredSource']>
  readonly #configuredDefinitions: readonly ConfiguredSourceDefinition[]
  readonly #concurrency: number
  readonly #createSessionId: () => string

  constructor(dependencies: DiscoverDependencies) {
    this.#planner = dependencies.planner
    this.#repository = dependencies.repository
    this.#fetchArxiv = dependencies.fetchArxiv ?? ((interest) => fetchArxivItems(interest))
    this.#fetchGitHub =
      dependencies.fetchGitHub ?? ((interest, options) => fetchGitHubRadarItems(interest, options))
    this.#fetchConfiguredSource = dependencies.fetchConfiguredSource ?? fetchConfiguredSourceBatch
    this.#configuredDefinitions =
      dependencies.configuredDefinitions ?? CONFIGURED_SOURCE_DEFINITIONS
    this.#concurrency = validateConcurrency(dependencies.concurrency ?? 4)
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
      jobs.push({
        source: 'arxiv',
        browseOnly: false,
        fetch: async () => ({ items: await this.#fetchArxiv(profile.arxiv), rejectedCount: 0 })
      })
    }
    if (request.sources.includes('github')) {
      jobs.push({
        source: 'github',
        browseOnly: false,
        fetch: async () => ({
          items: await this.#fetchGitHub(profile.github, {
            now,
            token: options.githubToken?.trim() || undefined
          }),
          rejectedCount: 0
        })
      })
    }
    for (const source of request.sources) {
      if (source === 'arxiv' || source === 'github') continue
      const definition = this.#configuredDefinitions.find((candidate) => candidate.id === source)
      jobs.push({
        source,
        browseOnly: true,
        fetch: async () => {
          if (!definition) throw new Error(`Source ${source} has no configured retrieval adapter`)
          return this.#fetchConfiguredSource(definition, profile, {
            now,
            ...(definition.transport === 'huggingface' && options.huggingFaceToken?.trim()
              ? { huggingFaceToken: options.huggingFaceToken.trim() }
              : {})
          })
        }
      })
    }

    const sourceOutcomes = outcomeRecord()
    const rankedSourceItems: RankedDiscoveryItem[] = []
    for (let offset = 0; offset < jobs.length; offset += this.#concurrency) {
      const batch = jobs.slice(offset, offset + this.#concurrency)
      const settled = await Promise.allSettled(batch.map((job) => job.fetch()))
      settled.forEach((result, index) => {
        const job = batch[index]!
        if (result.status === 'fulfilled') {
          const ranked = newestByIdentity(result.value.items)
            .map((item) => rankDiscoveryItem(item, profile, now))
            .filter(
              (candidate) => !candidate.excluded && (!job.browseOnly || hasSemanticMatch(candidate))
            )
          sourceOutcomes[job.source] = {
            status:
              result.value.items.length === 0 && result.value.rejectedCount > 0
                ? 'failed'
                : result.value.rejectedCount > 0
                  ? 'partial'
                  : ranked.length === 0
                    ? 'no_results'
                    : 'healthy',
            resultCount: ranked.length,
            error:
              result.value.rejectedCount > 0
                ? `${result.value.rejectedCount} invalid entries were ignored`
                : null
          }
          rankedSourceItems.push(...ranked)
        } else {
          sourceOutcomes[job.source] = {
            status: 'failed',
            resultCount: 0,
            error: boundedError(result.reason)
          }
        }
      })
    }

    const savedItemIds = findSavedCandidateIds(
      this.#repository,
      rankedSourceItems.map((ranked) => ranked.item.id)
    )
    const rankedItems = deduplicateRanked(rankedSourceItems, savedItemIds)
      .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id))
      .slice(0, 100)
    const items = rankedItems.map((ranked) =>
      rankedResult(ranked, savedItemIds.has(ranked.item.id))
    )
    const byKind = kindCountRecord()
    const bySource = sourceCountRecord()
    items.forEach((item) => {
      byKind[item.kind] += 1
      bySource[item.source] += 1
    })
    request.sources.forEach((source) => {
      const outcome = sourceOutcomes[source]
      if (!outcome || outcome.status === 'failed') return
      const resultCount = bySource[source] ?? 0
      sourceOutcomes[source] = {
        ...outcome,
        status:
          outcome.status === 'partial' ? 'partial' : resultCount > 0 ? 'healthy' : 'no_results',
        resultCount
      }
    })
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
        arxiv: bySource.arxiv,
        github: bySource.github,
        byKind,
        bySource
      },
      items
    }
    this.#repository.saveDiscoverSnapshot(snapshot)
    return snapshot
  }
}

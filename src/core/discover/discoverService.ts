import { randomUUID } from 'node:crypto'
import type { DiscoveryItem, DiscoveryItemKind, RankedDiscoveryItem } from '../../shared/discovery'
import {
  DISCOVER_SOURCE_IDS,
  discoverSearchRequestSchema,
  type DiscoverPlan,
  type DiscoverPlannerProvenance,
  type DiscoverProgress,
  type DiscoverResultItem,
  type DiscoverRunner,
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
  readonly signal?: AbortSignal
}

interface DiscoverRepository {
  findSavedItemIds(itemIds: readonly string[]): readonly string[]
  saveDiscoverSnapshot(snapshot: DiscoverSnapshot): void
}

interface DiscoverDependencies {
  readonly planner: Pick<DiscoverPlannerService, 'plan'>
  readonly repository: DiscoverRepository
  readonly fetchArxiv?: (
    interest: ArxivInterest,
    options?: { readonly signal?: AbortSignal }
  ) => Promise<DiscoveryItem[]>
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
  readonly signal?: AbortSignal
  readonly onProgress?: (progress: DiscoverProgress) => void
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

function canceledOutcome(): DiscoverSourceOutcome {
  return { status: 'canceled', resultCount: 0, error: 'Canceled by user' }
}

class DiscoverCanceledError extends Error {
  constructor() {
    super('Discover search canceled')
    this.name = 'DiscoverCanceledError'
  }
}

function raceWithAbort<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation
  if (signal.aborted) return Promise.reject(new DiscoverCanceledError())
  return new Promise<T>((resolve, reject) => {
    const cancel = () => reject(new DiscoverCanceledError())
    signal.addEventListener('abort', cancel, { once: true })
    operation.then(
      (value) => {
        signal.removeEventListener('abort', cancel)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', cancel)
        reject(error)
      }
    )
  })
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
  if (statuses.includes('canceled')) return 'canceled'
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

function preferredResult(candidate: DiscoverResultItem, current: DiscoverResultItem): boolean {
  if (candidate.saved !== current.saved) return candidate.saved
  if (candidate.score !== current.score) return candidate.score > current.score
  if (candidate.updatedAt !== current.updatedAt) return candidate.updatedAt > current.updatedAt
  const candidateSourceIndex = DISCOVER_SOURCE_IDS.indexOf(candidate.source)
  const currentSourceIndex = DISCOVER_SOURCE_IDS.indexOf(current.source)
  if (candidateSourceIndex !== currentSourceIndex) return candidateSourceIndex < currentSourceIndex
  return candidate.id.localeCompare(current.id) < 0
}

function deduplicateResults(items: readonly DiscoverResultItem[]): DiscoverResultItem[] {
  const winners: DiscoverResultItem[] = []
  for (const candidate of items) {
    const candidateTitle = titleKey(candidate.title)
    const duplicateIndex = winners.findIndex((current) => {
      const sameIdentity = current.id === candidate.id
      const sameUrl = canonicalUrl(current.url) === canonicalUrl(candidate.url)
      const sameTitle = candidateTitle !== null && candidateTitle === titleKey(current.title)
      return sameIdentity || sameUrl || sameTitle
    })
    if (duplicateIndex < 0) winners.push(candidate)
    else if (preferredResult(candidate, winners[duplicateIndex]!)) {
      winners.splice(duplicateIndex, 1, candidate)
    }
  }
  return winners
}

interface SnapshotInput {
  readonly id: string
  readonly intent: string
  readonly runner: DiscoverRunner
  readonly createdAt: string
  readonly plan: DiscoverPlan
  readonly provenance: DiscoverPlannerProvenance
  readonly sourceOutcomes: Record<DiscoverSource, DiscoverSourceOutcome>
  readonly candidates: readonly DiscoverResultItem[]
  readonly repository: DiscoverRepository
}

function finalizeSnapshot(input: SnapshotInput): DiscoverSnapshot {
  const savedItemIds = findSavedCandidateIds(
    input.repository,
    input.candidates.map((candidate) => candidate.id)
  )
  const items = deduplicateResults(
    input.candidates.map((candidate) => ({
      ...candidate,
      saved: savedItemIds.has(candidate.id)
    }))
  )
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, 100)
  const byKind = kindCountRecord()
  const bySource = sourceCountRecord()
  items.forEach((item) => {
    byKind[item.kind] += 1
    bySource[item.source] += 1
  })
  for (const source of DISCOVER_SOURCE_IDS) {
    const outcome = input.sourceOutcomes[source]!
    if (
      outcome.status === 'not_searched' ||
      outcome.status === 'failed' ||
      outcome.status === 'canceled'
    ) {
      continue
    }
    const resultCount = bySource[source] ?? 0
    input.sourceOutcomes[source] = {
      ...outcome,
      status: outcome.status === 'partial' ? 'partial' : resultCount > 0 ? 'healthy' : 'no_results',
      resultCount
    }
  }
  const searchedSources = DISCOVER_SOURCE_IDS.filter(
    (source) => input.sourceOutcomes[source]!.status !== 'not_searched'
  )
  return {
    id: input.id,
    intent: input.intent,
    runner: input.runner,
    status: overallStatus(searchedSources, input.sourceOutcomes, items.length),
    createdAt: input.createdAt,
    plan: input.plan,
    provenance: input.provenance,
    sourceOutcomes: input.sourceOutcomes,
    counts: {
      total: items.length,
      arxiv: bySource.arxiv,
      github: bySource.github,
      byKind,
      bySource
    },
    items
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
    this.#fetchArxiv =
      dependencies.fetchArxiv ?? ((interest, options) => fetchArxivItems(interest, options))
    this.#fetchGitHub =
      dependencies.fetchGitHub ?? ((interest, options) => fetchGitHubRadarItems(interest, options))
    this.#fetchConfiguredSource = dependencies.fetchConfiguredSource ?? fetchConfiguredSourceBatch
    this.#configuredDefinitions =
      dependencies.configuredDefinitions ?? CONFIGURED_SOURCE_DEFINITIONS
    this.#concurrency = validateConcurrency(dependencies.concurrency ?? 4)
    this.#createSessionId = dependencies.createSessionId ?? (() => `discover:${randomUUID()}`)
  }

  #buildJobs(
    sources: readonly DiscoverSource[],
    plan: DiscoverPlan,
    now: Date,
    options: DiscoverOptions
  ): SourceJob[] {
    const profile = profileFromPlan(plan)
    const jobs: SourceJob[] = []
    if (sources.includes('arxiv')) {
      jobs.push({
        source: 'arxiv',
        browseOnly: false,
        fetch: async () => ({
          items: await (options.signal
            ? this.#fetchArxiv(profile.arxiv, { signal: options.signal })
            : this.#fetchArxiv(profile.arxiv)),
          rejectedCount: 0
        })
      })
    }
    if (sources.includes('github')) {
      jobs.push({
        source: 'github',
        browseOnly: false,
        fetch: async () => ({
          items: await this.#fetchGitHub(profile.github, {
            now,
            token: options.githubToken?.trim() || undefined,
            ...(options.signal ? { signal: options.signal } : {})
          }),
          rejectedCount: 0
        })
      })
    }
    for (const source of sources) {
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
              : {}),
            ...(options.signal ? { signal: options.signal } : {})
          })
        }
      })
    }
    return jobs
  }

  async #executeJobs(
    jobs: readonly SourceJob[],
    plan: DiscoverPlan,
    now: Date,
    sourceOutcomes: Record<DiscoverSource, DiscoverSourceOutcome>,
    options: DiscoverOptions
  ): Promise<RankedDiscoveryItem[]> {
    const profile = profileFromPlan(plan)
    const rankedSourceItems: RankedDiscoveryItem[] = []
    let completedSources = 0
    const report = (source: DiscoverSource, outcome: DiscoverSourceOutcome) => {
      completedSources += 1
      options.onProgress?.({
        phase: 'searching',
        completedSources,
        totalSources: jobs.length,
        source,
        outcome
      })
    }
    const cancelRemaining = (remaining: readonly SourceJob[]) => {
      for (const job of remaining) {
        const outcome = canceledOutcome()
        sourceOutcomes[job.source] = outcome
        report(job.source, outcome)
      }
    }

    for (let offset = 0; offset < jobs.length; offset += this.#concurrency) {
      if (options.signal?.aborted) {
        cancelRemaining(jobs.slice(offset))
        break
      }
      const batch = jobs.slice(offset, offset + this.#concurrency)
      const settled = await Promise.allSettled(
        batch.map((job) => raceWithAbort(job.fetch(), options.signal))
      )
      settled.forEach((result, index) => {
        const job = batch[index]!
        let outcome: DiscoverSourceOutcome
        if (result.status === 'fulfilled') {
          const ranked = newestByIdentity(result.value.items)
            .map((item) => rankDiscoveryItem(item, profile, now))
            .filter(
              (candidate) => !candidate.excluded && (!job.browseOnly || hasSemanticMatch(candidate))
            )
          outcome = {
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
        } else if (result.reason instanceof DiscoverCanceledError) {
          outcome = canceledOutcome()
        } else {
          outcome = { status: 'failed', resultCount: 0, error: boundedError(result.reason) }
        }
        sourceOutcomes[job.source] = outcome
        report(job.source, outcome)
      })
      if (options.signal?.aborted) {
        cancelRemaining(jobs.slice(offset + batch.length))
        break
      }
    }
    return rankedSourceItems
  }

  async search(
    candidate: DiscoverSearchRequest,
    options: DiscoverOptions = {}
  ): Promise<DiscoverSnapshot> {
    const request = discoverSearchRequestSchema.parse(candidate)
    const now = options.now ?? new Date()
    options.onProgress?.({
      phase: 'planning',
      completedSources: 0,
      totalSources: request.sources.length,
      source: null,
      outcome: null
    })
    const planning = options.signal
      ? this.#planner.plan(request, now, options.signal)
      : this.#planner.plan(request, now)
    const { plan, provenance } = await raceWithAbort(planning, options.signal)
    const jobs = this.#buildJobs(request.sources, plan, now, options)
    const sourceOutcomes = outcomeRecord()
    options.onProgress?.({
      phase: 'searching',
      completedSources: 0,
      totalSources: jobs.length,
      source: null,
      outcome: null
    })
    const rankedSourceItems = await this.#executeJobs(jobs, plan, now, sourceOutcomes, options)
    const snapshot = finalizeSnapshot({
      id: this.#createSessionId(),
      intent: request.intent,
      runner: request.runner,
      createdAt: now.toISOString(),
      plan,
      provenance,
      sourceOutcomes,
      candidates: rankedSourceItems.map((ranked) => rankedResult(ranked, false)),
      repository: this.#repository
    })
    this.#repository.saveDiscoverSnapshot(snapshot)
    return snapshot
  }

  async retry(
    previous: DiscoverSnapshot,
    requestedSources: readonly DiscoverSource[],
    options: DiscoverOptions = {}
  ): Promise<DiscoverSnapshot> {
    const sources = [...new Set(requestedSources)]
    if (sources.length === 0) throw new Error('Select at least one failed Discover source to retry')
    for (const source of sources) {
      const status = previous.sourceOutcomes[source]!.status
      if (status !== 'failed' && status !== 'partial' && status !== 'canceled') {
        throw new Error(`Discover source ${source} is not eligible for retry`)
      }
    }
    const now = options.now ?? new Date()
    const jobs = this.#buildJobs(sources, previous.plan, now, options)
    const sourceOutcomes = Object.fromEntries(
      DISCOVER_SOURCE_IDS.map((source) => [source, { ...previous.sourceOutcomes[source] }])
    ) as Record<DiscoverSource, DiscoverSourceOutcome>
    options.onProgress?.({
      phase: 'searching',
      completedSources: 0,
      totalSources: jobs.length,
      source: null,
      outcome: null
    })
    const rankedSourceItems = await this.#executeJobs(
      jobs,
      previous.plan,
      now,
      sourceOutcomes,
      options
    )
    const snapshot = finalizeSnapshot({
      id: this.#createSessionId(),
      intent: previous.intent,
      runner: previous.runner,
      createdAt: now.toISOString(),
      plan: previous.plan,
      provenance: previous.provenance,
      sourceOutcomes,
      candidates: [
        ...previous.items.filter((item) => !sources.includes(item.source)),
        ...rankedSourceItems.map((ranked) => rankedResult(ranked, false))
      ],
      repository: this.#repository
    })
    this.#repository.saveDiscoverSnapshot(snapshot)
    return snapshot
  }
}

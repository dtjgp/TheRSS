import type { InterestProfile } from '../../interests/interestProfile'
import type { ConfiguredSourceDefinition } from './configuredSources'
import { fetchConfiguredHttpDocument } from './configuredHttpClient'
import {
  normalizeConfiguredItem,
  normalizeFeedDocument,
  normalizeHtmlDocument,
  type NormalizedSourceBatch
} from './sourceNormalizer'
import { fetchHuggingFaceSignals } from '../huggingface/huggingFaceClient'
import { fetchXSignals } from '../x/xapiClient'
import { fetchDatedFeedSource } from './datedFeedAdapter'
import { normalizeNcpssdDocument } from './ncpssdNormalizer'

export interface FetchConfiguredSourceOptions {
  readonly now: Date
  readonly huggingFaceToken?: string
}

interface ConfiguredSourceAdapterDependencies {
  readonly fetchHttp?: typeof fetchConfiguredHttpDocument
  readonly fetchHuggingFace?: typeof fetchHuggingFaceSignals
  readonly fetchX?: typeof fetchXSignals
  readonly fetchDatedFeed?: typeof fetchDatedFeedSource
}

function xResearchQuery(profile: InterestProfile): string {
  const inclusions = [
    ...profile.arxiv.keywords,
    ...profile.github.keywords,
    ...profile.github.topics
  ]
  const unique = [...new Set(inclusions.map((term) => term.trim()).filter(Boolean))]
  const positive = unique.slice(0, 12).map((term) => (term.includes(' ') ? `"${term}"` : term))
  const exclusions = profile.arxiv.excludeKeywords
    .slice(0, 8)
    .map((term) => `-${term.includes(' ') ? `"${term}"` : term}`)
  return `${positive.join(' OR ')} ${exclusions.join(' ')}`.trim().slice(0, 500)
}

function normalizeItems(
  items: Awaited<ReturnType<typeof fetchHuggingFaceSignals>>
): NormalizedSourceBatch {
  const normalized = []
  let rejectedCount = 0
  for (const item of items) {
    try {
      normalized.push(normalizeConfiguredItem(item))
    } catch {
      rejectedCount += 1
    }
  }
  return { items: normalized, rejectedCount }
}

export async function fetchConfiguredSourceBatch(
  definition: ConfiguredSourceDefinition,
  profile: InterestProfile,
  options: FetchConfiguredSourceOptions,
  dependencies: ConfiguredSourceAdapterDependencies = {}
): Promise<NormalizedSourceBatch> {
  const fetchHttp = dependencies.fetchHttp ?? fetchConfiguredHttpDocument
  const fetchHuggingFace = dependencies.fetchHuggingFace ?? fetchHuggingFaceSignals
  const fetchX = dependencies.fetchX ?? fetchXSignals
  const fetchDatedFeed = dependencies.fetchDatedFeed ?? fetchDatedFeedSource
  if (definition.transport === 'dated_feed') {
    return fetchDatedFeed(definition, { now: options.now })
  }
  if (definition.transport === 'feed' || definition.transport === 'html') {
    const document = await fetchHttp(definition.id, { now: options.now })
    return definition.transport === 'feed'
      ? normalizeFeedDocument(document)
      : definition.id === 'folo:611'
        ? normalizeNcpssdDocument(document)
        : normalizeHtmlDocument(document)
  }
  if (definition.transport === 'huggingface') {
    return normalizeItems(
      await fetchHuggingFace({
        maxItemsPerKind: 10,
        ...(options.huggingFaceToken ? { token: options.huggingFaceToken } : {})
      })
    )
  }
  const query = xResearchQuery(profile)
  if (!query) throw new Error('X retrieval requires at least one keyword or topic')
  return normalizeItems(await fetchX(query, { count: 20 }))
}

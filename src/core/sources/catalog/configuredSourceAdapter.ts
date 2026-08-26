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
import { fetchDatedFeedSource } from './datedFeedAdapter'
import { normalizeNcpssdDocument } from './ncpssdNormalizer'
import { normalizeC114Document } from './c114Normalizer'

export interface FetchConfiguredSourceOptions {
  readonly now: Date
  readonly huggingFaceToken?: string
  readonly signal?: AbortSignal
}

interface ConfiguredSourceAdapterDependencies {
  readonly fetchHttp?: typeof fetchConfiguredHttpDocument
  readonly fetchHuggingFace?: typeof fetchHuggingFaceSignals
  readonly fetchDatedFeed?: typeof fetchDatedFeedSource
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
  _profile: InterestProfile,
  options: FetchConfiguredSourceOptions,
  dependencies: ConfiguredSourceAdapterDependencies = {}
): Promise<NormalizedSourceBatch> {
  const fetchHttp = dependencies.fetchHttp ?? fetchConfiguredHttpDocument
  const fetchHuggingFace = dependencies.fetchHuggingFace ?? fetchHuggingFaceSignals
  const fetchDatedFeed = dependencies.fetchDatedFeed ?? fetchDatedFeedSource
  if (definition.transport === 'dated_feed') {
    return fetchDatedFeed(definition, {
      now: options.now,
      ...(options.signal ? { signal: options.signal } : {})
    })
  }
  if (definition.transport === 'feed' || definition.transport === 'html') {
    const document = await fetchHttp(definition.id, {
      now: options.now,
      ...(options.signal ? { signal: options.signal } : {})
    })
    return definition.transport === 'feed'
      ? normalizeFeedDocument(document)
      : definition.id === 'folo:611'
        ? normalizeNcpssdDocument(document)
        : definition.id === 'folo:523'
          ? normalizeC114Document(document)
          : normalizeHtmlDocument(document)
  }
  return normalizeItems(
    await fetchHuggingFace({
      maxItemsPerKind: 10,
      ...(options.huggingFaceToken ? { token: options.huggingFaceToken } : {}),
      ...(options.signal ? { signal: options.signal } : {})
    })
  )
}

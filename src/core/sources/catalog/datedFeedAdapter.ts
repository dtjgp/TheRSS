import { XMLParser } from 'fast-xml-parser'
import { readBoundedText } from '../../security/boundedResponse'
import type {
  ConfiguredSourceDefinition,
  DatedFeedConfiguredSourceDefinition
} from './configuredSources'
import { fetchConfiguredHttpDocument } from './configuredHttpClient'
import { normalizeConfiguredItem, type NormalizedSourceBatch } from './sourceNormalizer'

interface FetchDatedFeedOptions {
  readonly now: Date
}

interface DatedFeedDependencies {
  readonly fetchDocument?: typeof fetchConfiguredHttpDocument
  readonly fetcher?: typeof fetch
}

interface FeedCandidate {
  readonly title: string
  readonly summary: string
  readonly url: string
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(values.length)
  let nextIndex = 0
  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      try {
        results[index] = { status: 'fulfilled', value: await operation(values[index]!) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()))
  return results
}

function arrayify<T>(value: T | readonly T[] | undefined): readonly T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? (value as readonly T[]) : [value as T]
}

function scalar(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  return scalar(record['#text'] ?? record['@_href'] ?? record['@_about'])
}

function plainText(value: unknown, maxLength: number): string {
  return scalar(value)
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replaceAll(/<[^>]+>/gu, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&nbsp;', ' ')
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .slice(0, maxLength)
}

function feedCandidates(body: string, maximum: number): readonly FeedCandidate[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true
  })
  const parsed = parser.parse(body) as Record<string, unknown>
  const rss = parsed.rss as Record<string, unknown> | undefined
  const channel = rss?.channel as Record<string, unknown> | undefined
  const rdf = parsed.RDF as Record<string, unknown> | undefined
  const entries = arrayify(
    (channel?.item ?? rdf?.item) as
      Record<string, unknown> | readonly Record<string, unknown>[] | undefined
  )

  return entries.slice(0, maximum).map((entry) => ({
    title: plainText(entry.title, 500),
    summary: plainText(entry.description ?? entry.summary ?? entry.title, 10_000),
    url: scalar(entry.link ?? entry['@_about'])
  }))
}

function attribute(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'iu'))
  return match?.[1]?.trim() ?? ''
}

function publicationDate(html: string, names: readonly string[]): string {
  const accepted = new Set(names.map((name) => name.toLocaleLowerCase()))
  for (const match of html.matchAll(/<meta\b[^>]*>/giu)) {
    const tag = match[0]
    const name = attribute(tag, 'name').toLocaleLowerCase()
    if (!accepted.has(name)) continue
    const raw = attribute(tag, 'content')
    const simpleDate = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})$/u)
    const timestamp = simpleDate
      ? Date.UTC(Number(simpleDate[1]), Number(simpleDate[2]) - 1, Number(simpleDate[3]))
      : Date.parse(raw)
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString()
  }
  throw new Error('Article page has no accepted publication-date metadata')
}

function assertDatedFeedDefinition(
  definition: ConfiguredSourceDefinition
): asserts definition is DatedFeedConfiguredSourceDefinition {
  if (definition.transport !== 'dated_feed') {
    throw new Error(`Configured source ${definition.id} is not a dated feed`)
  }
}

async function enrichCandidate(
  definition: DatedFeedConfiguredSourceDefinition,
  candidate: FeedCandidate,
  fetcher: typeof fetch
) {
  if (!candidate.title || !candidate.url) throw new Error('Feed entry is incomplete')
  const articleUrl = new URL(candidate.url)
  if (
    articleUrl.protocol !== 'https:' ||
    articleUrl.origin !== definition.articleOrigin ||
    articleUrl.username ||
    articleUrl.password
  ) {
    throw new Error('Feed article is outside the fixed official origin')
  }
  const response = await fetcher(articleUrl.toString(), {
    headers: {
      Accept: 'text/html, application/xhtml+xml',
      'User-Agent': 'TheRSS/0.2 (local research source client)'
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok) throw new Error(`Article request failed with status ${response.status}`)
  if (response.url && new URL(response.url).origin !== definition.articleOrigin) {
    throw new Error('Article redirected outside the fixed official origin')
  }
  const contentType = (response.headers.get('content-type') ?? '').split(';', 1)[0]!.trim()
  if (contentType && contentType !== 'text/html' && contentType !== 'application/xhtml+xml') {
    throw new Error(`Article returned unexpected content type ${contentType}`)
  }
  const html = await readBoundedText(
    response,
    2_000_000,
    `Configured source ${definition.id} article`
  )
  const publishedAt = publicationDate(html, definition.dateMetaNames)
  return normalizeConfiguredItem({
    id: articleUrl.toString(),
    sourceId: definition.id,
    externalId: articleUrl.toString(),
    kind: definition.itemKind,
    title: candidate.title,
    summary: candidate.summary,
    url: articleUrl.toString(),
    publishedAt,
    authors: [],
    tags: [],
    metrics: {}
  })
}

export async function fetchDatedFeedSource(
  definition: ConfiguredSourceDefinition,
  options: FetchDatedFeedOptions,
  dependencies: DatedFeedDependencies = {}
): Promise<NormalizedSourceBatch> {
  assertDatedFeedDefinition(definition)
  const document = await (dependencies.fetchDocument ?? fetchConfiguredHttpDocument)(
    definition.id,
    {
      now: options.now
    }
  )
  const candidates = feedCandidates(document.body, definition.maxItems)
  const results = await mapWithConcurrency(candidates, 4, (candidate) =>
    enrichCandidate(definition, candidate, dependencies.fetcher ?? fetch)
  )
  return {
    items: results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
    rejectedCount: results.filter((result) => result.status === 'rejected').length
  }
}

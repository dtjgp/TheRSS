import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { z } from 'zod'
import type { ArxivInterest } from '../../interests/interestProfile'
import { readBoundedText } from '../../security/boundedResponse'
import type { DiscoveryItem } from '../../../shared/discovery'
import { buildArxivQueryUrl, buildArxivRecentQueryUrl } from './arxivQuery'
import { RequestPacer, sourceDelay } from './requestPacer'

const ARXIV_USER_AGENT = 'TheRSS (local academic discovery; https://github.com/dtjgp/TheRSS)'
const MAX_RETRY_DELAY_MS = 30_000
const realRequests = new RequestPacer(3000)

interface FetchArxivOptions {
  readonly fetcher?: typeof fetch
  readonly maxResults?: number
  readonly maxResponseBytes?: number
  readonly maxAttempts?: number
  readonly timeoutMs?: number
  readonly sleep?: (milliseconds: number) => Promise<void>
  readonly now?: Date
  readonly signal?: AbortSignal
}

const parsedItemSchema = z
  .object({
    id: z.string().min(1),
    source: z.literal('arxiv'),
    kind: z.literal('paper'),
    externalId: z.string().min(1),
    title: z.string().min(1).max(1000),
    summary: z.string().max(100000),
    url: z.url().startsWith('https://arxiv.org/abs/'),
    publishedAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    authors: z.array(z.string().max(400)).max(10000),
    categories: z.array(z.string().max(100)).max(100),
    topics: z.array(z.string()),
    language: z.null(),
    stars: z.null(),
    metrics: z.object({})
  })
  .refine(
    (item) => item.authors.join(', ').length + item.categories.join(', ').length <= 500000,
    'arXiv metadata exceeds the bounded presentation budget'
  )

function arrayify<T>(value: T | readonly T[] | undefined): readonly T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? (value as readonly T[]) : [value as T]
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replaceAll(/\s+/g, ' ').trim() : ''
}

function isoDate(value: unknown, field: string): string {
  const timestamp = typeof value === 'string' ? Date.parse(value) : Number.NaN
  if (!Number.isFinite(timestamp)) {
    throw new Error(`arXiv feed contains an invalid ${field}`)
  }
  return new Date(timestamp).toISOString()
}

function externalIdFromEntry(value: unknown): string {
  if (typeof value !== 'string' || value.length > 300)
    throw new Error('arXiv feed entry has no valid identifier')
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['arxiv.org', 'www.arxiv.org', 'export.arxiv.org'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('arXiv feed entry has an invalid identifier')
  const match = url.pathname.match(
    /^\/abs\/(\d{4}\.\d{4,5}(?:v[1-9]\d*)?|[a-z][a-z0-9.-]*\/\d{7}(?:v[1-9]\d*)?)$/iu
  )
  if (!match?.[1]) throw new Error('arXiv feed entry has an invalid identifier')
  return match[1]
}

export function parseArxivFeed(xml: string): DiscoveryItem[] {
  if (xml.length > 10_000_000) throw new Error('arXiv feed exceeds the 10 MB safety limit')
  if (/<!DOCTYPE\b/iu.test(xml) || XMLValidator.validate(xml) !== true)
    throw new Error('arXiv returned invalid or unsupported XML')

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true
  })
  const parsed = parser.parse(xml) as Record<string, unknown>
  if (
    !Object.hasOwn(parsed, 'feed') ||
    parsed.feed === null ||
    Array.isArray(parsed.feed) ||
    (typeof parsed.feed !== 'object' && parsed.feed !== '')
  )
    throw new Error('arXiv response is not a valid Atom feed')
  if (parsed.feed === '') return []
  const feed = parsed.feed as {
    entry?: Record<string, unknown> | readonly Record<string, unknown>[]
    error?: unknown
  }
  if (feed.error !== undefined) throw new Error('arXiv returned an error feed')

  return arrayify(feed.entry).map((entry) => {
    const externalId = externalIdFromEntry(entry.id)
    const authors = arrayify<Record<string, unknown>>(
      entry.author as Record<string, unknown> | readonly Record<string, unknown>[] | undefined
    )
      .map((author) => normalizeText(author.name))
      .filter(Boolean)
    const categories = arrayify<Record<string, unknown>>(
      entry.category as Record<string, unknown> | readonly Record<string, unknown>[] | undefined
    )
      .map((category) => normalizeText(category['@_term']))
      .filter(Boolean)

    return parsedItemSchema.parse({
      id: `arxiv:${externalId}`,
      source: 'arxiv',
      kind: 'paper',
      externalId,
      title: normalizeText(entry.title),
      summary: normalizeText(entry.summary),
      url: `https://arxiv.org/abs/${externalId}`,
      publishedAt: isoDate(entry.published, 'published date'),
      updatedAt: isoDate(entry.updated, 'updated date'),
      authors,
      categories,
      topics: [],
      language: null,
      stars: null,
      metrics: {}
    })
  })
}

export async function fetchArxivItems(
  interest: ArxivInterest,
  options: FetchArxivOptions = {}
): Promise<DiscoveryItem[]> {
  return fetchArxivUrl(buildArxivQueryUrl(interest, options.maxResults ?? 50), options)
}

function retryAfterDelay(response: Response): number | undefined {
  const retryAfter = response.headers.get('retry-after')?.trim()
  if (!retryAfter) return undefined
  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, MAX_RETRY_DELAY_MS)
  const dateDelay = Date.parse(retryAfter) - Date.now()
  if (Number.isFinite(dateDelay) && dateDelay > 0) return Math.min(dateDelay, MAX_RETRY_DELAY_MS)
  return undefined
}

async function fetchArxivUrl(url: string, options: FetchArxivOptions): Promise<DiscoveryItem[]> {
  const fetcher = options.fetcher ?? fetch
  const maxAttempts = options.maxAttempts ?? 3
  const sleep = options.sleep ?? ((milliseconds) => sourceDelay(milliseconds, options.signal))

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    options.signal?.throwIfAborted()
    const backoff = Math.min(3_000 * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS)
    const request = async () => {
      const timeout = AbortSignal.timeout(options.timeoutMs ?? 30_000)
      const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
      try {
        const response = await fetcher(url, {
          headers: {
            Accept: 'application/atom+xml',
            'User-Agent': ARXIV_USER_AGENT
          },
          signal
        })
        if (response.ok) {
          const items = parseArxivFeed(
            await readBoundedText(response, options.maxResponseBytes ?? 10_000_000, 'arXiv')
          )
          return { items }
        }
        const status = response.status
        const retryable = status === 429 || status === 503
        const retryAfter = retryable ? retryAfterDelay(response) : undefined
        const delay = retryAfter ?? backoff
        // Publish the cooldown before releasing the pacer, even on the final attempt.
        if (!options.fetcher && (status === 429 || retryAfter !== undefined))
          realRequests.applyCooldown(delay)
        await response.body?.cancel()
        return { status, retryable, delay }
      } catch (error) {
        // A body read may reject with AbortError even when the deadline caused it.
        signal.throwIfAborted()
        throw error
      }
    }
    let delay = backoff
    try {
      // Injected transports bypass process-wide pacing for deterministic tests.
      const result = options.fetcher
        ? await request()
        : await realRequests.run(request, options.signal)
      options.signal?.throwIfAborted()
      if ('items' in result) return result.items
      if (!result.retryable || attempt === maxAttempts)
        throw new Error(`arXiv request failed with status ${result.status}`)
      delay = result.delay
    } catch (error) {
      options.signal?.throwIfAborted()
      if (!(error instanceof Error) || error.name !== 'TimeoutError' || attempt === maxAttempts)
        throw error
    }
    await sleep(delay)
  }
  throw new Error('arXiv request failed after bounded retries')
}

export async function fetchArxivRecentItems(
  options: FetchArxivOptions = {}
): Promise<DiscoveryItem[]> {
  const now = options.now ?? new Date()
  const sleep = options.sleep ?? ((milliseconds) => sourceDelay(milliseconds, options.signal))
  for (let daysAgo = 0; daysAgo < 7; daysAgo += 1) {
    const requestedDay = new Date(now)
    requestedDay.setUTCDate(requestedDay.getUTCDate() - daysAgo)
    const items = await fetchArxivUrl(
      buildArxivRecentQueryUrl(requestedDay, options.maxResults ?? 200),
      options
    )
    if (items.length > 0) {
      const requestedDate = requestedDay.toISOString().slice(0, 10)
      return items.filter((item) => item.publishedAt.startsWith(requestedDate))
    }
    if (daysAgo < 6) await sleep(3_000)
  }
  return []
}

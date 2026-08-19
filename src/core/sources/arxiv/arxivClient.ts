import { XMLParser } from 'fast-xml-parser'
import { z } from 'zod'
import type { ArxivInterest } from '../../interests/interestProfile'
import { readBoundedText } from '../../security/boundedResponse'
import type { DiscoveryItem } from '../../../shared/discovery'
import { buildArxivQueryUrl, buildArxivRecentQueryUrl } from './arxivQuery'

const ARXIV_USER_AGENT = 'TheRSS/0.1 (local academic discovery client)'

interface FetchArxivOptions {
  readonly fetcher?: typeof fetch
  readonly maxResults?: number
  readonly maxResponseBytes?: number
  readonly maxAttempts?: number
  readonly sleep?: (milliseconds: number) => Promise<void>
  readonly now?: Date
}

const parsedItemSchema = z.object({
  id: z.string().min(1),
  source: z.literal('arxiv'),
  kind: z.literal('paper'),
  externalId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  url: z.url().startsWith('https://arxiv.org/abs/'),
  publishedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  authors: z.array(z.string()),
  categories: z.array(z.string()),
  topics: z.array(z.string()),
  language: z.null(),
  stars: z.null(),
  metrics: z.object({})
})

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
  if (typeof value !== 'string') throw new Error('arXiv feed entry has no identifier')
  const match = value.match(/\/abs\/([^/?#]+)$/)
  if (!match?.[1]) throw new Error('arXiv feed entry has an invalid identifier')
  return match[1]
}

export function parseArxivFeed(xml: string): DiscoveryItem[] {
  if (xml.length > 10_000_000) throw new Error('arXiv feed exceeds the 10 MB safety limit')

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true
  })
  const parsed = parser.parse(xml) as {
    feed?: {
      entry?: Record<string, unknown> | readonly Record<string, unknown>[]
    }
  }

  return arrayify(parsed.feed?.entry).map((entry) => {
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

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('retry-after')?.trim()
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 10_000)
    const dateDelay = Date.parse(retryAfter) - Date.now()
    if (Number.isFinite(dateDelay) && dateDelay > 0) return Math.min(dateDelay, 10_000)
  }
  return Math.min(3_000 * attempt, 10_000)
}

async function fetchArxivUrl(url: string, options: FetchArxivOptions): Promise<DiscoveryItem[]> {
  const fetcher = options.fetcher ?? fetch
  const maxAttempts = options.maxAttempts ?? 3
  const sleep =
    options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)))

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetcher(url, {
      headers: {
        Accept: 'application/atom+xml',
        'User-Agent': ARXIV_USER_AGENT
      },
      signal: AbortSignal.timeout(30_000)
    })

    if (response.ok) {
      return parseArxivFeed(
        await readBoundedText(response, options.maxResponseBytes ?? 10_000_000, 'arXiv')
      )
    }
    if (response.status !== 429 || attempt === maxAttempts) {
      throw new Error(`arXiv request failed with status ${response.status}`)
    }
    await sleep(retryDelay(response, attempt))
  }
  throw new Error('arXiv request failed after bounded retries')
}

export async function fetchArxivRecentItems(
  options: FetchArxivOptions = {}
): Promise<DiscoveryItem[]> {
  const now = options.now ?? new Date()
  const sleep =
    options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)))
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

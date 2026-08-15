import { XMLParser } from 'fast-xml-parser'
import { z } from 'zod'
import type { ArxivInterest } from '../../interests/interestProfile'
import type { DiscoveryItem } from '../../../shared/discovery'
import { buildArxivQueryUrl } from './arxivQuery'

const ARXIV_USER_AGENT = 'TheRSS/0.1 (local academic discovery client)'

interface FetchArxivOptions {
  readonly fetcher?: typeof fetch
  readonly maxResults?: number
}

const parsedItemSchema = z.object({
  id: z.string().min(1),
  source: z.literal('arxiv'),
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
  stars: z.null()
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
      stars: null
    })
  })
}

export async function fetchArxivItems(
  interest: ArxivInterest,
  options: FetchArxivOptions = {}
): Promise<DiscoveryItem[]> {
  const response = await (options.fetcher ?? fetch)(
    buildArxivQueryUrl(interest, options.maxResults ?? 50),
    {
      headers: {
        Accept: 'application/atom+xml',
        'User-Agent': ARXIV_USER_AGENT
      },
      signal: AbortSignal.timeout(30_000)
    }
  )

  if (!response.ok) {
    throw new Error(`arXiv request failed with status ${response.status}`)
  }

  return parseArxivFeed(await response.text())
}

import { XMLParser } from 'fast-xml-parser'
import { createHash } from 'node:crypto'
import type { DiscoveryItem, DiscoverySource } from '../../../shared/discovery'
import { isDiscoverySource } from '../../../shared/sourceIdentity'
import type { ConfiguredHttpDocument } from './configuredHttpClient'
import type { ConfiguredSourceItem } from './configuredSourceItem'

export interface NormalizedSourceBatch {
  readonly items: readonly DiscoveryItem[]
  readonly rejectedCount: number
}

const MAX_ENTRIES = 100

function arrayify<T>(value: T | readonly T[] | undefined): readonly T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? (value as readonly T[]) : [value as T]
}

function plainText(value: unknown, maxLength: number): string {
  if (Array.isArray(value)) {
    return value.map((candidate) => plainText(candidate, maxLength)).find(Boolean) ?? ''
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return plainText(scalar(value), maxLength)
  }
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  return String(value)
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replaceAll(/<[^>]+>/gu, ' ')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .slice(0, maxLength)
}

function scalar(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  return scalar(record['#text'] ?? record['@_href'] ?? record['@_term'] ?? record['@_url'])
}

function isoDate(value: unknown): string {
  const timestamp = Date.parse(scalar(value))
  if (!Number.isFinite(timestamp)) throw new Error('Source entry has no valid publication date')
  return new Date(timestamp).toISOString()
}

function httpsUrl(value: unknown, base: string): string {
  const raw = scalar(value)
  if (!raw) throw new Error('Source entry has no URL')
  const url = new URL(raw, base)
  if (url.protocol === 'http:') url.protocol = 'https:'
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Source entry URL must use credential-free HTTPS')
  }
  return url.toString()
}

function sourceId(value: string): DiscoverySource {
  if (!isDiscoverySource(value) || value === 'arxiv' || value === 'github') {
    throw new Error(`Configured source ${value} is not an active external source`)
  }
  return value
}

function metrics(value: Readonly<Record<string, number>>): DiscoveryItem['metrics'] {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, amount]) =>
        (key === 'downloads' || key === 'likes') && Number.isFinite(amount) && amount >= 0
    )
  )
}

function stableItemId(
  source: DiscoverySource,
  kind: ConfiguredSourceItem['kind'],
  externalId: string
) {
  const readable = `${source}:${kind}:${externalId}`
  if (readable.length <= 300) return readable
  const digest = createHash('sha256').update(externalId).digest('hex')
  return `${source}:${kind}:sha256:${digest}`
}

export function normalizeConfiguredItem(item: ConfiguredSourceItem): DiscoveryItem {
  const source = sourceId(item.sourceId)
  const title = plainText(item.title, 500)
  if (!title) throw new Error(`Configured source ${source} item has no title`)
  const publishedAt = isoDate(item.publishedAt)
  const externalId = plainText(item.externalId, 1_000)
  if (!externalId) throw new Error(`Configured source ${source} item has no identifier`)

  return {
    id: stableItemId(source, item.kind, externalId),
    source,
    kind: item.kind,
    externalId,
    title,
    summary: plainText(item.summary, 10_000),
    url: httpsUrl(item.url, item.url),
    publishedAt,
    updatedAt: publishedAt,
    authors: item.authors
      .map((author) => plainText(author, 200))
      .filter(Boolean)
      .slice(0, 50),
    categories: [],
    topics: item.tags
      .map((tag) => plainText(tag, 200))
      .filter(Boolean)
      .slice(0, 50),
    language: null,
    stars: null,
    metrics: metrics(item.metrics)
  }
}

function feedEntries(parsed: Record<string, unknown>): readonly Record<string, unknown>[] {
  const rss = parsed.rss as Record<string, unknown> | undefined
  const channel = rss?.channel as Record<string, unknown> | undefined
  const feed = parsed.feed as Record<string, unknown> | undefined
  const rdf = parsed.RDF as Record<string, unknown> | undefined
  const entries = channel?.item ?? feed?.entry ?? rdf?.item
  return arrayify(
    entries as Record<string, unknown> | readonly Record<string, unknown>[] | undefined
  )
    .filter((entry): entry is Record<string, unknown> =>
      Boolean(entry && typeof entry === 'object')
    )
    .slice(0, MAX_ENTRIES)
}

function feedLink(entry: Record<string, unknown>, endpoint: string): string {
  const links = arrayify(entry.link as unknown)
  const alternate = links.find((link) => {
    if (!link || typeof link !== 'object') return false
    const rel = scalar((link as Record<string, unknown>)['@_rel'])
    return !rel || rel === 'alternate'
  })
  return httpsUrl(alternate ?? links[0], endpoint)
}

function feedAuthors(value: unknown): string[] {
  return arrayify(value)
    .map((author) => {
      if (author && typeof author === 'object') {
        return plainText((author as Record<string, unknown>).name ?? scalar(author), 200)
      }
      return plainText(author, 200)
    })
    .filter(Boolean)
    .slice(0, 50)
}

export function normalizeFeedDocument(document: ConfiguredHttpDocument): NormalizedSourceBatch {
  if (document.transport !== 'feed') throw new Error('Expected a configured feed document')
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true
  })
  const parsed = parser.parse(document.body) as Record<string, unknown>
  const items: DiscoveryItem[] = []
  let rejectedCount = 0
  for (const entry of feedEntries(parsed)) {
    try {
      const url = feedLink(entry, document.endpoint)
      const externalId = scalar(entry.guid ?? entry.id) || url
      const title = plainText(entry.title, 500)
      if (!title) throw new Error('Source entry has no title')
      const publishedAt = isoDate(
        entry.pubDate ?? entry.published ?? entry.updated ?? entry.date ?? entry.created
      )
      const tags = arrayify(entry.category)
        .map((category) => plainText(scalar(category), 200))
        .filter(Boolean)
      items.push(
        normalizeConfiguredItem({
          id: externalId,
          sourceId: document.sourceId,
          externalId,
          kind: 'article',
          title,
          summary: plainText(
            entry.description ?? entry.summary ?? entry.content ?? entry.encoded ?? title,
            10_000
          ),
          url,
          publishedAt,
          authors: feedAuthors(entry.author ?? entry.creator),
          tags,
          metrics: {}
        })
      )
    } catch {
      rejectedCount += 1
    }
  }
  return { items: deduplicate(items), rejectedCount }
}

function jsonLdNodes(value: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(jsonLdNodes)
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  return [record, ...jsonLdNodes(record['@graph'])]
}

function isArticleNode(node: Record<string, unknown>): boolean {
  const types = arrayify(node['@type']).map(scalar)
  return types.some((type) =>
    ['Article', 'NewsArticle', 'BlogPosting', 'ScholarlyArticle'].includes(type)
  )
}

function jsonLdUrl(node: Record<string, unknown>, endpoint: string): string {
  const main = node.mainEntityOfPage
  const mainId = main && typeof main === 'object' ? (main as Record<string, unknown>)['@id'] : main
  return httpsUrl(node.url ?? mainId, endpoint)
}

function jsonLdAuthors(value: unknown): string[] {
  return arrayify(value)
    .map((author) =>
      plainText(
        author && typeof author === 'object' ? (author as Record<string, unknown>).name : author,
        200
      )
    )
    .filter(Boolean)
    .slice(0, 50)
}

function attribute(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'iu'))
  return match?.[1]?.trim() ?? ''
}

function semanticArticleItems(document: ConfiguredHttpDocument): NormalizedSourceBatch {
  const items: DiscoveryItem[] = []
  let rejectedCount = 0
  for (const match of document.body.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/giu)) {
    try {
      const article = match[1] ?? ''
      const heading = article.match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/iu)?.[1] ?? ''
      const anchor = (heading || article).match(
        /<a\b[^>]*href=["'][^"']+["'][^>]*>[\s\S]*?<\/a>/iu
      )?.[0]
      if (!anchor) throw new Error('Article has no link')
      const url = httpsUrl(attribute(anchor, 'href'), document.endpoint)
      const title = plainText(heading || anchor, 500)
      if (!title) throw new Error('Article has no title')
      const timeTag = article.match(/<time\b[^>]*>/iu)?.[0] ?? ''
      const publishedAt = isoDate(attribute(timeTag, 'datetime'))
      const paragraph = article.match(/<p\b[^>]*>([\s\S]*?)<\/p>/iu)?.[1] ?? title
      items.push(
        normalizeConfiguredItem({
          id: url,
          sourceId: document.sourceId,
          externalId: url,
          kind: 'article',
          title,
          summary: plainText(paragraph, 10_000),
          url,
          publishedAt,
          authors: [],
          tags: [],
          metrics: {}
        })
      )
    } catch {
      rejectedCount += 1
    }
  }
  return { items, rejectedCount }
}

export function normalizeHtmlDocument(document: ConfiguredHttpDocument): NormalizedSourceBatch {
  if (document.transport !== 'html') throw new Error('Expected a configured HTML document')
  const items: DiscoveryItem[] = []
  let rejectedCount = 0
  const scripts = document.body.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu
  )
  for (const match of scripts) {
    try {
      const payload = JSON.parse(match[1] ?? '') as unknown
      for (const node of jsonLdNodes(payload).filter(isArticleNode).slice(0, MAX_ENTRIES)) {
        try {
          const url = jsonLdUrl(node, document.endpoint)
          const title = plainText(node.headline ?? node.name, 500)
          if (!title) throw new Error('Article has no title')
          const publishedAt = isoDate(node.datePublished ?? node.dateModified)
          items.push(
            normalizeConfiguredItem({
              id: url,
              sourceId: document.sourceId,
              externalId: url,
              kind: 'article',
              title,
              summary: plainText(node.description ?? title, 10_000),
              url,
              publishedAt,
              authors: jsonLdAuthors(node.author),
              tags: arrayify(node.keywords)
                .flatMap((keyword) => scalar(keyword).split(','))
                .map((keyword) => plainText(keyword, 200))
                .filter(Boolean),
              metrics: {}
            })
          )
        } catch {
          rejectedCount += 1
        }
      }
    } catch {
      rejectedCount += 1
    }
  }
  if (document.contentType === 'application/json') {
    try {
      const payload = JSON.parse(document.body) as unknown
      for (const node of jsonLdNodes(payload).filter(isArticleNode).slice(0, MAX_ENTRIES)) {
        const url = jsonLdUrl(node, document.endpoint)
        items.push(
          normalizeConfiguredItem({
            id: url,
            sourceId: document.sourceId,
            externalId: url,
            kind: 'article',
            title: plainText(node.headline ?? node.name, 500),
            summary: plainText(node.description ?? node.headline ?? node.name, 10_000),
            url,
            publishedAt: isoDate(node.datePublished ?? node.dateModified),
            authors: jsonLdAuthors(node.author),
            tags: [],
            metrics: {}
          })
        )
      }
    } catch {
      rejectedCount += 1
    }
  }
  const semantic = semanticArticleItems(document)
  return {
    items: deduplicate([...items, ...semantic.items]),
    rejectedCount: rejectedCount + semantic.rejectedCount
  }
}

function deduplicate(items: readonly DiscoveryItem[]): DiscoveryItem[] {
  return [...new Map(items.map((item) => [item.url, item])).values()]
}

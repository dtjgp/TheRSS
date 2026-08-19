import type { DiscoveryItem } from '../../../shared/discovery'
import type { ConfiguredHttpDocument } from './configuredHttpClient'
import { normalizeConfiguredItem, type NormalizedSourceBatch } from './sourceNormalizer'

const MAX_ENTRIES = 100
const MAX_FUTURE_DRIFT_MS = 7 * 24 * 60 * 60 * 1_000

function attribute(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'iu'))
  return match?.[1]?.trim() ?? ''
}

function decodeEntities(value: string): string {
  return value
    .replaceAll(/&#(\d+);/gu, (_match, digits: string) =>
      String.fromCodePoint(Number.parseInt(digits, 10))
    )
    .replaceAll(/&#x([\da-f]+);/giu, (_match, digits: string) =>
      String.fromCodePoint(Number.parseInt(digits, 16))
    )
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
}

function plainText(value: string, maxLength: number): string {
  return decodeEntities(value)
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replaceAll(/<[^>]+>/gu, ' ')
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .slice(0, maxLength)
}

function publicationDate(value: string, retrievedAt: string): string {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})$/u)
  const retrieved = new Date(retrievedAt)
  if (!match || !Number.isFinite(retrieved.getTime())) {
    throw new Error('C114 entry has no valid publication date')
  }
  const month = Number(match[1])
  const day = Number(match[2])
  let year = retrieved.getUTCFullYear()
  let candidate = new Date(Date.UTC(year, month - 1, day))
  if (candidate.getTime() > retrieved.getTime() + MAX_FUTURE_DRIFT_MS) {
    year -= 1
    candidate = new Date(Date.UTC(year, month - 1, day))
  }
  if (candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
    throw new Error('C114 entry has no valid publication date')
  }
  return candidate.toISOString()
}

function listingSegments(body: string): readonly string[] {
  return body
    .split(/<div\b[^>]*class=["'][^"']*\b(?:contentList|center_list)\b[^"']*["'][^>]*>/iu)
    .slice(1, MAX_ENTRIES + 1)
}

function listingAnchor(segment: string): { readonly tag: string; readonly title: string } {
  for (const match of segment.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/giu)) {
    const anchorBody = match[2] ?? ''
    const titleBlock = anchorBody.match(
      /<[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/iu
    )?.[1]
    const title = plainText(titleBlock ?? anchorBody, 500)
    if (title) return { tag: match[1] ?? '', title }
  }
  throw new Error('C114 entry has no titled link')
}

function listingDate(segment: string): string {
  const timeBlock = segment.match(
    /<[^>]*class=["'][^"']*\btime\b[^"']*["'][^>]*>([\s\S]*?)(?:<\/[^>]+>|$)/iu
  )?.[1]
  const candidate = (timeBlock ?? segment).match(/\b\d{1,2}\/\d{1,2}\b/u)?.[0]
  if (!candidate) throw new Error('C114 entry has no date')
  return candidate
}

export function normalizeC114Document(document: ConfiguredHttpDocument): NormalizedSourceBatch {
  if (document.sourceId !== 'folo:523' || document.transport !== 'html') {
    throw new Error('Expected a C114 HTML document')
  }

  const items: DiscoveryItem[] = []
  let rejectedCount = 0
  for (const segment of listingSegments(document.body)) {
    try {
      const anchor = listingAnchor(segment)
      const url = new URL(attribute(anchor.tag, 'href'), document.endpoint)
      if (url.protocol !== 'https:' || url.username || url.password) {
        throw new Error('C114 entry URL must use credential-free HTTPS')
      }
      const publishedAt = publicationDate(listingDate(segment), document.retrievedAt)
      items.push(
        normalizeConfiguredItem({
          id: url.toString(),
          sourceId: document.sourceId,
          externalId: url.toString(),
          kind: 'article',
          title: anchor.title,
          summary: anchor.title,
          url: url.toString(),
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

  return {
    items: [...new Map(items.map((item) => [item.url, item])).values()],
    rejectedCount
  }
}

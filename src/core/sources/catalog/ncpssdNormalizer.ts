import type { ConfiguredHttpDocument } from './configuredHttpClient'
import { normalizeConfiguredItem, type NormalizedSourceBatch } from './sourceNormalizer'

function decodeHtml(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function plainText(value: string, maximum: number): string {
  return decodeHtml(value)
    .replaceAll(/<[^>]+>/gu, ' ')
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .slice(0, maximum)
}

function attribute(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'iu'))
  return decodeHtml((match?.[1] ?? match?.[2] ?? '').trim())
}

export function normalizeNcpssdDocument(document: ConfiguredHttpDocument): NormalizedSourceBatch {
  if (
    document.sourceId !== 'folo:611' ||
    document.transport !== 'html' ||
    !['www.ncpssd.cn', 'm.ncpssd.cn'].includes(new URL(document.endpoint).hostname)
  ) {
    throw new Error('Expected the NCPSD source document')
  }

  const latestList = document.body.match(
    /<ul\b[^>]*class=["'][^"']*\blatest-list\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/iu
  )?.[1]
  if (!latestList) return { items: [], rejectedCount: 0 }
  const items = []
  let rejectedCount = 0
  let entryCount = 0
  for (const match of latestList.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/giu)) {
    if (entryCount >= 100) break
    entryCount += 1
    try {
      const itemHtml = match[1] ?? ''
      const anchor = itemHtml.match(/<a\b[^>]*>[\s\S]*?<\/a>/iu)?.[0]
      if (!anchor) throw new Error('NCPSD entry has no anchor')
      const onclick = attribute(anchor, 'onclick')
      const path = onclick.match(/openDetail\(\s*['"]([^'"]+)['"]\s*\)/iu)?.[1]
      if (!path) throw new Error('NCPSD entry has no fixed detail route')
      const title = plainText(attribute(anchor, 'title') || anchor, 500)
      const summary = plainText(
        itemHtml.match(/<span\b[^>]*>([\s\S]*?)<\/span>/iu)?.[1] ?? '',
        1_000
      )
      const month = summary.match(/(\d{4})年(\d{1,2})月/u)
      if (!title || !month) throw new Error('NCPSD entry is missing title or publication month')
      const url = new URL(decodeHtml(path), document.endpoint)
      if (url.protocol !== 'https:' || url.origin !== new URL(document.endpoint).origin) {
        throw new Error('NCPSD detail route is outside the fixed official origin')
      }
      const publishedAt = new Date(
        Date.UTC(Number(month[1]), Number(month[2]) - 1, 1)
      ).toISOString()
      items.push(
        normalizeConfiguredItem({
          id: url.toString(),
          sourceId: document.sourceId,
          externalId: url.toString(),
          kind: 'paper',
          title,
          summary,
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
  return { items, rejectedCount }
}

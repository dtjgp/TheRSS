import { Buffer } from 'node:buffer'
import type { ConfiguredHttpDocument } from './configuredHttpClient'
import type { ConfiguredSourceItem } from './configuredSourceItem'
import { normalizeConfiguredItem, type NormalizedSourceBatch } from './sourceNormalizer'
import { readInitialArticles } from './reactFlightList'

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid news record')
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
function positiveId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Invalid news identifier')
  }
  return value
}

// These official Chinese lists publish complete local times without an offset (UTC+08:00).
function chinaDate(value: unknown): string {
  const match = text(value).match(
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})(?::(\d{2}))?(?:\s+(?:分享|发布))?$/u
  )
  if (!match) throw new Error('News entry has no complete publication date')
  const local = `${match[1]}T${match[2]}:${match[3] ?? '00'}`
  const timestamp = Date.parse(`${local}+08:00`)
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp + 8 * 3_600_000).toISOString() !== `${local}.000Z`
  ) {
    throw new Error('News entry has an invalid calendar date')
  }
  return new Date(timestamp).toISOString()
}
function strings(values: unknown, key: string): string[] {
  if (!Array.isArray(values)) return []
  return values
    .slice(0, 50)
    .flatMap((value) =>
      value && typeof value === 'object' && key in value ? [text(value[key])] : []
    )
}

function list(document: ConfiguredHttpDocument): readonly unknown[] {
  if (Buffer.byteLength(document.body) > 5_000_000)
    throw new Error('Official news exceeds safety limit')
  if (document.sourceId === 'folo:67') return readInitialArticles(document.body)
  const payload = record(JSON.parse(document.body))
  const rows =
    document.sourceId === 'folo:302'
      ? payload.code === 0 && payload.data
      : payload.code === 10000 && record(payload.data).items
  if (!Array.isArray(rows)) throw new Error('Official news API did not return a successful list')
  return rows.slice(0, 100)
}
function entry(sourceId: string, value: unknown): ConfiguredSourceItem {
  const row = record(value)
  let url: string, title: string, summary: string, publishedAt: string
  let authors: string[]
  let tags: string[] = []
  if (sourceId === 'folo:302') {
    if (row.is_event !== false) throw new Error('Event start time is not a publication date')
    const info = record(row.story_info)
    url = `https://hub.baai.ac.cn/view/${positiveId(row.story_id)}`
    title = text(info.title)
    summary = text(info.content)
    publishedAt = chinaDate(info.created_at)
    authors = [text(info.user_name)]
    tags = strings(info.tag_names, 'title')
  } else if (sourceId === 'folo:93') {
    url = `https://www.mittrchina.com/news/detail/${positiveId(row.id)}`
    title = text(row.name)
    summary = text(row.summary)
    publishedAt = new Date(positiveId(row.start_time) * 1000).toISOString()
    authors = strings(row.authors, 'username')
    tags = [text(row.typeName)]
  } else {
    url = `https://www.aibase.com/zh/news/${positiveId(row.Id)}`
    title = text(row.title)
    // summary may be a React reference such as "$1e"; description is the public list excerpt.
    summary = text(row.description)
    publishedAt = chinaDate(row.addtime)
    authors = [text(row.author)]
  }
  return {
    id: url,
    externalId: url,
    sourceId,
    kind: 'article',
    title,
    summary,
    url,
    publishedAt,
    authors,
    tags,
    metrics: {}
  }
}

export function normalizeOfficialNews(document: ConfiguredHttpDocument): NormalizedSourceBatch {
  const items = new Map<string, ReturnType<typeof normalizeConfiguredItem>>()
  let rejectedCount = 0
  for (const row of list(document)) {
    try {
      const item = normalizeConfiguredItem(entry(document.sourceId, row))
      items.set(item.id, item)
    } catch {
      rejectedCount++
    }
  }
  return { items: [...items.values()], rejectedCount }
}

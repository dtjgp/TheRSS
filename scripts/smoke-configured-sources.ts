import { log } from 'node:console'
import { CONFIGURED_SOURCE_DEFINITIONS } from '../src/core/sources/catalog/configuredSources'
import { fetchConfiguredSourceBatch } from '../src/core/sources/catalog/configuredSourceAdapter'
import type { InterestProfile } from '../src/core/interests/interestProfile'
import { localDateKey } from '../src/shared/date'

interface SmokeResult {
  readonly sourceId: string
  readonly status: 'fetched' | 'no_posts' | 'failed' | 'skipped'
  readonly detail: string
}

const xQuery = process.env.THERSS_SMOKE_X_QUERY?.trim()
const now = new Date()
const profile: InterestProfile = {
  name: 'Configured-source live smoke',
  arxiv: {
    categories: ['cs.AI', 'cs.LG', 'cs.NI', 'eess.SY'],
    keywords: xQuery ? [xQuery] : ['edge ai', 'model compression', 'energy markets'],
    excludeKeywords: []
  },
  github: {
    keywords: ['green ai', 'demand response'],
    topics: ['edge-ai', 'smart-grid'],
    languages: []
  }
}
const fetchOptions = {
  now,
  ...(process.env.THERSS_HUGGINGFACE_TOKEN?.trim()
    ? { huggingFaceToken: process.env.THERSS_HUGGINGFACE_TOKEN.trim() }
    : {})
}
const results: SmokeResult[] = []
const definitions = CONFIGURED_SOURCE_DEFINITIONS.filter(
  (source) => source.transport !== 'xapi' || Boolean(xQuery)
)

for (let offset = 0; offset < definitions.length; offset += 3) {
  const batch = definitions.slice(offset, offset + 3)
  const settled = await Promise.allSettled(
    batch.map((source) => fetchConfiguredSourceBatch(source, profile, fetchOptions))
  )
  settled.forEach((result, index) => {
    const source = batch[index]!
    if (result.status === 'rejected') {
      results.push({
        sourceId: source.id,
        status: 'failed',
        detail: (result.reason instanceof Error ? result.reason.message : 'Unknown error').slice(
          0,
          300
        )
      })
      return
    }
    const newest = [...result.value.items].sort(
      (left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt)
    )[0]
    const todayCount = result.value.items.filter(
      (item) => localDateKey(new Date(item.publishedAt)) === localDateKey(now)
    ).length
    results.push({
      sourceId: source.id,
      status: result.value.items.length > 0 ? 'fetched' : 'no_posts',
      detail: `${result.value.items.length} normalized; ${todayCount} dated today; latest=${newest?.publishedAt ?? 'none'}; rejected=${result.value.rejectedCount}`
    })
  })
}

if (!xQuery) {
  results.push({
    sourceId: 'folo:2',
    status: 'skipped',
    detail: 'Set THERSS_SMOKE_X_QUERY to opt in to a potentially metered xapi call'
  })
}

results.forEach((result) => log(`${result.sourceId}\t${result.status}\t${result.detail}`))
const failures = results.filter((result) => result.status === 'failed')
if (failures.length > 0) {
  throw new Error(`Configured source smoke failed for ${failures.length} source(s)`)
}

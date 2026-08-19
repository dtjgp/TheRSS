import type Database from 'better-sqlite3'
import type { AnalyticsSnapshot } from '../../shared/analytics'
import { localDateKey } from '../../shared/date'
import type { DiscoverySource } from '../../shared/discovery'

interface SourceSearchEventRow {
  completed_at: string
  result_count: number
}

interface DiscoverActivityRow {
  created_at: string
  result_count: number
}

interface AnalyticsAnalysisRow {
  analysis_id: string
  item_id: string
  source: DiscoverySource
  item_kind: string
  title: string
  url: string
  provider_name: string
  model: string
  created_at: string
}

export function buildAnalyticsSnapshot(
  database: Database.Database,
  now = new Date(),
  windowDays = 7
): AnalyticsSnapshot {
  if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 90) {
    throw new Error('Analytics window must be between 1 and 90 days')
  }

  const generatedAt = now.toISOString()
  const dateKeys = Array.from({ length: windowDays }, (_value, index) => {
    const offset = windowDays - index - 1
    return localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset))
  })
  const todayActivity = database
    .prepare(
      `SELECT completed_at, result_count
       FROM source_search_event
       ORDER BY completed_at ASC, id ASC`
    )
    .all() as SourceSearchEventRow[]
  const discoverActivity = database
    .prepare(
      `SELECT s.created_at, COUNT(r.item_id) AS result_count
       FROM discover_session s
       LEFT JOIN discover_result r ON r.session_id = s.id
       GROUP BY s.id, s.created_at
       ORDER BY s.created_at ASC, s.id ASC`
    )
    .all() as DiscoverActivityRow[]
  const analysisActivity = database
    .prepare(
      `SELECT a.id AS analysis_id, a.item_id, d.source, d.item_kind, d.title, d.url,
              a.provider_name, a.model, a.created_at
       FROM analysis_artifact a
       INNER JOIN discovery_item d ON d.id = a.item_id
       ORDER BY a.created_at DESC, a.id DESC`
    )
    .all() as AnalyticsAnalysisRow[]

  const dateFor = (timestamp: string) => localDateKey(new Date(timestamp))
  const todayResults = todayActivity.reduce((total, row) => total + row.result_count, 0)
  const discoverResults = discoverActivity.reduce((total, row) => total + row.result_count, 0)
  const daily = dateKeys.map((date) => {
    const dailyTodayResults = todayActivity
      .filter((row) => dateFor(row.completed_at) === date)
      .reduce((total, row) => total + row.result_count, 0)
    const dailyDiscoverResults = discoverActivity
      .filter((row) => dateFor(row.created_at) === date)
      .reduce((total, row) => total + row.result_count, 0)
    const deepAnalyses = analysisActivity.filter((row) => dateFor(row.created_at) === date).length
    return {
      date,
      searchResults: dailyTodayResults + dailyDiscoverResults,
      todayResults: dailyTodayResults,
      discoverResults: dailyDiscoverResults,
      deepAnalyses
    }
  })

  return {
    generatedAt,
    windowDays,
    trackingStartedAt: todayActivity[0]?.completed_at ?? null,
    totals: {
      searchResults: todayResults + discoverResults,
      todayResults,
      discoverResults,
      deepAnalyses: analysisActivity.length,
      analyzedPapers: new Set(
        analysisActivity.filter((row) => row.item_kind === 'paper').map((row) => row.item_id)
      ).size
    },
    daily,
    analyzedItems: analysisActivity.slice(0, 50).map((row) => ({
      analysisId: row.analysis_id,
      itemId: row.item_id,
      source: row.source,
      title: row.title,
      url: row.url,
      providerName: row.provider_name,
      model: row.model,
      createdAt: row.created_at
    }))
  }
}

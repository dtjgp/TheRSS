import type { DiscoverySource } from './discovery'

export interface DailyAnalyticsPoint {
  readonly date: string
  readonly searchResults: number
  readonly todayResults: number
  readonly discoverResults: number
  readonly deepAnalyses: number
}

export interface AnalyzedItemActivity {
  readonly analysisId: string
  readonly itemId: string
  readonly source: DiscoverySource
  readonly title: string
  readonly url: string
  readonly providerName: string
  readonly model: string
  readonly createdAt: string
}

export interface AnalyticsSnapshot {
  readonly generatedAt: string
  readonly windowDays: number
  readonly trackingStartedAt: string | null
  readonly totals: {
    readonly searchResults: number
    readonly todayResults: number
    readonly discoverResults: number
    readonly deepAnalyses: number
    readonly analyzedPapers: number
  }
  readonly daily: readonly DailyAnalyticsPoint[]
  readonly analyzedItems: readonly AnalyzedItemActivity[]
}

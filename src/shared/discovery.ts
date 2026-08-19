export type DiscoverySource = 'arxiv' | 'github' | `folo:${number}`
export type DiscoveryItemKind = 'paper' | 'repository' | 'article' | 'model' | 'dataset' | 'post'

export interface DiscoveryItemMetrics {
  readonly downloads?: number
  readonly likes?: number
}

export interface DiscoveryItem {
  readonly id: string
  readonly source: DiscoverySource
  readonly kind: DiscoveryItemKind
  readonly externalId: string
  readonly title: string
  readonly summary: string
  readonly url: string
  readonly publishedAt: string
  readonly updatedAt: string
  readonly authors: readonly string[]
  readonly categories: readonly string[]
  readonly topics: readonly string[]
  readonly language: string | null
  readonly stars: number | null
  readonly metrics: DiscoveryItemMetrics
}

export type MatchReasonKind =
  'keyword' | 'category' | 'topic' | 'language' | 'recency' | 'popularity' | 'exclusion'

export interface MatchReason {
  readonly kind: MatchReasonKind
  readonly value: string
  readonly field?: 'title' | 'summary'
  readonly weight: number
  readonly label: string
}

export interface RankedDiscoveryItem {
  readonly item: DiscoveryItem
  readonly score: number
  readonly excluded: boolean
  readonly reasons: readonly MatchReason[]
}

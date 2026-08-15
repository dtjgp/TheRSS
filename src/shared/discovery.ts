export type DiscoverySource = 'arxiv' | 'github'

export interface DiscoveryItem {
  readonly id: string
  readonly source: DiscoverySource
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

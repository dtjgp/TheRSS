import { z } from 'zod'
import type { DiscoverySource } from './discovery'

export const localSearchQuerySchema = z.string().trim().min(2).max(200)

export type LocalSearchResultKind = 'saved' | 'discover' | 'analysis'

export interface LocalSearchResult {
  readonly id: string
  readonly kind: LocalSearchResultKind
  readonly itemId: string
  readonly title: string
  readonly detail: string
  readonly url: string
  readonly source: DiscoverySource
  readonly createdAt: string
}

export interface LocalSearchResponse {
  readonly query: string
  readonly results: readonly LocalSearchResult[]
}

import { z } from 'zod'
import type { DiscoverySource } from './discovery'
import type { LocalResearchTarget } from './localResearch'

export const localSearchQuerySchema = z.string().trim().min(2).max(200)

/** Which local records a search reads. `all` keeps the bounded mixed search. */
export const localSearchScopeSchema = z.enum(['all', 'saved', 'discover', 'analysis'])
export type LocalSearchScope = z.infer<typeof localSearchScopeSchema>
/** An omitted scope is `all`; any other value must be a supported scope. */
export const optionalLocalSearchScopeSchema = localSearchScopeSchema.optional().default('all')

/** `all` lists at most this many records of each kind. */
export const LOCAL_SEARCH_KIND_LIMIT = 25
/** Any search lists at most this many records. */
export const LOCAL_SEARCH_RESULT_LIMIT = 50

/**
 * Explains why some matches are hidden. Show it only when the query layer reported truncation.
 * `canChooseScope` is false on a surface without a scope control.
 */
export function localSearchTruncationText(
  scope: LocalSearchScope,
  canChooseScope: boolean
): string {
  if (scope !== 'all')
    return `Not every match is shown. This scope lists the ${LOCAL_SEARCH_RESULT_LIMIT} newest matches. Refine the search to see older matches.`
  return `Not every match is shown. ${canChooseScope ? 'All' : 'Search'} lists up to ${LOCAL_SEARCH_KIND_LIMIT} newest matches of each kind and ${LOCAL_SEARCH_RESULT_LIMIT} in total. ${canChooseScope ? 'Choose a scope or refine' : 'Refine'} the search to see older matches.`
}

export type LocalSearchResultKind = 'saved' | 'discover' | 'analysis'

export interface LocalSearchResult {
  readonly target: LocalResearchTarget
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
  readonly scope: LocalSearchScope
  readonly results: readonly LocalSearchResult[]
  /** True only when more matching records exist than a kind or result limit lists. */
  readonly truncated: boolean
}

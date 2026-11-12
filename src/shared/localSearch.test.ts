import { describe, expect, it } from 'vitest'
import { localSearchTruncationText, optionalLocalSearchScopeSchema } from './localSearch'

describe('local search contract', () => {
  it('defaults an omitted scope to all and rejects unsupported scopes', () => {
    expect(optionalLocalSearchScopeSchema.parse(undefined)).toBe('all')
    expect(optionalLocalSearchScopeSchema.parse('saved')).toBe('saved')
    for (const scope of [null, 'recent', 'SAVED', 1])
      expect(optionalLocalSearchScopeSchema.safeParse(scope).success).toBe(false)
  })

  it('names the limit that hid matches for each surface', () => {
    expect(localSearchTruncationText('all', true)).toBe(
      'Not every match is shown. All lists up to 25 newest matches of each kind and 50 in total. Choose a scope or refine the search to see older matches.'
    )
    expect(localSearchTruncationText('all', false)).toBe(
      'Not every match is shown. Search lists up to 25 newest matches of each kind and 50 in total. Refine the search to see older matches.'
    )
    expect(localSearchTruncationText('discover', false)).toBe(
      'Not every match is shown. This scope lists the 50 newest matches. Refine the search to see older matches.'
    )
  })
})

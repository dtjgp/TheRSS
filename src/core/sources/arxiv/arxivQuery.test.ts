import { describe, expect, it } from 'vitest'
import { buildArxivQueryUrl, buildArxivSearchExpression } from './arxivQuery'

describe('arXiv query construction', () => {
  it('combines categories, keywords, and exclusions explicitly', () => {
    const expression = buildArxivSearchExpression({
      categories: ['cs.AI', 'cs.LG'],
      keywords: ['edge intelligence', 'structured pruning'],
      excludeKeywords: ['medical imaging']
    })

    expect(expression).toBe(
      '(cat:cs.AI OR cat:cs.LG) AND (all:"edge intelligence" OR all:"structured pruning") ANDNOT all:"medical imaging"'
    )
  })

  it('builds a bounded newest-first Atom query URL', () => {
    const url = new URL(
      buildArxivQueryUrl({ categories: ['cs.AI'], keywords: ['pruning'], excludeKeywords: [] }, 40)
    )

    expect(url.origin).toBe('https://export.arxiv.org')
    expect(url.pathname).toBe('/api/query')
    expect(url.searchParams.get('search_query')).toBe('(cat:cs.AI) AND (all:pruning)')
    expect(url.searchParams.get('sortBy')).toBe('submittedDate')
    expect(url.searchParams.get('sortOrder')).toBe('descending')
    expect(url.searchParams.get('max_results')).toBe('40')
  })

  it('rejects result limits outside the application safety bound', () => {
    expect(() =>
      buildArxivQueryUrl({ categories: ['cs.AI'], keywords: [], excludeKeywords: [] }, 201)
    ).toThrow(/between 1 and 200/)
  })
})

import { describe, expect, it } from 'vitest'
import {
  researchKindSymbol,
  researchMetadata,
  researchRowGlyph,
  researchSubtitle
} from './researchMetadata'
import { nativeDiscoverFixture } from './testSupport'

describe('readable research metadata without changing evidence', () => {
  it('names every research kind with one SF Symbol and an accessible label', () => {
    const kinds = ['paper', 'repository', 'article', 'model', 'dataset', 'post'] as const
    const glyphs = kinds.map((kind) => researchKindSymbol(kind))
    expect(glyphs).toEqual([
      { symbol: 'doc.text', label: 'Paper' },
      { symbol: 'chevron.left.forwardslash.chevron.right', label: 'Repository' },
      { symbol: 'newspaper', label: 'Article' },
      { symbol: 'cpu', label: 'Model' },
      { symbol: 'tablecells', label: 'Dataset' },
      { symbol: 'text.bubble', label: 'Post' }
    ])
    expect(researchRowGlyph('model')).toEqual({ symbol: 'cpu', symbolLabel: 'Model' })
    expect(researchRowGlyph(undefined), 'An item without a recorded kind has no glyph').toEqual({})
  })
  it('does not render a month sorting anchor as an exact publication or update day', () => {
    const monthly = {
      ...nativeDiscoverFixture.items[0]!,
      source: 'folo:611' as const,
      summary: '《研究期刊》2026年8月',
      publishedAt: '2026-08-01T00:00:00.000Z'
    }
    expect(researchSubtitle(monthly)).toContain('2026-08 (month only)')
    expect(researchMetadata(monthly)).toContain('exact day unavailable')
    expect(researchMetadata(monthly)).not.toContain('Published: 2026-08-01')
    expect(researchMetadata(monthly)).toContain('Updated: Not supplied separately')
  })
  it('shows paper fields without repository placeholders and keeps exact provenance timestamps', () => {
    const paper = nativeDiscoverFixture.items[0]!
    const text = researchMetadata(paper)
    expect(text).toContain('Authors: Fixture')
    expect(text).toContain(`Published: ${paper.publishedAt}`)
    expect(text).not.toContain('Stars:')
    expect(text).not.toContain('Language:')
    expect(researchSubtitle(paper)).toBe('arXiv · 2026-09-06')
    expect(paper.score).toBe(10)
  })
  it('preserves zero metrics and complete source-provided labels for repositories and models', () => {
    const item = {
      ...nativeDiscoverFixture.items[0]!,
      kind: 'repository' as const,
      topics: ['edge'],
      language: 'C++',
      stars: 0,
      metrics: { likes: 0, downloads: 3 }
    }
    const text = researchMetadata(item)
    expect(text).toContain('Topics: edge')
    expect(text).toContain('Language: C++')
    expect(text).toContain('Stars: 0')
    expect(text).toContain('Likes: 0')
    expect(text).toContain('Downloads: 3')
  })
})

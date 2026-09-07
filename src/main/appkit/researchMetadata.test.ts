import { describe, expect, it } from 'vitest'
import { researchMetadata, researchSubtitle } from './researchMetadata'
import { nativeDiscoverFixture } from './testSupport'

describe('readable research metadata without changing evidence', () => {
  it('shows paper fields without repository placeholders and keeps exact provenance timestamps', () => {
    const paper = nativeDiscoverFixture.items[0]!
    const text = researchMetadata(paper)
    expect(text).toContain('Authors: Fixture')
    expect(text).toContain(`Published: ${paper.publishedAt}`)
    expect(text).not.toContain('Stars:')
    expect(text).not.toContain('Language:')
    expect(researchSubtitle(paper, true)).toBe('arXiv · 2026-09-06 · Saved')
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

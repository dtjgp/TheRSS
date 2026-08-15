import { describe, expect, it } from 'vitest'
import type { DiscoveryItem } from '../../shared/discovery'
import type { InterestProfile } from '../interests/interestProfile'
import { rankDiscoveryItem } from './rankDiscoveryItem'

const profile: InterestProfile = {
  name: 'Compression',
  arxiv: {
    categories: ['cs.LG'],
    keywords: ['structured pruning', 'edge'],
    excludeKeywords: ['medical imaging']
  },
  github: {
    keywords: ['structured pruning'],
    topics: ['model-compression'],
    languages: ['Python']
  }
}

const baseItem: DiscoveryItem = {
  id: 'arxiv:2608.00001',
  source: 'arxiv',
  externalId: '2608.00001',
  title: 'Structured pruning for edge deployment',
  summary: 'A resource-aware method for neural networks.',
  url: 'https://arxiv.org/abs/2608.00001',
  publishedAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
  authors: ['Ada Researcher'],
  categories: ['cs.LG'],
  topics: [],
  language: null,
  stars: null
}

describe('rankDiscoveryItem', () => {
  it('returns deterministic score and visible match reasons', () => {
    const result = rankDiscoveryItem(baseItem, profile, new Date('2026-08-15T00:00:00Z'))

    expect(result.score).toBeGreaterThan(0)
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'keyword', field: 'title', value: 'structured pruning' }),
        expect.objectContaining({ kind: 'category', value: 'cs.LG' }),
        expect.objectContaining({ kind: 'recency' })
      ])
    )
  })

  it('marks excluded content without mutating the input item', () => {
    const item = {
      ...baseItem,
      summary: 'Applied to medical imaging datasets.'
    }
    const before = structuredClone(item)

    const result = rankDiscoveryItem(item, profile, new Date('2026-08-15T00:00:00Z'))

    expect(result.excluded).toBe(true)
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'exclusion', value: 'medical imaging' })
      ])
    )
    expect(item).toEqual(before)
  })

  it('scores a matching GitHub repository using topic and language signals', () => {
    const repository: DiscoveryItem = {
      ...baseItem,
      id: 'github:owner/repo',
      source: 'github',
      externalId: 'owner/repo',
      url: 'https://github.com/owner/repo',
      categories: [],
      topics: ['model-compression'],
      language: 'Python',
      stars: 420
    }

    const result = rankDiscoveryItem(repository, profile, new Date('2026-08-15T00:00:00Z'))

    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'topic', value: 'model-compression' }),
        expect.objectContaining({ kind: 'language', value: 'Python' }),
        expect.objectContaining({ kind: 'popularity' })
      ])
    )
  })

  it.each([
    ['2026-08-15T00:00:00.000Z', 'Published today'],
    ['2026-08-12T00:00:00.000Z', 'Published 3 days ago'],
    ['2026-08-05T00:00:00.000Z', 'Published 10 days ago']
  ])('explains the recency band for %s', (updatedAt, label) => {
    const result = rankDiscoveryItem(
      { ...baseItem, updatedAt },
      profile,
      new Date('2026-08-15T00:00:00Z')
    )

    expect(result.reasons).toContainEqual(expect.objectContaining({ kind: 'recency', label }))
  })

  it('handles invalid dates, zero popularity and summary-only matches without false signals', () => {
    const result = rankDiscoveryItem(
      {
        ...baseItem,
        title: 'A general deployment method',
        summary: 'Designed for the edge.',
        categories: [],
        updatedAt: 'not-a-date',
        publishedAt: 'not-a-date',
        stars: 0
      },
      profile,
      new Date('2026-08-15T00:00:00Z')
    )

    expect(result.reasons).toContainEqual(
      expect.objectContaining({ kind: 'keyword', field: 'summary', value: 'edge' })
    )
    expect(result.reasons.some((reason) => reason.kind === 'recency')).toBe(false)
    expect(result.reasons.some((reason) => reason.kind === 'popularity')).toBe(false)
  })
})

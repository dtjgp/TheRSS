import { describe, expect, it } from 'vitest'
import { interestProfileSchema } from './interestProfile'

describe('interestProfileSchema', () => {
  it('accepts a focused academic and GitHub interest profile', () => {
    const result = interestProfileSchema.parse({
      name: 'Edge intelligence',
      arxiv: {
        categories: ['cs.AI', 'cs.LG'],
        keywords: ['structured pruning', 'edge intelligence'],
        excludeKeywords: ['medical imaging']
      },
      github: {
        keywords: ['structured pruning'],
        topics: ['model-compression'],
        languages: ['Python']
      }
    })

    expect(result.name).toBe('Edge intelligence')
    expect(result.arxiv.categories).toEqual(['cs.AI', 'cs.LG'])
  })

  it('rejects a profile with no discovery rules', () => {
    const result = interestProfileSchema.safeParse({
      name: 'Empty',
      arxiv: { categories: [], keywords: [], excludeKeywords: [] },
      github: { keywords: [], topics: [], languages: [] }
    })

    expect(result.success).toBe(false)
  })

  it('normalizes duplicate rules and trims whitespace', () => {
    const result = interestProfileSchema.parse({
      name: '  Efficient AI  ',
      arxiv: {
        categories: ['cs.AI', 'cs.AI'],
        keywords: [' pruning ', 'Pruning'],
        excludeKeywords: []
      },
      github: { keywords: [], topics: [' edge-ai ', 'edge-ai'], languages: [] }
    })

    expect(result).toMatchObject({
      name: 'Efficient AI',
      arxiv: { categories: ['cs.AI'], keywords: ['pruning'] },
      github: { topics: ['edge-ai'] }
    })
  })
})

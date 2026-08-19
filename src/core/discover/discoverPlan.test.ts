import { describe, expect, it } from 'vitest'
import { parseDiscoverPlan } from './discoverPlan'

const validPlan = {
  version: 'discover-plan-v1',
  intentSummary: 'Structured pruning for communication-constrained edge intelligence',
  arxiv: {
    categories: ['cs.LG', 'cs.NI'],
    keywords: ['Structured Pruning', 'edge intelligence'],
    excludeKeywords: ['medical imaging']
  },
  github: {
    keywords: ['Model Compression', 'edge inference'],
    topics: ['edge-ai'],
    languages: ['Python']
  },
  rationale: 'Expand the intent across learning, networking, and deployable software terms.'
}

describe('parseDiscoverPlan', () => {
  it('parses strict JSON and normalizes duplicate expansion terms', () => {
    const parsed = parseDiscoverPlan(
      JSON.stringify({
        ...validPlan,
        arxiv: {
          ...validPlan.arxiv,
          keywords: [' Structured Pruning ', 'structured pruning', 'edge intelligence']
        }
      })
    )

    expect(parsed).toEqual({
      ...validPlan,
      arxiv: {
        ...validPlan.arxiv,
        keywords: ['structured pruning', 'edge intelligence']
      },
      github: {
        ...validPlan.github,
        keywords: ['model compression', 'edge inference']
      }
    })
  })

  it('accepts one exact JSON fence but rejects surrounding prose', () => {
    expect(parseDiscoverPlan(`\`\`\`json\n${JSON.stringify(validPlan)}\n\`\`\``)).toMatchObject({
      version: 'discover-plan-v1',
      intentSummary: validPlan.intentSummary
    })

    expect(() => parseDiscoverPlan(`Here is the plan:\n${JSON.stringify(validPlan)}`)).toThrow(
      'Discover planner returned an invalid search plan'
    )
  })

  it('rejects empty plans, unknown fields, unsafe qualifiers, and excessive fan-out', () => {
    expect(() =>
      parseDiscoverPlan(
        JSON.stringify({
          ...validPlan,
          arxiv: { categories: [], keywords: [], excludeKeywords: [] },
          github: { keywords: [], topics: [], languages: [] }
        })
      )
    ).toThrow('invalid search plan')

    expect(() =>
      parseDiscoverPlan(JSON.stringify({ ...validPlan, command: 'cat ~/.ssh/id_rsa' }))
    ).toThrow('invalid search plan')

    expect(() =>
      parseDiscoverPlan(
        JSON.stringify({
          ...validPlan,
          arxiv: { ...validPlan.arxiv, categories: ['file:///tmp/secret'] }
        })
      )
    ).toThrow('invalid search plan')

    expect(() =>
      parseDiscoverPlan(
        JSON.stringify({
          ...validPlan,
          github: { ...validPlan.github, keywords: ['model\u0000compression'] }
        })
      )
    ).toThrow('invalid search plan')

    expect(() =>
      parseDiscoverPlan(
        JSON.stringify({
          ...validPlan,
          github: {
            keywords: ['one', 'two', 'three'],
            topics: ['four', 'five'],
            languages: ['Python', 'Rust']
          }
        })
      )
    ).toThrow('invalid search plan')
  })

  it('bounds invalid output errors without echoing model content', () => {
    const secretLikeText = 'private-token-value'
    let message = ''
    try {
      parseDiscoverPlan(secretLikeText)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message).toBe('Discover planner returned an invalid search plan')
    expect(message).not.toContain(secretLikeText)
    expect(() => parseDiscoverPlan('x'.repeat(20_001))).toThrow('invalid search plan')
  })
})

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

  it('keeps legacy plans without constraint groups unchanged', () => {
    const parsed = parseDiscoverPlan(JSON.stringify(validPlan))

    expect(parsed).not.toHaveProperty('constraintGroups')
  })

  it('normalizes bounded constraint groups into lowercase deduplicated facets', () => {
    const parsed = parseDiscoverPlan(
      JSON.stringify({
        ...validPlan,
        constraintGroups: [
          [' Training Energy ', 'carbon footprint', 'training energy'],
          ['Deadline-Aware Scheduling', 'job deadline'],
          ['gpu cluster'],
          ['a', 'b', 'c', 'd']
        ]
      })
    )

    expect(parsed.constraintGroups).toEqual([
      ['training energy', 'carbon footprint'],
      ['deadline-aware scheduling', 'job deadline'],
      ['gpu cluster'],
      ['a', 'b', 'c', 'd']
    ])
  })

  it.each([
    ['no groups', []],
    ['more than four groups', [['a'], ['b'], ['c'], ['d'], ['e']]],
    ['an empty group', [['energy'], []]],
    ['more than four terms in a group', [['a', 'b', 'c', 'd', 'e']]],
    ['a blank term', [['energy', '   ']]],
    ['a control character', [['energy\u0007cost']]],
    ['an overlong term', [['x'.repeat(101)]]],
    ['a non-array group', ['energy']],
    ['a leading tab', [['\tenergy']]],
    ['a trailing newline', [['energy\n']]],
    ['a C1 control character', [['energy\u0085cost']]],
    ['a term over 100 code units after lowercasing', [['İ'.repeat(100)]]],
    ['one term shared by two groups', [['Energy'], ['energy']]],
    [
      'one term shared inside larger groups',
      [
        ['carbon', 'energy'],
        ['Energy', 'deadline']
      ]
    ]
  ])('rejects constraint groups with %s', (_label, constraintGroups) => {
    expect(() => parseDiscoverPlan(JSON.stringify({ ...validPlan, constraintGroups }))).toThrow(
      'invalid search plan'
    )
  })

  it('round-trips an expanding-case constraint term within the length bound', () => {
    const parsed = parseDiscoverPlan(
      JSON.stringify({ ...validPlan, constraintGroups: [['İ'.repeat(50)], ['edge']] })
    )

    expect(parsed.constraintGroups?.[0]).toEqual(['i̇'.repeat(50)])
    expect(parseDiscoverPlan(JSON.stringify(parsed))).toEqual(parsed)
  })

  it('keeps trimming edge whitespace controls in legacy plan fields', () => {
    const parsed = parseDiscoverPlan(
      JSON.stringify({
        ...validPlan,
        arxiv: { ...validPlan.arxiv, keywords: ['\tStructured Pruning\n'] }
      })
    )

    expect(parsed.arxiv.keywords).toEqual(['structured pruning'])
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

import { describe, expect, it } from 'vitest'
import type { LlmWikiLibraryStatus } from './llmWikiLibrary'
import { llmWikiListBadge, matchesLlmWikiListFilter } from './llmWikiListFilter'

function status(overrides: Partial<LlmWikiLibraryStatus> = {}): LlmWikiLibraryStatus {
  return {
    arxivId: '2608.01234',
    status: 'not-found',
    checkedAt: '2026-11-21T10:00:00.000Z',
    recordPath: null,
    notePath: null,
    level: null,
    readStatus: null,
    reason: null,
    ...overrides
  }
}

describe('llmWikiListBadge', () => {
  it('returns null for non-eligible items regardless of cached status', () => {
    expect(llmWikiListBadge(undefined, false)).toBeNull()
    expect(llmWikiListBadge(status({ status: 'recorded' }), false)).toBeNull()
  })

  it('shows pending for eligible papers not yet checked', () => {
    expect(llmWikiListBadge(undefined, true)).toBe('llm-wiki: Pending')
  })

  it('distinguishes linked L1/L2 notes, generic notes, record-only, and fault states', () => {
    expect(
      llmWikiListBadge(
        status({
          status: 'recorded',
          notePath: 'Literature/Paper_Notes/L1_Deep_Read/Paper.md',
          level: 'L1'
        }),
        true
      )
    ).toBe('In llm-wiki · L1')
    expect(
      llmWikiListBadge(
        status({
          status: 'recorded',
          notePath: 'Literature/Paper_Notes/L2_Structured/Paper.md',
          level: 'L2'
        }),
        true
      )
    ).toBe('In llm-wiki · L2')
    expect(
      llmWikiListBadge(
        status({
          status: 'recorded',
          notePath: 'Literature/Paper_Notes/L2_Structured/Paper.md',
          level: null
        }),
        true
      )
    ).toBe('In llm-wiki · Note')
    expect(
      llmWikiListBadge(
        status({ status: 'recorded', recordPath: 'raw/paper_records/Paper.md', notePath: null }),
        true
      )
    ).toBe('In llm-wiki · Record only')
    expect(llmWikiListBadge(status({ status: 'note-missing' }), true)).toBe(
      'llm-wiki · Note missing'
    )
    expect(llmWikiListBadge(status({ status: 'ambiguous' }), true)).toBe('llm-wiki · Ambiguous')
    expect(llmWikiListBadge(status({ status: 'unavailable' }), true)).toBe('llm-wiki · Unavailable')
    expect(llmWikiListBadge(status({ status: 'not-found' }), true)).toBeNull()
  })
})

describe('matchesLlmWikiListFilter', () => {
  const recorded = status({ status: 'recorded', recordPath: 'raw/paper_records/Paper.md' })
  const absent = status({ status: 'not-found' })
  const unavailable = status({ status: 'unavailable' })

  it('partitions all items cleanly across collected and uncollected', () => {
    expect(matchesLlmWikiListFilter(recorded, true, 'all')).toBe(true)
    expect(matchesLlmWikiListFilter(recorded, true, 'collected')).toBe(true)
    expect(matchesLlmWikiListFilter(recorded, true, 'uncollected')).toBe(false)

    expect(matchesLlmWikiListFilter(absent, true, 'collected')).toBe(false)
    expect(matchesLlmWikiListFilter(absent, true, 'uncollected')).toBe(true)

    expect(matchesLlmWikiListFilter(undefined, true, 'collected')).toBe(false)
    expect(matchesLlmWikiListFilter(undefined, true, 'uncollected')).toBe(true)

    expect(matchesLlmWikiListFilter(unavailable, true, 'collected')).toBe(false)
    expect(matchesLlmWikiListFilter(unavailable, true, 'uncollected')).toBe(true)

    expect(matchesLlmWikiListFilter(recorded, false, 'collected')).toBe(false)
    expect(matchesLlmWikiListFilter(recorded, false, 'uncollected')).toBe(true)
  })
})

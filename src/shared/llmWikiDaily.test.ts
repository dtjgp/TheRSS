import { describe, expect, it } from 'vitest'
import {
  LLM_WIKI_DAILY_REFRESH_NOTE,
  llmWikiDailyEmptyState,
  type LlmWikiDailySnapshot
} from './llmWikiDaily'

const base = { requestedDate: '2026-11-12', checkedAt: '2026-11-12T08:00:00Z' } as const
const emptyEdition = { date: '2026-11-12', selected: 0, scanned: 40, papers: [] }

describe('Daily Papers empty states', () => {
  it.each([
    [
      'no-results',
      { ...base, status: 'no-results', edition: emptyEdition },
      'No papers selected',
      /^The scan completed and selected no papers for this edition\./u
    ],
    [
      'no-source',
      { ...base, status: 'no-source', edition: { ...emptyEdition, scanned: null } },
      'Announcement batch unavailable to the scan',
      /^The scan recorded that the arXiv announcement batch was not available to it\. This does not show that no relevant papers were announced\./u
    ],
    [
      'partial with no papers',
      { ...base, status: 'partial', edition: emptyEdition },
      'Scan incomplete; no papers selected',
      /^The scan did not finish, so this empty shortlist can be incomplete\./u
    ],
    [
      'missing',
      { ...base, status: 'missing', edition: null },
      'No daily edition found',
      /^The local llm-wiki vault has no Daily ArXiv Scan digest for 2026-11-12 or the prior 14 days\./u
    ],
    [
      'unavailable',
      { ...base, status: 'unavailable', edition: null },
      'Daily scan could not be read',
      /^The local llm-wiki vault or its latest digest could not be read safely\./u
    ],
    ['a failed read', null, 'Daily Papers could not be loaded', /^TheRSS could not get/u]
  ] as const)('explains %s and the Refresh boundary', (_name, snapshot, title, detail) => {
    const state = llmWikiDailyEmptyState(snapshot as LlmWikiDailySnapshot | null)
    expect(state?.title).toBe(title)
    expect(state?.detail).toMatch(detail)
    expect(state?.detail.endsWith(LLM_WIKI_DAILY_REFRESH_NOTE)).toBe(true)
    expect(LLM_WIKI_DAILY_REFRESH_NOTE).toBe(
      'Refresh rereads the local scan result. It does not run the scan.'
    )
  })

  it('never reads an unavailable announcement batch as an absence of relevant papers', () => {
    const state = llmWikiDailyEmptyState({
      ...base,
      status: 'no-source',
      edition: { ...emptyEdition, scanned: null }
    })
    expect(state?.title).not.toMatch(/no (relevant )?papers/iu)
    expect(state?.detail).not.toMatch(/no relevant papers (today|were found)/iu)
  })

  it('shows no empty state for an edition with papers', () => {
    expect(
      llmWikiDailyEmptyState({
        ...base,
        status: 'partial',
        edition: {
          ...emptyEdition,
          selected: 1,
          papers: [
            {
              arxivId: '2611.00001',
              title: 'Paper',
              priority: 'direct',
              score: 8,
              reason: null,
              canOpenNote: false
            }
          ]
        }
      })
    ).toBeNull()
  })
})

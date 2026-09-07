import { describe, expect, it } from 'vitest'
import { sourceHealthLabel, sourceObservationLabel } from './sourceHealth'

describe('recorded source feedback', () => {
  it('distinguishes no query matches from no source items and uses explicit state labels', () => {
    expect(sourceHealthLabel('no_results', 'discover')).toBe('No matches')
    expect(sourceHealthLabel('no_results', 'source')).toBe('No items')
    expect(
      ['healthy', 'partial', 'failed', 'refreshing', 'idle'].map((status) =>
        sourceHealthLabel(status as Parameters<typeof sourceHealthLabel>[0])
      )
    ).toEqual(['Retrieved', 'Partial', 'Failed', 'Refreshing', 'Not recorded'])
    expect(sourceHealthLabel(undefined)).toBe('Not recorded')
  })
  it('keeps observation context, a deterministic UTC date, and unknown dates explicit', () => {
    const detail = {
      status: 'no_results' as const,
      observedAt: '2026-09-07T16:35:34+02:00',
      errorMessage: null
    }
    expect(sourceObservationLabel({ ...detail, context: 'discover' })).toBe(
      'Latest search · 2026-09-07 14:35 UTC'
    )
    expect(sourceObservationLabel({ ...detail, context: 'source' })).toBe(
      'Last source read · 2026-09-07 14:35 UTC'
    )
    expect(sourceObservationLabel({ ...detail, observedAt: 'invalid' })).toBe(
      'Last recorded · Time unavailable'
    )
    expect(sourceObservationLabel(null)).toBe('Last recorded · Time unavailable')
    expect(sourceObservationLabel({ ...detail, observedAt: null })).toBe(
      'Last recorded · Time unavailable'
    )
  })
})

import { describe, expect, it } from 'vitest'
import {
  hasPublicationMonthOnly,
  publicationIntervalEnd,
  sourcePublicationDate,
  sourcePublicationEvidence,
  sourcePublicationLabel,
  sourceMatchReasons,
  formatDisplayDate,
  sourcePublicationDisplay
} from './sourceDate'
import { hashAnalysisSource } from '../core/analysis/sourceSnapshot'
const item = {
  source: 'folo:611',
  publishedAt: '2026-08-01T00:00:00.000Z',
  summary: '《研究期刊》2026年8月'
}
describe('source publication precision', () => {
  it('removes historical day claims from monthly evidence and invalidates the old analysis source hash', () => {
    const monthly = {
      ...item,
      source: 'folo:611' as const,
      id: 'month',
      title: 'Paper',
      url: 'https://ncpssd.cn/paper',
      score: 10,
      triageState: 'saved' as const,
      reasons: ['Published today', 'Updated 2 days ago', 'Topic match']
    }
    expect(sourceMatchReasons(monthly)).toEqual(['Topic match'])
    expect(hashAnalysisSource(monthly)).toBe(
      hashAnalysisSource({ ...monthly, reasons: ['Topic match'] })
    )
    expect(hashAnalysisSource(monthly)).not.toBe(
      hashAnalysisSource({ ...monthly, summary: 'Full date supplied' })
    )
    const exact = { ...monthly, source: 'arxiv' as const }
    expect(sourceMatchReasons(exact)).toEqual(monthly.reasons)
  })
  it('retains month-only evidence and computes its full possible interval', () => {
    expect(hasPublicationMonthOnly(item)).toBe(true)
    expect(sourcePublicationDate(item)).toBe('2026-08')
    expect(sourcePublicationLabel(item)).toBe('2026-08 (month only)')
    expect(sourcePublicationEvidence(item)).toContain('exact day unavailable')
    expect(new Date(publicationIntervalEnd(item)).toISOString()).toBe('2026-08-31T23:59:59.999Z')
  })
  it.each([
    { ...item, source: 'arxiv' },
    { ...item, publishedAt: '2026-08-12T00:00:00.000Z' },
    { ...item, summary: '2026年8期' },
    { ...item, summary: '2026年13月' },
    { ...item, summary: '' }
  ])('does not invent month precision from unsupported metadata', (candidate) => {
    expect(hasPublicationMonthOnly(candidate)).toBe(false)
    expect(sourcePublicationEvidence(candidate)).toBe(candidate.publishedAt)
    expect(sourcePublicationLabel(candidate)).toBe(candidate.publishedAt.slice(0, 10))
    expect(sourcePublicationLabel(candidate, true)).toBe(
      new Date(candidate.publishedAt).toLocaleDateString()
    )
    expect(publicationIntervalEnd(candidate)).toBe(Date.parse(candidate.publishedAt))
  })
})

describe('dates in the system language', () => {
  it('formats the stored calendar day in the given locale', () => {
    expect(formatDisplayDate('2026-08-14', 'en-US')).toBe('Aug 14, 2026')
    expect(formatDisplayDate('2026-08-14', 'zh-CN')).toBe('2026年8月14日')
    expect(formatDisplayDate('2026-08-14', 'de-DE')).toBe('14.08.2026')
    expect(formatDisplayDate('2026-08-14T23:59:00.000Z', 'en-US')).toBe('Aug 14, 2026')
  })
  it('keeps the UTC calendar day of a timestamp, as the ISO display did', () => {
    expect(formatDisplayDate('2026-03-01T00:30:00.000Z', 'en-US')).toBe('Mar 1, 2026')
  })
  it('returns unparseable input unchanged (bounded) and tolerates an unknown locale', () => {
    expect(formatDisplayDate('not a date', 'en-US')).toBe('not a date')
    expect(formatDisplayDate('x'.repeat(100), 'en-US')).toHaveLength(64)
    expect(formatDisplayDate('2026-08-14', 'not-a-locale!!')).toMatch(/2026/u)
  })
  it('shows a month-only publication as the month in the locale', () => {
    const monthly = {
      source: 'folo:611',
      publishedAt: '2026-08-01T00:00:00.000Z',
      summary: '《研究期刊》2026年8月'
    }
    expect(sourcePublicationDisplay(monthly, 'en-US')).toBe('Aug 2026 (month only)')
    expect(sourcePublicationDisplay(monthly, 'zh-CN')).toBe('2026年8月 (month only)')
    // A month-start value that does not parse is shown as stored instead of failing the view.
    expect(
      sourcePublicationDisplay(
        {
          source: 'folo:611',
          publishedAt: '2026-08-01Tnot-a-time',
          summary: '《研究期刊》2026年8月'
        },
        'en-US'
      )
    ).toBe('2026-08-01Tnot-a-time')
    expect(sourcePublicationDisplay({ source: 'arxiv', publishedAt: '2026-08-14' }, 'en-US')).toBe(
      'Aug 14, 2026'
    )
  })
})

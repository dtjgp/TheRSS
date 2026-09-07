import { describe, expect, it } from 'vitest'
import {
  hasPublicationMonthOnly,
  publicationIntervalEnd,
  sourcePublicationDate,
  sourcePublicationEvidence,
  sourcePublicationLabel,
  sourceMatchReasons
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

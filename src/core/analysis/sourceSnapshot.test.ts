import { describe, expect, it } from 'vitest'
import type { DashboardItem } from '../../shared/api'
import { hashAnalysisSource } from './sourceSnapshot'

const item: DashboardItem = {
  id: 'arxiv:2608.00001',
  source: 'arxiv',
  title: 'Structured pruning for edge deployment',
  summary: 'A resource-aware method.',
  url: 'https://arxiv.org/abs/2608.00001',
  publishedAt: '2026-08-14T00:00:00.000Z',
  score: 62,
  triageState: 'new',
  reasons: ['Title matches “structured pruning”']
}

describe('analysis source snapshot', () => {
  it('hashes every discovery field included in the model prompt deterministically', () => {
    expect(hashAnalysisSource(item)).toBe(
      'edc71265ddad97262e686e86523de7ae647accbd0ca09853baa3ec2aef42bec2'
    )
    expect(hashAnalysisSource({ ...item, summary: 'A revised abstract.' })).not.toBe(
      hashAnalysisSource(item)
    )
  })
})

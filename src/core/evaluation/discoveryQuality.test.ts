import { describe, expect, it } from 'vitest'
import { evaluateDiscoveryQuality, qualityJudgmentSchema } from './discoveryQuality'
import { hashAnalysisSource } from '../analysis/sourceSnapshot'
import type { DiscoverSnapshot } from '../../shared/discover'
const item = {
  id: 'github:owner/repo',
  source: 'github' as const,
  kind: 'repository' as const,
  externalId: 'owner/repo',
  title: 'Pruning implementation',
  summary: 'Structured pruning',
  url: 'https://github.com/owner/repo',
  publishedAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  authors: [],
  categories: [],
  topics: [],
  language: 'Python',
  stars: 1,
  metrics: {},
  score: 10,
  reasons: ['Keyword match'],
  saved: false
}
const snapshot = {
  id: 'run',
  createdAt: '2026-09-07T00:00:00Z',
  items: [item],
  sourceOutcomes: { github: { status: 'healthy', resultCount: 1, error: null } }
} as unknown as DiscoverSnapshot
const label = {
  itemId: item.id,
  sourceHash: hashAnalysisSource({ ...item, triageState: 'new' }),
  assessor: 'assistant' as const,
  relevance: 2 as const,
  rationale: 'Description explicitly concerns structured pruning'
}
describe('bounded discovery quality evaluation', () => {
  it('does not invent a human precision metric from unlabeled or assistant-labeled data', () => {
    expect(evaluateDiscoveryQuality(snapshot, [], 1).human.precisionAtK).toBeNull()
    const result = evaluateDiscoveryQuality(snapshot, [label], 1)
    expect(result.assistant.precisionAtK).toBe(1)
    expect(result.human.precisionAtK).toBeNull()
    expect(result.human.judged).toBe(0)
    expect(result.recall).toBeNull()
  })
  it('requires a full top-k set and counts direct and partial judgments explicitly', () => {
    const second = {
      ...item,
      id: 'github:owner/other',
      externalId: 'owner/other',
      url: 'https://github.com/owner/other'
    }
    const result = evaluateDiscoveryQuality(
      { ...snapshot, items: [item, second] },
      [
        { ...label, assessor: 'human' },
        {
          ...label,
          itemId: second.id,
          assessor: 'human',
          relevance: 1,
          sourceHash: hashAnalysisSource({ ...second, triageState: 'new' })
        }
      ],
      2
    )
    expect(result.human).toMatchObject({ judged: 2, precisionAtK: 1, directRelevanceAtK: 0.5 })
    expect(
      evaluateDiscoveryQuality(snapshot, [{ ...label, assessor: 'human' }], 2).human.precisionAtK
    ).toBeNull()
  })
  it('rejects duplicate, out-of-snapshot, stale-source and invalid judgments', () => {
    expect(() => evaluateDiscoveryQuality(snapshot, [label, label], 1)).toThrow(/Duplicate/)
    expect(() => evaluateDiscoveryQuality(snapshot, [{ ...label, itemId: 'missing' }], 1)).toThrow(
      /snapshot/
    )
    expect(() =>
      evaluateDiscoveryQuality(snapshot, [{ ...label, sourceHash: 'a'.repeat(64) }], 1)
    ).toThrow(/source/)
    expect(qualityJudgmentSchema.safeParse({ ...label, relevance: 3 }).success).toBe(false)
  })
  it('reports URL duplicates, unsafe links, bad dates and partial sources without interpreting score as quality', () => {
    const duplicate = {
      ...item,
      id: 'copy',
      url: item.url + '#section',
      publishedAt: 'bad date',
      score: 999
    }
    const unsafe = { ...item, id: 'unsafe', url: 'javascript:void(0)' }
    const result = evaluateDiscoveryQuality(
      {
        ...snapshot,
        items: [item, duplicate, unsafe],
        sourceOutcomes: {
          ...snapshot.sourceOutcomes,
          arxiv: { status: 'partial', resultCount: 0, error: 'fixture' }
        }
      },
      [],
      3
    )
    expect(result.diagnostics).toMatchObject({
      duplicateUrls: 1,
      unsafeUrls: 1,
      invalidDates: 1,
      partialSources: 1
    })
    expect(result.human.precisionAtK).toBeNull()
    expect(result.assistant.precisionAtK).toBeNull()
  })
  it('keeps unknown judgments distinct from off-topic and rejects an invalid k', () => {
    expect(
      evaluateDiscoveryQuality(snapshot, [{ ...label, relevance: null }], 1).assistant
    ).toMatchObject({ judged: 0, unknown: 1, precisionAtK: null })
    expect(() => evaluateDiscoveryQuality(snapshot, [], 0)).toThrow()
  })
})

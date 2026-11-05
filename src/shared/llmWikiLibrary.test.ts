import { describe, expect, it } from 'vitest'
import { llmWikiArxivId, llmWikiArxivIdSchema, llmWikiStatusRequestSchema } from './llmWikiLibrary'

describe('llm-wiki identity boundary', () => {
  it('normalizes official arXiv URLs without accepting arbitrary source identities', () => {
    const paper = { source: 'arxiv', kind: 'paper', url: 'https://arxiv.org/abs/2610.11302v2' }
    expect(llmWikiArxivId(paper)).toBe('2610.11302')
    expect(llmWikiArxivId({ ...paper, url: 'https://www.arxiv.org/abs/2610.11302/' })).toBe(
      '2610.11302'
    )
    for (const url of [
      'bad',
      'http://arxiv.org/abs/2610.11302',
      'https://arxiv.org.evil/abs/2610.11302',
      'https://user@arxiv.org/abs/2610.11302',
      'https://arxiv.org:8080/abs/2610.11302',
      'https://arxiv.org/abs/2610.11302?x=1',
      'https://arxiv.org/abs/2610.11302#section',
      'https://arxiv.org/pdf/2610.11302',
      'https://arxiv.org/abs/no-id'
    ])
      expect(llmWikiArxivId({ ...paper, url })).toBeNull()
    expect(llmWikiArxivId({ ...paper, source: 'github' })).toBeNull()
    expect(llmWikiArxivId({ ...paper, kind: 'article' })).toBeNull()
  })
  it('rejects unbounded IDs and extra IPC fields', () => {
    expect(llmWikiArxivIdSchema.parse('2610.11302v1')).toBe('2610.11302')
    for (const arxivId of ['', '../secret', '2610.11302v0', '1'.repeat(100)])
      expect(llmWikiArxivIdSchema.safeParse(arxivId).success).toBe(false)
    expect(
      llmWikiStatusRequestSchema.safeParse({ arxivId: '2610.11302', root: '/private' }).success
    ).toBe(false)
    expect(
      llmWikiStatusRequestSchema.safeParse({ arxivId: '2610.11302', refresh: 'yes' }).success
    ).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import type { DiscoveryItem } from '../../../shared/discovery'
import { classifySourceBatch } from './sourceBatchStatus'

const item = {} as DiscoveryItem

describe('classifySourceBatch', () => {
  it('keeps fetched, partial, empty and invalid batches distinct', () => {
    expect(classifySourceBatch({ items: [item], rejectedCount: 0 })).toBe('fetched')
    expect(classifySourceBatch({ items: [item], rejectedCount: 2, omittedCount: 2 })).toBe(
      'partial'
    )
    expect(classifySourceBatch({ items: [], rejectedCount: 0 })).toBe('no_results')
    expect(classifySourceBatch({ items: [], rejectedCount: 3 })).toBe('failed')
  })

  it('reports a batch whose entries were all omitted by policy as no_results', () => {
    expect(classifySourceBatch({ items: [], rejectedCount: 6, omittedCount: 6 })).toBe('no_results')
    expect(classifySourceBatch({ items: [], rejectedCount: 6, omittedCount: 5 })).toBe('failed')
  })
})

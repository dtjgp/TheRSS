import type { NormalizedSourceBatch } from './sourceNormalizer'

export function classifySourceBatch(
  batch: NormalizedSourceBatch
): 'fetched' | 'partial' | 'no_results' | 'failed' {
  if (batch.rejectedCount > 0) return batch.items.length > 0 ? 'partial' : 'failed'
  return batch.items.length > 0 ? 'fetched' : 'no_results'
}

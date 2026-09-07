import type { NormalizedSourceBatch } from './sourceNormalizer'

export function sourceRejectionDetail(
  batch: Pick<NormalizedSourceBatch, 'rejectedCount' | 'rejectionReason'>
): string {
  return batch.rejectionReason
    ? `${batch.rejectedCount} entries omitted. ${batch.rejectionReason}`
    : `${batch.rejectedCount} invalid entries were ignored`
}

export function classifySourceBatch(
  batch: NormalizedSourceBatch
): 'fetched' | 'partial' | 'no_results' | 'failed' {
  if (batch.rejectedCount > 0) return batch.items.length > 0 ? 'partial' : 'failed'
  return batch.items.length > 0 ? 'fetched' : 'no_results'
}

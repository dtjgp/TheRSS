import type { SourceHealth, SourceHealthDetail } from './api'

export function sourceHealthLabel(
  status: SourceHealth | undefined,
  context?: SourceHealthDetail['context']
): string {
  switch (status) {
    case 'healthy':
      return 'Retrieved'
    case 'no_results':
      return context === 'discover' ? 'No matches' : 'No items'
    case 'partial':
      return 'Partial'
    case 'failed':
      return 'Failed'
    case 'refreshing':
      return 'Refreshing'
    default:
      return 'Not recorded'
  }
}

export function sourceObservationLabel(detail: SourceHealthDetail | undefined | null): string {
  const context =
    detail?.context === 'discover'
      ? 'Latest search'
      : detail?.context === 'source'
        ? 'Last source read'
        : 'Last recorded'
  const date = detail?.observedAt ? new Date(detail.observedAt) : null
  const timestamp =
    date && Number.isFinite(date.getTime())
      ? `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
      : 'Time unavailable'
  return `${context} · ${timestamp}`
}

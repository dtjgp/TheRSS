import { createHash } from 'node:crypto'
import type { DashboardItem } from '../../shared/api'

export function hashAnalysisSource(item: DashboardItem): string {
  const promptSource = {
    source: item.source,
    id: item.id,
    title: item.title,
    summary: item.summary,
    url: item.url,
    publishedAt: item.publishedAt,
    score: item.score,
    reasons: [...item.reasons]
  }
  return createHash('sha256').update(JSON.stringify(promptSource), 'utf8').digest('hex')
}

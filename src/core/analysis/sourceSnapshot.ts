import { createHash } from 'node:crypto'
import type { DashboardItem } from '../../shared/api'
import { hasPublicationMonthOnly, sourceMatchReasons } from '../../shared/sourceDate'

export function hashAnalysisSource(item: DashboardItem): string {
  const promptSource = {
    source: item.source,
    id: item.id,
    title: item.title,
    summary: item.summary,
    url: item.url,
    publishedAt: item.publishedAt,
    score: item.score,
    reasons: [...sourceMatchReasons(item)],
    ...(hasPublicationMonthOnly(item) ? { publicationPrecision: 'month' } : {})
  }
  return createHash('sha256').update(JSON.stringify(promptSource), 'utf8').digest('hex')
}

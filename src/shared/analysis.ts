import type { DashboardItem } from './api'

export const GENERIC_ANALYSIS_PROMPT_VERSION = 'discovery-analysis-v1'
export const PAPER_L1_ANALYSIS_PROMPT_VERSION = 'llm-wiki-paper-l1-v1'

export function isPaperAnalysisCandidate(item: Pick<DashboardItem, 'kind' | 'source'>): boolean {
  return item.kind === 'paper' || (item.kind === undefined && item.source === 'arxiv')
}

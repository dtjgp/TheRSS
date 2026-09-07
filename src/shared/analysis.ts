import type { DashboardItem } from './api'

export const GENERIC_ANALYSIS_PROMPT_VERSION = 'discovery-analysis-v2'
export const PAPER_L1_ANALYSIS_PROMPT_VERSION = 'llm-wiki-paper-l1-v3'
export function isPaperL1PromptVersion(version: string): boolean {
  return [
    'llm-wiki-paper-l1-v1',
    'llm-wiki-paper-l1-v2',
    PAPER_L1_ANALYSIS_PROMPT_VERSION
  ].includes(version)
}

export function isPaperAnalysisCandidate(item: Pick<DashboardItem, 'kind' | 'source'>): boolean {
  return item.kind === 'paper' || (item.kind === undefined && item.source === 'arxiv')
}

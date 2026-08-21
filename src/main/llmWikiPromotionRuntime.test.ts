import { describe, expect, it } from 'vitest'
import { llmWikiPromotionAnalysisSchema } from '../core/integrations/llmWikiVaultAdapter'
import { codexOutputSchema } from './llmWikiPromotionRuntime'

function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys)
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, child]) => [key, ...collectKeys(child)])
}

describe('llm-wiki promotion runtime', () => {
  it('uses only Codex-supported JSON Schema keywords for structured output', () => {
    expect(collectKeys(codexOutputSchema())).not.toContain('uniqueItems')
  })

  it('retains related-path uniqueness in the local trust-boundary validator', () => {
    expect(
      llmWikiPromotionAnalysisSchema.safeParse({
        level: 'L2',
        routingRationale: 'Useful adjacent method.',
        domain: 'Edge_AI',
        shortIdentifier: 'TestPaper',
        relatedPaths: ['Topics/Edge_AI/Overview.md', 'Topics/Edge_AI/Overview.md'],
        noteMarkdown: 'x'.repeat(100)
      }).success
    ).toBe(false)
  })
})

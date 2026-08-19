import { describe, expect, it } from 'vitest'
import { discoverSearchRequestSchema } from './discover'

describe('discoverSearchRequestSchema', () => {
  it('trims a semantic intent and accepts each supported runner', () => {
    for (const runner of ['model-provider', 'codex', 'claude'] as const) {
      expect(
        discoverSearchRequestSchema.parse({
          intent: '  寻找结构化剪枝与边缘资源分配的交叉研究  ',
          runner,
          sources: ['arxiv', 'github']
        })
      ).toEqual({
        intent: '寻找结构化剪枝与边缘资源分配的交叉研究',
        runner,
        sources: ['arxiv', 'github']
      })
    }
  })

  it('rejects blank or oversized intents and unsupported runners', () => {
    expect(() =>
      discoverSearchRequestSchema.parse({
        intent: '   ',
        runner: 'codex',
        sources: ['arxiv']
      })
    ).toThrow()
    expect(() =>
      discoverSearchRequestSchema.parse({
        intent: 'x'.repeat(2_001),
        runner: 'codex',
        sources: ['arxiv']
      })
    ).toThrow()
    expect(() =>
      discoverSearchRequestSchema.parse({
        intent: 'edge intelligence',
        runner: 'shell',
        sources: ['arxiv']
      })
    ).toThrow()
  })

  it('requires a bounded source selection and rejects injected capabilities', () => {
    expect(() =>
      discoverSearchRequestSchema.parse({
        intent: 'edge intelligence',
        runner: 'codex',
        sources: []
      })
    ).toThrow()
    expect(() =>
      discoverSearchRequestSchema.parse({
        intent: 'edge intelligence',
        runner: 'codex',
        sources: ['arxiv'],
        endpoint: 'file:///tmp/secret',
        tools: ['shell']
      })
    ).toThrow()
  })
})

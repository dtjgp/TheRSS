import { describe, expect, it } from 'vitest'
import { ACTIVE_TODAY_SOURCE_IDS } from './sourceIdentity'
import {
  DISCOVER_SOURCE_IDS,
  discoverRunProgressSchema,
  discoverSearchRequestSchema
} from './discover'

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

  it('uses the complete active-source registry and accepts any active subset', () => {
    expect(DISCOVER_SOURCE_IDS).toEqual(ACTIVE_TODAY_SOURCE_IDS)
    expect(DISCOVER_SOURCE_IDS).toHaveLength(22)
    expect(Object.isFrozen(DISCOVER_SOURCE_IDS)).toBe(true)

    expect(
      discoverSearchRequestSchema.parse({
        intent: 'edge intelligence across research and industry sources',
        runner: 'codex',
        sources: ['folo:302', 'folo:64', 'folo:302']
      })
    ).toEqual({
      intent: 'edge intelligence across research and industry sources',
      runner: 'codex',
      sources: ['folo:302', 'folo:64']
    })

    expect(() =>
      discoverSearchRequestSchema.parse({
        intent: 'edge intelligence',
        runner: 'codex',
        sources: ['folo:999999']
      })
    ).toThrow()
  })
})

describe('discoverRunProgressSchema', () => {
  it('accepts bounded typed progress and rejects injected or inconsistent fields', () => {
    expect(
      discoverRunProgressSchema.parse({
        runId: 'discover-run:1',
        phase: 'searching',
        completedSources: 1,
        totalSources: 2,
        source: 'arxiv',
        outcome: { status: 'healthy', resultCount: 3, error: null }
      })
    ).toMatchObject({ runId: 'discover-run:1', completedSources: 1 })
    expect(() =>
      discoverRunProgressSchema.parse({
        runId: 'discover-run:1',
        phase: 'searching',
        completedSources: 3,
        totalSources: 2,
        source: 'file:///tmp/secret',
        outcome: null,
        command: 'open /tmp/secret'
      })
    ).toThrow()
  })
})

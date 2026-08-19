import { describe, expect, it, vi } from 'vitest'
import type { ModelExecutionProfile } from '../models/providerService'
import { DiscoverPlannerService, buildDiscoverPlannerPrompt } from './discoverPlanner'

const content = JSON.stringify({
  version: 'discover-plan-v1',
  intentSummary: 'Find structured pruning research for edge intelligence.',
  arxiv: {
    categories: ['cs.LG'],
    keywords: ['structured pruning', 'edge intelligence'],
    excludeKeywords: []
  },
  github: {
    keywords: ['model compression'],
    topics: ['edge-ai'],
    languages: ['Python']
  },
  rationale: 'Use both academic and implementation terminology.'
})

const profile: ModelExecutionProfile = {
  id: 'default',
  name: 'DeepSeek',
  protocol: 'openai-compatible',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  hasCredential: true,
  updatedAt: '2026-08-15T10:00:00.000Z',
  apiKey: 'placeholder'
}

describe('DiscoverPlannerService', () => {
  it('uses only the configured model gateway and records bounded provenance', async () => {
    const planWithModel = vi.fn().mockResolvedValue({
      content,
      inputTokens: 40,
      outputTokens: 60
    })
    const planWithLocalAgent = vi.fn()
    const planner = new DiscoverPlannerService({
      getModelProfile: () => profile,
      planWithModel,
      planWithLocalAgent
    })

    const result = await planner.plan(
      {
        intent: '结构化剪枝与边缘智能',
        runner: 'model-provider',
        sources: ['arxiv', 'github']
      },
      new Date('2026-08-16T10:00:00.000Z')
    )

    expect(planWithModel).toHaveBeenCalledOnce()
    expect(planWithLocalAgent).not.toHaveBeenCalled()
    expect(result.plan.intentSummary).toContain('structured pruning')
    expect(result.provenance).toMatchObject({
      providerId: 'default',
      providerName: 'DeepSeek',
      model: 'deepseek-chat',
      promptVersion: 'semantic-discover-v1',
      createdAt: '2026-08-16T10:00:00.000Z'
    })
    expect(result.provenance.inputHash).toMatch(/^[a-f0-9]{64}$/u)
  })

  it.each(['codex', 'claude'] as const)(
    'routes %s through only the bounded local-agent gateway',
    async (runner) => {
      const planWithModel = vi.fn()
      const planWithLocalAgent = vi.fn().mockResolvedValue({
        content,
        providerId: `local-agent:${runner}`,
        providerName: runner === 'codex' ? 'Codex CLI' : 'Claude Code',
        model: runner === 'codex' ? 'codex-cli' : 'claude-code',
        inputTokens: null,
        outputTokens: null
      })
      const planner = new DiscoverPlannerService({
        getModelProfile: vi.fn(),
        planWithModel,
        planWithLocalAgent
      })

      const result = await planner.plan({
        intent: 'edge AI pruning',
        runner,
        sources: ['arxiv', 'github']
      })

      expect(planWithModel).not.toHaveBeenCalled()
      expect(planWithLocalAgent).toHaveBeenCalledWith(expect.any(String), runner)
      expect(result.provenance.providerId).toBe(`local-agent:${runner}`)
    }
  )

  it('builds a JSON-only, no-tools planning prompt with explicit source bounds', () => {
    const prompt = buildDiscoverPlannerPrompt({
      intent: 'Find semantic communications work',
      runner: 'codex',
      sources: ['arxiv']
    })

    expect(prompt).toContain('Return exactly one JSON object')
    expect(prompt).toContain('Do not browse')
    expect(prompt).toContain('arxiv')
    expect(prompt).toContain('github arrays must be empty')
    expect(prompt).toContain('BEGIN UNTRUSTED USER INTENT')
    expect(prompt).toContain('Find semantic communications work')
  })

  it('rejects expansion rules for a source the user did not select', async () => {
    const planner = new DiscoverPlannerService({
      getModelProfile: () => profile,
      planWithModel: vi.fn().mockResolvedValue({
        content,
        inputTokens: 40,
        outputTokens: 60
      }),
      planWithLocalAgent: vi.fn()
    })

    await expect(
      planner.plan({
        intent: 'structured pruning papers only',
        runner: 'model-provider',
        sources: ['arxiv']
      })
    ).rejects.toThrow('invalid search plan')
  })
})

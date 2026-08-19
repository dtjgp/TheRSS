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

  it('builds a JSON-only, no-tools prompt whose bounded fields are a shared semantic profile', () => {
    const prompt = buildDiscoverPlannerPrompt({
      intent: 'Find semantic communications work',
      runner: 'codex',
      sources: ['folo:302']
    })

    expect(prompt).toContain('Return exactly one JSON object')
    expect(prompt).toContain('Do not browse')
    expect(prompt).toContain('folo:302')
    expect(prompt).toContain('transient semantic profile')
    expect(prompt).not.toContain('arrays must be empty')
    expect(prompt).toContain('BEGIN UNTRUSTED USER INTENT')
    expect(prompt).toContain('Find semantic communications work')
  })

  it('accepts bounded arXiv and GitHub fields for a configured-only source selection', async () => {
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
        intent: 'structured pruning across research sources',
        runner: 'model-provider',
        sources: ['folo:302']
      })
    ).resolves.toMatchObject({ plan: JSON.parse(content) })
  })

  it('rejects a plan that contains no positive semantic expansion rules', async () => {
    const emptyContent = JSON.stringify({
      version: 'discover-plan-v1',
      intentSummary: 'No usable expansion.',
      arxiv: { categories: [], keywords: [], excludeKeywords: ['unrelated'] },
      github: { keywords: [], topics: [], languages: [] },
      rationale: 'No positive semantic terms were generated.'
    })
    const planner = new DiscoverPlannerService({
      getModelProfile: () => profile,
      planWithModel: vi.fn().mockResolvedValue({
        content: emptyContent,
        inputTokens: 40,
        outputTokens: 60
      }),
      planWithLocalAgent: vi.fn()
    })

    await expect(
      planner.plan({
        intent: 'structured pruning',
        runner: 'model-provider',
        sources: ['folo:302']
      })
    ).rejects.toThrow('invalid search plan')
  })

  it.each([
    [
      'arxiv',
      {
        arxiv: { categories: [], keywords: [], excludeKeywords: [] },
        github: { keywords: ['edge AI'], topics: [], languages: [] }
      }
    ],
    [
      'github',
      {
        arxiv: { categories: ['cs.LG'], keywords: [], excludeKeywords: [] },
        github: { keywords: [], topics: [], languages: [] }
      }
    ]
  ] as const)('rejects a plan with no rules usable by selected %s', async (source, rules) => {
    const unusableContent = JSON.stringify({
      version: 'discover-plan-v1',
      intentSummary: 'Cross-source-only expansion.',
      ...rules,
      rationale: 'The selected source has no usable search rules.'
    })
    const planner = new DiscoverPlannerService({
      getModelProfile: () => profile,
      planWithModel: vi.fn().mockResolvedValue({
        content: unusableContent,
        inputTokens: 40,
        outputTokens: 60
      }),
      planWithLocalAgent: vi.fn()
    })

    await expect(
      planner.plan({
        intent: 'edge AI',
        runner: 'model-provider',
        sources: [source]
      })
    ).rejects.toThrow('invalid search plan')
  })

  it('rejects configured-only plans without a title/summary-searchable keyword', async () => {
    const categoryOnlyContent = JSON.stringify({
      version: 'discover-plan-v1',
      intentSummary: 'Category-only expansion.',
      arxiv: { categories: ['cs.LG'], keywords: [], excludeKeywords: [] },
      github: { keywords: [], topics: ['edge-ai'], languages: ['Python'] },
      rationale: 'No keyword can match a browse-only title or summary.'
    })
    const planner = new DiscoverPlannerService({
      getModelProfile: () => profile,
      planWithModel: vi.fn().mockResolvedValue({
        content: categoryOnlyContent,
        inputTokens: 40,
        outputTokens: 60
      }),
      planWithLocalAgent: vi.fn()
    })

    await expect(
      planner.plan({
        intent: 'edge AI',
        runner: 'model-provider',
        sources: ['folo:302']
      })
    ).rejects.toThrow('invalid search plan')
  })
})

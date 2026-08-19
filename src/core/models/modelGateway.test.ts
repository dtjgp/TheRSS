import { describe, expect, it, vi } from 'vitest'
import type { DashboardItem } from '../../shared/api'
import type { ModelExecutionProfile } from './providerService'
import {
  analysisPromptVersionFor,
  analyzeWithModel,
  buildAnalysisPrompt,
  runPromptWithModel
} from './modelGateway'

const item: DashboardItem = {
  id: 'arxiv:2608.00001',
  source: 'arxiv',
  kind: 'paper',
  title: 'Structured pruning for edge deployment',
  summary: 'A resource-aware pruning method.',
  url: 'https://arxiv.org/abs/2608.00001',
  publishedAt: '2026-08-14T00:00:00.000Z',
  score: 62,
  triageState: 'new',
  reasons: ['Title matches “structured pruning”', 'arXiv category cs.LG']
}

const placeholderCredential = ['placeholder', 'credential'].join('-')
const anthropicPlaceholder = ['anthropic', 'placeholder'].join('-')

function provider(overrides: Partial<ModelExecutionProfile> = {}): ModelExecutionProfile {
  return {
    id: 'default',
    name: 'DeepSeek',
    protocol: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    hasCredential: true,
    updatedAt: '2026-08-15T12:00:00.000Z',
    apiKey: placeholderCredential,
    ...overrides
  }
}

describe('modelGateway', () => {
  it('routes every typed paper through the evidence-bounded llm-wiki L1 template', () => {
    const typedSourcePaper: DashboardItem = {
      ...item,
      id: 'folo:64:paper:2608.00001',
      source: 'folo:64'
    }
    const prompt = buildAnalysisPrompt(typedSourcePaper)

    expect(prompt).toContain('UNTRUSTED SOURCE METADATA')
    expect(prompt).toContain(typedSourcePaper.title)
    expect(prompt).toContain('llm-wiki Paper_Note_L1')
    expect(prompt).toContain('## 快速决策卡')
    expect(prompt).toContain('## 核心贡献与创新性地图')
    expect(prompt).toContain('## 关键主张与证据台账')
    expect(prompt).toContain('## 审稿人式评估')
    expect(prompt).toContain('abstract-only')
    expect(prompt).toContain('[TBD]')
    expect(analysisPromptVersionFor(typedSourcePaper)).toBe('llm-wiki-paper-l1-v1')
  })

  it('keeps legacy arXiv records without a kind on the paper L1 path', () => {
    const legacyArxivPaper: DashboardItem = {
      id: item.id,
      source: item.source,
      title: item.title,
      summary: item.summary,
      url: item.url,
      publishedAt: item.publishedAt,
      score: item.score,
      triageState: item.triageState,
      reasons: item.reasons
    }

    expect(analysisPromptVersionFor(legacyArxivPaper)).toBe('llm-wiki-paper-l1-v1')
    expect(buildAnalysisPrompt(legacyArxivPaper)).toContain('llm-wiki Paper_Note_L1')
  })

  it('keeps repositories and other non-paper records on the generic discovery analysis', () => {
    const prompt = buildAnalysisPrompt({
      ...item,
      id: 'github:owner/repo',
      source: 'github',
      kind: 'repository',
      url: 'https://github.com/owner/repo'
    })

    expect(prompt).toContain('Likely contribution')
    expect(prompt).not.toContain('llm-wiki Paper_Note_L1')
    expect(prompt).not.toContain('## 快速决策卡')
    expect(
      analysisPromptVersionFor({
        ...item,
        id: 'github:owner/repo',
        source: 'github',
        kind: 'repository',
        url: 'https://github.com/owner/repo'
      })
    ).toBe('discovery-analysis-v1')
  })

  it('calls an OpenAI-compatible provider without leaking the key into the body', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '## Research fit\nRelevant.' } }],
          usage: { prompt_tokens: 100, completion_tokens: 20 }
        }),
        { status: 200 }
      )
    )

    const result = await analyzeWithModel(item, provider(), { fetcher })

    expect(result.content).toBe('## Research fit\nRelevant.')
    const [url, request] = fetcher.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.deepseek.com/chat/completions')
    expect(request.headers).toMatchObject({
      Authorization: `Bearer ${placeholderCredential}`,
      'Content-Type': 'application/json'
    })
    expect(request.body).not.toContain(placeholderCredential)
    expect(JSON.parse(String(request.body))).toMatchObject({ max_tokens: 4_000 })
  })

  it('runs a bounded JSON-planning prompt through the configured provider', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"version":"discover-plan-v1"}' } }]
        }),
        { status: 200 }
      )
    )

    await runPromptWithModel('Discover prompt', provider(), {
      fetcher,
      systemPrompt: 'Return JSON only.',
      maxTokens: 800
    })

    const [, request] = fetcher.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(request.body)) as {
      max_tokens?: number
      messages: Array<{ role: string; content: string }>
    }
    expect(body.max_tokens).toBe(800)
    expect(body.messages[0]).toEqual({ role: 'system', content: 'Return JSON only.' })
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Discover prompt' })
  })

  it('calls an Anthropic-compatible provider using the messages protocol', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: '## Contribution\nA concise summary.' }],
          usage: { input_tokens: 90, output_tokens: 18 }
        }),
        { status: 200 }
      )
    )

    const result = await analyzeWithModel(
      item,
      provider({
        name: 'Anthropic',
        protocol: 'anthropic-compatible',
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-sonnet',
        apiKey: anthropicPlaceholder
      }),
      { fetcher }
    )

    expect(result.content).toContain('A concise summary.')
    const [url, request] = fetcher.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(request.headers).toMatchObject({
      'x-api-key': anthropicPlaceholder,
      'anthropic-version': '2023-06-01'
    })
  })

  it('returns a bounded error without including the remote response body', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response('provider diagnostic containing private data', { status: 401 })
      )

    await expect(analyzeWithModel(item, provider(), { fetcher })).rejects.toThrow(
      'Model provider request failed with status 401'
    )
  })
})

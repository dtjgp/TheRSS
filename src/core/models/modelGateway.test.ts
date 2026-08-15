import { describe, expect, it, vi } from 'vitest'
import type { DashboardItem } from '../../shared/api'
import type { ModelExecutionProfile } from './providerService'
import { analyzeWithModel, buildAnalysisPrompt } from './modelGateway'

const item: DashboardItem = {
  id: 'arxiv:2608.00001',
  source: 'arxiv',
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
  it('marks source metadata as untrusted and asks for evidence-aware sections', () => {
    const prompt = buildAnalysisPrompt(item)

    expect(prompt).toContain('UNTRUSTED SOURCE METADATA')
    expect(prompt).toContain(item.title)
    expect(prompt).toContain('Evidence boundary')
    expect(prompt).toContain('Why it matched')
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

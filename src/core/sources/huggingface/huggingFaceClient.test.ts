import { describe, expect, it, vi } from 'vitest'
import { fetchHuggingFaceSignals } from './huggingFaceClient'

const huggingFacePlaceholderCredential = ['hf', 'private'].join('_')

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('fetchHuggingFaceSignals', () => {
  it('retrieves and normalizes public model, dataset, and daily-paper signals without a token', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(new Headers(init?.headers).has('Authorization')).toBe(false)
      const url = String(input)
      if (url.includes('/api/models')) {
        return jsonResponse([
          {
            id: 'research/model-a',
            lastModified: '2026-08-19T08:00:00.000Z',
            tags: ['pytorch'],
            downloads: 12,
            pipeline_tag: 'text-generation'
          }
        ])
      }
      if (url.includes('/api/datasets')) {
        return jsonResponse([
          {
            id: 'research/dataset-a',
            lastModified: '2026-08-19T07:00:00.000Z',
            tags: ['energy'],
            downloads: 5,
            description: 'Measured energy traces.'
          }
        ])
      }
      return jsonResponse([
        {
          publishedAt: '2026-08-19T06:00:00.000Z',
          paper: {
            id: '2608.12345',
            title: 'Efficient Edge Learning',
            summary: 'A bounded paper abstract.',
            authors: [{ name: 'Ada Researcher' }]
          }
        }
      ])
    })

    const items = await fetchHuggingFaceSignals({ fetcher, maxItemsPerKind: 1 })

    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(items.map((item) => item.kind)).toEqual(['model', 'dataset', 'paper'])
    expect(items.map((item) => item.sourceId)).toEqual(['folo:64', 'folo:64', 'folo:64'])
    expect(items[0]).toMatchObject({
      id: 'huggingface:model:research/model-a',
      url: 'https://huggingface.co/research/model-a'
    })
    expect(items[1]).toMatchObject({
      id: 'huggingface:dataset:research/dataset-a',
      summary: 'Measured energy traces.',
      url: 'https://huggingface.co/datasets/research/dataset-a'
    })
    expect(items[2]).toMatchObject({
      id: 'huggingface:paper:2608.12345',
      authors: ['Ada Researcher'],
      url: 'https://huggingface.co/papers/2608.12345'
    })
  })

  it('uses an optional token only in request headers and rejects failed endpoints', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      expect(new Headers(init?.headers).get('Authorization')).toBe(
        `Bearer ${huggingFacePlaceholderCredential}`
      )
      return new Response('denied', { status: 401 })
    })

    await expect(
      fetchHuggingFaceSignals({ fetcher, token: `  ${huggingFacePlaceholderCredential}  ` })
    ).rejects.toThrow('Hugging Face models request failed with status 401')
  })
})

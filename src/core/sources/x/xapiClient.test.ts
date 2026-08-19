import { describe, expect, it, vi } from 'vitest'
import { fetchXSignals, type XapiRunner } from './xapiClient'

describe('fetchXSignals', () => {
  it('checks the twitter.search schema before retrieving and normalizing latest posts', async () => {
    const runner = vi.fn<XapiRunner>(async (args) => {
      if (args[0] === 'get') {
        return {
          stdout: JSON.stringify({
            id: 'twitter.search',
            input: {
              required: ['raw_query'],
              properties: { sort_by: { enum: ['Top', 'Latest'] } }
            }
          }),
          stderr: ''
        }
      }
      return {
        stdout: JSON.stringify({
          data: {
            provider: 'x',
            tweets: [
              {
                tweet_id: '123456789',
                text: 'New edge AI benchmark results.',
                created_at: '2026-08-19T09:30:00.000Z',
                favorite_count: 4,
                user: { name: 'Research Lab', screen_name: 'researchlab' }
              }
            ]
          }
        }),
        stderr: ''
      }
    })

    const items = await fetchXSignals('"edge AI" benchmark', { runner, count: 5 })

    expect(runner).toHaveBeenCalledTimes(2)
    expect(runner.mock.calls[0]?.[0]).toEqual(['get', 'twitter.search'])
    expect(runner.mock.calls[1]?.[0]?.slice(0, 3)).toEqual(['call', 'twitter.search', '--input'])
    expect(JSON.parse(runner.mock.calls[1]?.[0]?.[3] ?? '{}')).toEqual({
      raw_query: '"edge AI" benchmark',
      sort_by: 'Latest',
      count: 5
    })
    expect(items).toEqual([
      {
        id: 'x:123456789',
        sourceId: 'folo:2',
        externalId: '123456789',
        kind: 'post',
        title: '@researchlab: New edge AI benchmark results.',
        summary: 'New edge AI benchmark results.',
        url: 'https://x.com/researchlab/status/123456789',
        publishedAt: '2026-08-19T09:30:00.000Z',
        authors: ['Research Lab'],
        tags: [],
        metrics: { likes: 4 }
      }
    ])
  })

  it('stops before search when the action schema is incompatible', async () => {
    const runner = vi.fn<XapiRunner>(async () => ({
      stdout: JSON.stringify({ id: 'twitter.search', input: { required: [] } }),
      stderr: ''
    }))

    await expect(fetchXSignals('edge AI', { runner })).rejects.toThrow(
      'xapi twitter.search schema does not require raw_query'
    )
    expect(runner).toHaveBeenCalledTimes(1)
  })
})

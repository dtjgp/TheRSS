import { describe, expect, it, vi } from 'vitest'
import type { GitHubInterest } from '../../interests/interestProfile'
import { fetchGitHubRadarItems, parseGitHubSearchResponse } from './githubClient'

const payload = {
  total_count: 1,
  incomplete_results: false,
  items: [
    {
      id: 123,
      full_name: 'owner/repo',
      html_url: 'https://github.com/owner/repo',
      description: 'Open tools for model compression.',
      created_at: '2026-08-01T09:00:00Z',
      pushed_at: '2026-08-14T12:00:00Z',
      language: 'Python',
      stargazers_count: 42,
      topics: ['model-compression', 'edge-ai']
    }
  ]
}

const interest: GitHubInterest = {
  keywords: ['model compression'],
  topics: ['edge-ai'],
  languages: []
}

const placeholderCredential = 'not-a-secret'

describe('GitHub Interest Radar client', () => {
  it('normalizes repository search results', () => {
    expect(parseGitHubSearchResponse(payload)).toEqual([
      {
        id: 'github:owner/repo',
        source: 'github',
        kind: 'repository',
        externalId: 'owner/repo',
        title: 'owner/repo',
        summary: 'Open tools for model compression.',
        url: 'https://github.com/owner/repo',
        publishedAt: '2026-08-01T09:00:00.000Z',
        updatedAt: '2026-08-14T12:00:00.000Z',
        authors: [],
        categories: [],
        topics: ['model-compression', 'edge-ai'],
        language: 'Python',
        stars: 42,
        metrics: {}
      }
    ])
  })

  it('queries a bounded set of interests and deduplicates repositories', async () => {
    const fetcher = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    )

    const items = await fetchGitHubRadarItems(interest, {
      fetcher,
      now: new Date('2026-08-15T00:00:00Z'),
      maxQueries: 2,
      token: placeholderCredential
    })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(items).toHaveLength(1)
    const [url, request] = fetcher.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('https://api.github.com/search/repositories?')
    expect(url).toContain('sort=updated')
    expect(request.headers).toMatchObject({
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${placeholderCredential}`,
      'X-GitHub-Api-Version': '2022-11-28'
    })
  })

  it('does not attach an authorization header without a token', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ...payload, items: [] }), { status: 200 }))

    await fetchGitHubRadarItems(
      { ...interest, topics: [] },
      {
        fetcher,
        now: new Date('2026-08-15T00:00:00Z')
      }
    )

    const [, request] = fetcher.mock.calls[0] as [string, RequestInit]
    expect(request.headers).not.toHaveProperty('Authorization')
  })

  it('rejects unsafe query fan-out and bounded source failures', async () => {
    await expect(fetchGitHubRadarItems(interest, { maxQueries: 13 })).rejects.toThrow(
      'between 1 and 12'
    )

    const fetcher = vi.fn().mockResolvedValue(new Response('rate limited', { status: 403 }))
    await expect(
      fetchGitHubRadarItems(
        { ...interest, topics: [] },
        {
          fetcher,
          now: new Date('2026-08-15T00:00:00Z')
        }
      )
    ).rejects.toThrow('GitHub request failed with status 403')
  })

  it('rejects an oversized GitHub response before JSON parsing', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload)))

    await expect(
      fetchGitHubRadarItems(
        { ...interest, topics: [] },
        {
          fetcher,
          now: new Date('2026-08-15T00:00:00Z'),
          maxResponseBytes: 32
        }
      )
    ).rejects.toThrow('GitHub response exceeds the 32 byte safety limit')
  })
})

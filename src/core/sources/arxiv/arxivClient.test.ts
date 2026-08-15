import { describe, expect, it, vi } from 'vitest'
import type { ArxivInterest } from '../../interests/interestProfile'
import { fetchArxivItems, parseArxivFeed } from './arxivClient'

const atomFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2608.00001v2</id>
    <updated>2026-08-14T12:00:00Z</updated>
    <published>2026-08-13T09:00:00Z</published>
    <title> Structured pruning\n for edge deployment </title>
    <summary> A resource-aware\n method. </summary>
    <author><name>A. Researcher</name></author>
    <author><name>B. Engineer</name></author>
    <category term="cs.LG" />
    <category term="cs.NI" />
  </entry>
</feed>`

const interest: ArxivInterest = {
  categories: ['cs.LG'],
  keywords: ['structured pruning'],
  excludeKeywords: []
}

describe('arXiv client', () => {
  it('normalizes Atom entries into immutable discovery items', () => {
    expect(parseArxivFeed(atomFeed)).toEqual([
      {
        id: 'arxiv:2608.00001v2',
        source: 'arxiv',
        externalId: '2608.00001v2',
        title: 'Structured pruning for edge deployment',
        summary: 'A resource-aware method.',
        url: 'https://arxiv.org/abs/2608.00001v2',
        publishedAt: '2026-08-13T09:00:00.000Z',
        updatedAt: '2026-08-14T12:00:00.000Z',
        authors: ['A. Researcher', 'B. Engineer'],
        categories: ['cs.LG', 'cs.NI'],
        topics: [],
        language: null,
        stars: null
      }
    ])
  })

  it('uses the official query endpoint and identifies the application', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(atomFeed, {
        status: 200,
        headers: { 'content-type': 'application/atom+xml' }
      })
    )

    const items = await fetchArxivItems(interest, { fetcher, maxResults: 25 })

    expect(items).toHaveLength(1)
    const [url, request] = fetcher.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('https://export.arxiv.org/api/query?')
    expect(url).toContain('max_results=25')
    expect(request.headers).toMatchObject({ 'User-Agent': expect.stringContaining('TheRSS') })
  })

  it('fails with a bounded source error when arXiv rejects the request', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('busy', { status: 503 }))

    await expect(fetchArxivItems(interest, { fetcher })).rejects.toThrow(
      'arXiv request failed with status 503'
    )
  })

  it('rejects an oversized arXiv response before parsing it', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(atomFeed))

    await expect(fetchArxivItems(interest, { fetcher, maxResponseBytes: 32 })).rejects.toThrow(
      'arXiv response exceeds the 32 byte safety limit'
    )
  })

  it('accepts an Atom feed with no entries', () => {
    expect(parseArxivFeed('<feed xmlns="http://www.w3.org/2005/Atom"></feed>')).toEqual([])
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { ArxivInterest } from '../../interests/interestProfile'
import { fetchArxivItems, fetchArxivRecentItems, parseArxivFeed } from './arxivClient'

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
        kind: 'paper',
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
        stars: null,
        metrics: {}
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

  it('retries a 429 response with bounded backoff before succeeding', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('rate limited', { status: 429, headers: { 'Retry-After': '1' } })
      )
      .mockResolvedValueOnce(new Response(atomFeed, { status: 200 }))
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(fetchArxivItems(interest, { fetcher, sleep })).resolves.toHaveLength(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(1_000)
  })

  it('returns only papers published today for interest-independent Sources browsing', async () => {
    const olderEntry = atomFeed
      .replaceAll('2608.00001v2', '2608.00000v1')
      .replace('2026-08-13T09:00:00Z', '2026-08-18T09:00:00Z')
    const todayEntry = atomFeed
      .replaceAll('2608.00001v2', '2608.00002v1')
      .replace('2026-08-13T09:00:00Z', '2026-08-19T09:00:00Z')
    const combined = `<feed xmlns="http://www.w3.org/2005/Atom">${
      olderEntry.match(/<entry>[\s\S]*<\/entry>/u)?.[0] ?? ''
    }${todayEntry.match(/<entry>[\s\S]*<\/entry>/u)?.[0] ?? ''}</feed>`
    const fetcher = vi.fn().mockResolvedValue(new Response(combined, { status: 200 }))

    const items = await fetchArxivRecentItems({
      fetcher,
      now: new Date('2026-08-19T12:00:00.000Z')
    })

    expect(items.map((item) => item.externalId)).toEqual(['2608.00002v1'])
    expect(String(fetcher.mock.calls[0]?.[0])).toContain(
      'search_query=submittedDate%3A%5B202608190000+TO+202608192359%5D'
    )
  })

  it('falls back to the latest non-empty arXiv daily batch without applying Interests', async () => {
    const previousBatch = atomFeed.replace('2026-08-13T09:00:00Z', '2026-08-18T09:00:00Z')
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('<feed></feed>', { status: 200 }))
      .mockResolvedValueOnce(new Response(previousBatch, { status: 200 }))
    const sleep = vi.fn().mockResolvedValue(undefined)

    const items = await fetchArxivRecentItems({
      fetcher,
      sleep,
      now: new Date('2026-08-19T12:00:00.000Z')
    })

    expect(items).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(String(fetcher.mock.calls[1]?.[0])).toContain('202608180000')
    expect(sleep).toHaveBeenCalledWith(3_000)
  })

  it('reports a verified empty result after checking seven spaced daily batches', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response('<feed></feed>'))
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(
      fetchArxivRecentItems({
        fetcher,
        sleep,
        now: new Date('2026-08-19T12:00:00.000Z')
      })
    ).resolves.toEqual([])

    expect(fetcher).toHaveBeenCalledTimes(7)
    expect(sleep).toHaveBeenCalledTimes(6)
  })

  it('uses bounded default backoff when a 429 omits Retry-After', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('busy', { status: 429 }))
      .mockResolvedValueOnce(new Response(atomFeed, { status: 200 }))
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(fetchArxivItems(interest, { fetcher, sleep })).resolves.toHaveLength(1)
    expect(sleep).toHaveBeenCalledWith(3_000)
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

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
  it('keeps large legitimate collaborations within an aggregate metadata budget', () => {
    const authors = Array.from(
      { length: 1500 },
      (_, index) => `<author><name>Researcher ${index}</name></author>`
    ).join('')
    const feed = atomFeed.replace('<author><name>A. Researcher</name></author>', authors)
    expect(parseArxivFeed(feed)[0]?.authors).toHaveLength(1501)
  })
  it('preserves canonical legacy identifiers and rejects oversized discovery text', () => {
    const legacy = atomFeed.replace('2608.00001v2', 'cs/9901002v1')
    expect(parseArxivFeed(legacy)[0]?.id).toBe('arxiv:cs/9901002v1')
    expect(() =>
      parseArxivFeed(atomFeed.replace('Structured pruning\n for edge deployment', 'x'.repeat(5000)))
    ).toThrow()
  })
  it('does not report an HTML challenge, malformed XML or an error document as an empty feed', () => {
    expect(() => parseArxivFeed('<html><body>Try again later</body></html>')).toThrow(/feed|XML/i)
    expect(() => parseArxivFeed('<feed><entry>')).toThrow(/XML/i)
    expect(() => parseArxivFeed('<feed><error>Unavailable</error></feed>')).toThrow(/error|feed/i)
    expect(parseArxivFeed('<feed></feed>')).toEqual([])
  })
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

  it('exhausts transient 503 retries with bounded exponential backoff', async () => {
    const fetcher = vi.fn(async () => new Response('busy', { status: 503 }))
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(fetchArxivItems(interest, { fetcher, sleep, maxAttempts: 6 })).rejects.toThrow(
      'arXiv request failed with status 503'
    )
    expect(fetcher).toHaveBeenCalledTimes(6)
    expect(sleep.mock.calls).toEqual([[3000], [6000], [12000], [24000], [30000]])
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

  it.each([
    [429, '90', 30_000],
    [503, 'Fri, 14 Aug 2026 12:00:15 GMT', 15_000]
  ])('honors bounded Retry-After on HTTP %i', async (status, retryAfter, expectedDelay) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00Z'))
    try {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(null, { status, headers: { 'Retry-After': retryAfter } })
        )
        .mockResolvedValueOnce(new Response(atomFeed))
      const sleep = vi.fn().mockResolvedValue(undefined)

      await expect(fetchArxivItems(interest, { fetcher, sleep })).resolves.toHaveLength(1)
      expect(sleep.mock.calls).toEqual([[expectedDelay]])
    } finally {
      vi.useRealTimers()
    }
  })

  it('applies Retry-After to other callers even after the last attempt', async () => {
    vi.useFakeTimers()
    vi.resetModules()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '15' } }))
      .mockResolvedValueOnce(new Response(atomFeed))
    vi.stubGlobal('fetch', fetcher)
    try {
      const { fetchArxivItems: fetchPaced } = await import('./arxivClient')
      const failure = expect(fetchPaced(interest, { maxAttempts: 1 })).rejects.toThrow('status 429')
      const queued = fetchPaced(interest)

      await vi.advanceTimersByTimeAsync(14_999)
      await failure
      expect(fetcher).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      await expect(queued).resolves.toHaveLength(1)
    } finally {
      vi.unstubAllGlobals()
      vi.useRealTimers()
    }
  })

  it('retries when the per-attempt deadline aborts a response body read', async () => {
    vi.useFakeTimers()
    const timeout = new DOMException('Timed out', 'TimeoutError')
    const timeoutSignal = vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(timeout), milliseconds)
      return controller.signal
    })
    const sleep = vi.fn().mockResolvedValue(undefined)
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async (_url, request) => {
        const body = new ReadableStream<Uint8Array>({
          start(stream) {
            request?.signal?.addEventListener('abort', () => {
              stream.error(new DOMException('Body read was aborted', 'AbortError'))
            })
          }
        })
        return new Response(body)
      })
      .mockResolvedValueOnce(new Response(atomFeed))
    try {
      const result = expect(
        fetchArxivItems(interest, { fetcher, sleep, timeoutMs: 100 })
      ).resolves.toHaveLength(1)
      await vi.advanceTimersByTimeAsync(99)
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(sleep).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      await result
      expect(timeoutSignal.mock.calls).toEqual([[100], [100]])
      expect(fetcher.mock.calls[0]?.[1]?.signal).not.toBe(fetcher.mock.calls[1]?.[1]?.signal)
      expect(sleep.mock.calls).toEqual([[3000]])
    } finally {
      timeoutSignal.mockRestore()
      vi.useRealTimers()
    }
  })

  it('preserves the timeout when attempts are exhausted', async () => {
    const timeout = new DOMException('Timed out', 'TimeoutError')
    const sleep = vi.fn().mockResolvedValue(undefined)
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(timeout)

    await expect(fetchArxivItems(interest, { fetcher, sleep, maxAttempts: 2 })).rejects.toBe(
      timeout
    )
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(sleep.mock.calls).toEqual([[3000]])
  })

  it.each([400, 404, 500])('does not retry HTTP %i', async (status) => {
    const fetcher = vi.fn(async () => new Response(null, { status }))
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(fetchArxivItems(interest, { fetcher, sleep })).rejects.toThrow(`status ${status}`)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('does not send a request if the caller already aborted', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(atomFeed))
    const reason = new Error('caller canceled')
    await expect(
      fetchArxivItems(interest, { fetcher, signal: AbortSignal.abort(reason) })
    ).rejects.toBe(reason)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('prefers the caller abort reason when an attempt also reports a timeout', async () => {
    const controller = new AbortController()
    const reason = new Error('caller canceled')
    const fetcher = vi.fn(async () => {
      controller.abort(reason)
      throw new DOMException('Timed out', 'TimeoutError')
    })
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(
      fetchArxivItems(interest, { fetcher, sleep, signal: controller.signal })
    ).rejects.toBe(reason)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('cancels immediately during retry backoff', async () => {
    vi.useFakeTimers()
    try {
      const controller = new AbortController()
      const reason = new Error('caller canceled')
      const fetcher = vi.fn(async () => new Response(null, { status: 429 }))
      const canceled = expect(
        fetchArxivItems(interest, { fetcher, signal: controller.signal })
      ).rejects.toBe(reason)

      await vi.advanceTimersByTimeAsync(1)
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(1)
      controller.abort(reason)
      await canceled
      expect(vi.getTimerCount()).toBe(0)
      expect(fetcher).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
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

  it('uses exponential backoff when Retry-After is invalid', async () => {
    const rateLimited = () =>
      new Response(null, { status: 429, headers: { 'Retry-After': 'soon' } })
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => rateLimited())
      .mockImplementationOnce(async () => rateLimited())
      .mockResolvedValueOnce(new Response(atomFeed))
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(fetchArxivItems(interest, { fetcher, sleep })).resolves.toHaveLength(1)
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls).toEqual([[3_000], [6_000]])
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

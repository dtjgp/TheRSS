import { describe, expect, it, vi } from 'vitest'
import { fetchConfiguredHttpDocument } from './configuredHttpClient'

describe('fetchConfiguredHttpDocument', () => {
  it('retrieves a configured feed through the bounded credential-free client', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe('https://news.ycombinator.com/rss')
      expect(new Headers(init?.headers).has('Authorization')).toBe(false)
      expect(new Headers(init?.headers).get('Accept')).toContain('application/rss+xml')
      return new Response('<rss><channel><title>Hacker News</title></channel></rss>', {
        status: 200,
        headers: { 'Content-Type': 'application/rss+xml' }
      })
    })

    await expect(
      fetchConfiguredHttpDocument('folo:44', {
        fetcher,
        now: new Date('2026-08-19T10:00:00.000Z')
      })
    ).resolves.toEqual({
      sourceId: 'folo:44',
      transport: 'feed',
      endpoint: 'https://news.ycombinator.com/rss',
      contentType: 'application/rss+xml',
      retrievedAt: '2026-08-19T10:00:00.000Z',
      body: '<rss><channel><title>Hacker News</title></channel></rss>'
    })
  })

  it('keeps landing-page HTML untrusted and rejects non-HTTP configured transports', async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response('<html><script>untrusted()</script><h1>NBER</h1></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        })
    )
    const result = await fetchConfiguredHttpDocument('folo:611', { fetcher })

    expect(result.transport).toBe('html')
    expect(result.body).toContain('<script>untrusted()</script>')
    await expect(fetchConfiguredHttpDocument('folo:64', { fetcher })).rejects.toThrow(
      'does not use bounded HTTP document retrieval'
    )
  })

  it('decodes the fixed C114 source with its explicit legacy encoding', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      expect(String(input)).toBe('https://www.c114.com.cn/')
      return new Response(new Uint8Array([0xb2, 0xe2, 0xca, 0xd4]), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=gb2312' }
      })
    })

    await expect(fetchConfiguredHttpDocument('folo:523', { fetcher })).resolves.toMatchObject({
      sourceId: 'folo:523',
      transport: 'html',
      endpoint: 'https://www.c114.com.cn/',
      body: '测试'
    })
  })

  it('retries the NCPSD primary endpoint and then uses its fixed mobile fallback', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(
        new Response('<html><main>latest papers</main></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        })
      )
    const sleep = vi.fn().mockResolvedValue(undefined)

    const result = await fetchConfiguredHttpDocument('folo:611', { fetcher, sleep })

    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
      'https://www.ncpssd.cn/',
      'https://www.ncpssd.cn/',
      'https://m.ncpssd.cn/'
    ])
    expect(sleep).toHaveBeenCalledOnce()
    expect(result.endpoint).toBe('https://m.ncpssd.cn/')
  })

  it('rejects failed or unexpectedly typed responses', async () => {
    await expect(
      fetchConfiguredHttpDocument('folo:44', {
        fetcher: async () => new Response('down', { status: 503 })
      })
    ).rejects.toThrow('Configured source folo:44 request failed with status 503')

    await expect(
      fetchConfiguredHttpDocument('folo:44', {
        fetcher: async () =>
          new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      })
    ).rejects.toThrow('Configured source folo:44 returned unexpected content type')
  })

  it('rejects redirects outside the fixed source origin and reports network failures', async () => {
    const redirected = new Response('<rss></rss>', {
      status: 200,
      headers: { 'Content-Type': 'application/rss+xml' }
    })
    Object.defineProperty(redirected, 'url', { value: 'https://example.com/feed' })

    await expect(
      fetchConfiguredHttpDocument('folo:44', { fetcher: async () => redirected })
    ).rejects.toThrow('redirected outside its fixed HTTPS origin')
    await expect(
      fetchConfiguredHttpDocument('folo:44', {
        fetcher: async () => {
          throw new DOMException('timed out', 'TimeoutError')
        }
      })
    ).rejects.toThrow('Configured source folo:44 request failed: timed out')
  })
})

import { describe, expect, it, vi } from 'vitest'
import { fetchDatedFeedSource } from './datedFeedAdapter'
import { getConfiguredSourceDefinition } from './configuredSources'

describe('fetchDatedFeedSource', () => {
  it('enriches undated NBER RSS entries from fixed-origin article metadata', async () => {
    const fetchDocument = vi.fn().mockResolvedValue({
      sourceId: 'folo:444',
      transport: 'feed',
      endpoint: 'https://back.nber.org/rss/new.xml',
      contentType: 'application/xml',
      retrievedAt: '2026-08-19T12:00:00.000Z',
      body: `<rss><channel><item><guid>https://www.nber.org/papers/w35591#fromrss</guid>
        <title>New energy-market evidence -- by A. Researcher</title>
        <description>Bounded working-paper abstract.</description>
        <link>https://www.nber.org/papers/w35591#fromrss</link>
      </item></channel></rss>`
    })
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          '<html><meta name="citation_publication_date" content="2026/08/17" /></html>',
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        )
      )

    const batch = await fetchDatedFeedSource(
      getConfiguredSourceDefinition('folo:444'),
      { now: new Date('2026-08-19T12:00:00.000Z') },
      { fetchDocument, fetcher }
    )

    expect(fetcher).toHaveBeenCalledWith(
      'https://www.nber.org/papers/w35591#fromrss',
      expect.objectContaining({ redirect: 'follow' })
    )
    expect(batch).toEqual({
      items: [
        expect.objectContaining({
          source: 'folo:444',
          kind: 'paper',
          title: 'New energy-market evidence -- by A. Researcher',
          summary: 'Bounded working-paper abstract.',
          url: 'https://www.nber.org/papers/w35591#fromrss',
          publishedAt: '2026-08-17T00:00:00.000Z'
        })
      ],
      rejectedCount: 0
    })
  })

  it('parses Nikkei RDF and counts missing or unsafe article dates as rejected', async () => {
    const fetchDocument = vi.fn().mockResolvedValue({
      sourceId: 'folo:177',
      transport: 'feed',
      endpoint: 'https://asia.nikkei.com/rss/feed/nar',
      contentType: 'application/rss+xml',
      retrievedAt: '2026-08-19T12:00:00.000Z',
      body: `<rdf:RDF xmlns:rdf="x"><item rdf:about="https://asia.nikkei.com/business/one">
        <title>Asia industry signal</title><link>https://asia.nikkei.com/business/one</link>
      </item><item rdf:about="https://example.com/unsafe">
        <title>Unsafe host</title><link>https://example.com/unsafe</link>
      </item></rdf:RDF>`
    })
    const fetcher = vi.fn().mockResolvedValue(
      new Response('<meta name="date" content="2026-08-19T23:25:28.000+09:00" />', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    )

    const batch = await fetchDatedFeedSource(
      getConfiguredSourceDefinition('folo:177'),
      { now: new Date('2026-08-19T12:00:00.000Z') },
      { fetchDocument, fetcher }
    )

    expect(batch.items).toEqual([
      expect.objectContaining({
        source: 'folo:177',
        title: 'Asia industry signal',
        publishedAt: '2026-08-19T14:25:28.000Z'
      })
    ])
    expect(batch.rejectedCount).toBe(1)
  })

  it('rejects non-dated definitions and isolates article-level HTTP and content failures', async () => {
    await expect(
      fetchDatedFeedSource(
        getConfiguredSourceDefinition('folo:44'),
        { now: new Date('2026-08-19T12:00:00.000Z') },
        {}
      )
    ).rejects.toThrow('is not a dated feed')

    const fetchDocument = vi.fn().mockResolvedValue({
      sourceId: 'folo:444',
      transport: 'feed',
      endpoint: 'https://back.nber.org/rss/new.xml',
      contentType: 'application/xml',
      retrievedAt: '2026-08-19T12:00:00.000Z',
      body: `<rss><channel>
        <item><title>Unavailable paper</title><link>https://www.nber.org/papers/w1</link></item>
        <item><title>Wrong content</title><link>https://www.nber.org/papers/w2</link></item>
        <item><title>Fallback metadata</title><link>https://www.nber.org/papers/w3</link></item>
      </channel></rss>`
    })
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      )
      .mockResolvedValueOnce(
        new Response("<meta name='dcterms.date' content='2026-08-16T09:00:00Z'>", {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        })
      )

    const batch = await fetchDatedFeedSource(
      getConfiguredSourceDefinition('folo:444'),
      { now: new Date('2026-08-19T12:00:00.000Z') },
      { fetchDocument, fetcher }
    )

    expect(batch.items).toEqual([
      expect.objectContaining({
        title: 'Fallback metadata',
        publishedAt: '2026-08-16T09:00:00.000Z'
      })
    ])
    expect(batch.rejectedCount).toBe(2)
  })
})

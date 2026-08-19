import { describe, expect, it } from 'vitest'
import type { ConfiguredHttpDocument } from './configuredHttpClient'
import {
  normalizeConfiguredItem,
  normalizeFeedDocument,
  normalizeHtmlDocument
} from './sourceNormalizer'

describe('configured source normalization', () => {
  it('normalizes RSS and Atom entries to bounded plain-text discovery items', () => {
    const document: ConfiguredHttpDocument = {
      sourceId: 'folo:302',
      transport: 'feed',
      endpoint: 'https://rsshub.rssforever.com/baai/hub',
      contentType: 'application/rss+xml',
      retrievedAt: '2026-08-19T09:00:00.000Z',
      body: `<?xml version="1.0"?><rss><channel><item>
        <guid>baai-1</guid><title>New edge model</title>
        <link>https://www.baai.ac.cn/news/baai-1</link>
        <description><![CDATA[<p>Efficient inference</p><script>alert(1)</script>]]></description>
        <pubDate>Wed, 19 Aug 2026 08:30:00 GMT</pubDate><category>Edge AI</category>
      </item><item><title>Missing date</title><link>https://www.baai.ac.cn/news/old</link></item></channel></rss>`
    }

    expect(normalizeFeedDocument(document)).toEqual({
      items: [
        expect.objectContaining({
          source: 'folo:302',
          kind: 'article',
          externalId: 'baai-1',
          title: 'New edge model',
          summary: 'Efficient inference',
          url: 'https://www.baai.ac.cn/news/baai-1',
          publishedAt: '2026-08-19T08:30:00.000Z',
          topics: ['Edge AI']
        })
      ],
      rejectedCount: 1
    })
  })

  it('extracts dated JSON-LD articles without rendering remote HTML', () => {
    const document: ConfiguredHttpDocument = {
      sourceId: 'folo:444',
      transport: 'html',
      endpoint: 'https://www.nber.org/',
      contentType: 'text/html',
      retrievedAt: '2026-08-19T09:00:00.000Z',
      body: `<html><script type="application/ld+json">{
        "@type":"NewsArticle","headline":"Working paper update",
        "description":"<b>Energy-market evidence</b>",
        "url":"/papers/w123","datePublished":"2026-08-19T07:00:00Z",
        "author":[{"name":"A. Researcher"}]
      }</script><script>alert('never execute')</script></html>`
    }

    expect(normalizeHtmlDocument(document)).toEqual({
      items: [
        expect.objectContaining({
          source: 'folo:444',
          title: 'Working paper update',
          summary: 'Energy-market evidence',
          url: 'https://www.nber.org/papers/w123',
          authors: ['A. Researcher']
        })
      ],
      rejectedCount: 0
    })
  })

  it('falls back to semantic article markup while still requiring a source date', () => {
    const document: ConfiguredHttpDocument = {
      sourceId: 'folo:84',
      transport: 'html',
      endpoint: 'https://www.mckinsey.com.cn/',
      contentType: 'text/html',
      retrievedAt: '2026-08-19T09:00:00.000Z',
      body: `<main><article><h2><a href="/insights/energy-ai">AI and energy</a></h2>
        <time datetime="2026-08-19T06:00:00Z">Today</time>
        <p>How efficient systems change energy demand.</p></article>
        <article><h2><a href="/insights/no-date">Undated</a></h2></article></main>`
    }

    expect(normalizeHtmlDocument(document)).toEqual({
      items: [
        expect.objectContaining({
          source: 'folo:84',
          title: 'AI and energy',
          summary: 'How efficient systems change energy demand.',
          url: 'https://www.mckinsey.com.cn/insights/energy-ai'
        })
      ],
      rejectedCount: 1
    })
  })

  it('maps Hugging Face and X records into the same typed model', () => {
    const item = normalizeConfiguredItem({
      id: 'huggingface:model:org/model',
      sourceId: 'folo:64',
      externalId: 'org/model',
      kind: 'model',
      title: 'org/model',
      summary: 'An efficient model',
      url: 'https://huggingface.co/org/model',
      publishedAt: '2026-08-19T08:00:00.000Z',
      authors: [],
      tags: ['edge-ai'],
      metrics: { downloads: 12 }
    })

    expect(item).toMatchObject({
      id: 'folo:64:model:org/model',
      source: 'folo:64',
      kind: 'model',
      updatedAt: '2026-08-19T08:00:00.000Z',
      topics: ['edge-ai'],
      metrics: { downloads: 12 }
    })
  })

  it('rejects unsafe or incomplete configured records and filters unsupported metrics', () => {
    const base = {
      id: 'item',
      sourceId: 'folo:2',
      externalId: '1',
      kind: 'post' as const,
      title: 'A valid post',
      summary: 'Summary',
      url: 'https://x.com/user/status/1',
      publishedAt: '2026-08-19T08:00:00Z',
      authors: ['Author'],
      tags: [],
      metrics: { likes: 2, unsupported: 4, downloads: -1 }
    }
    expect(normalizeConfiguredItem(base).metrics).toEqual({ likes: 2 })
    expect(
      normalizeConfiguredItem({ ...base, title: ['not allowed'] as unknown as string }).title
    ).toBe('not allowed')
    expect(normalizeConfiguredItem({ ...base, externalId: 'x'.repeat(500) }).id).toMatch(
      /^folo:2:post:sha256:[a-f0-9]{64}$/u
    )
    expect(() => normalizeConfiguredItem({ ...base, sourceId: 'unknown' })).toThrow(
      'is not an active external source'
    )
    expect(() => normalizeConfiguredItem({ ...base, sourceId: 'arxiv' })).toThrow(
      'is not an active external source'
    )
    expect(() => normalizeConfiguredItem({ ...base, title: '<b></b>' })).toThrow('has no title')
    expect(() => normalizeConfiguredItem({ ...base, publishedAt: 'invalid' })).toThrow(
      'no valid publication date'
    )
    expect(() => normalizeConfiguredItem({ ...base, externalId: '' })).toThrow('has no identifier')
    expect(normalizeConfiguredItem({ ...base, url: 'http://x.com/1' }).url).toBe('https://x.com/1')
    expect(() => normalizeConfiguredItem({ ...base, url: 'https://user:secret@x.com/1' })).toThrow(
      'credential-free HTTPS'
    )
  })

  it('supports Atom alternate links, structured authors, and RDF feeds', () => {
    const atom = normalizeFeedDocument({
      sourceId: 'folo:182',
      transport: 'feed',
      endpoint: 'https://rsshub.rssforever.com/openai/news',
      contentType: 'application/atom+xml',
      retrievedAt: '2026-08-19T09:00:00.000Z',
      body: `<feed><entry><id>atom-1</id><title>Model release</title>
        <link rel="self" href="https://rsshub.rssforever.com/openai/news/1"/>
        <link rel="alternate" href="https://openai.com/news/model-release"/>
        <updated>2026-08-19T08:00:00Z</updated><summary>Release notes</summary>
        <author><name>Research team</name></author><category term="AI"/></entry></feed>`
    })
    const rdf = normalizeFeedDocument({
      sourceId: 'folo:79',
      transport: 'feed',
      endpoint: 'https://www.solidot.org/index.rss',
      contentType: 'application/rss+xml',
      retrievedAt: '2026-08-19T09:00:00.000Z',
      body: `<rdf:RDF xmlns:rdf="x"><item><title>Systems news</title>
        <link>https://www.solidot.org/story/1</link><dc:date xmlns:dc="x">2026-08-19T07:00:00Z</dc:date>
        <dc:creator xmlns:dc="x">Reporter</dc:creator></item></rdf:RDF>`
    })

    expect(atom.items[0]).toMatchObject({
      url: 'https://openai.com/news/model-release',
      authors: ['Research team'],
      topics: ['AI']
    })
    expect(rdf.items[0]).toMatchObject({ authors: ['Reporter'] })
  })

  it('keeps parser type boundaries and accounts for malformed JSON-LD', () => {
    const htmlDocument: ConfiguredHttpDocument = {
      sourceId: 'folo:444',
      transport: 'html',
      endpoint: 'https://www.nber.org/',
      contentType: 'text/html',
      retrievedAt: '2026-08-19T09:00:00.000Z',
      body: '<script type="application/ld+json">not-json</script>'
    }
    const feedDocument: ConfiguredHttpDocument = {
      ...htmlDocument,
      sourceId: 'folo:302',
      transport: 'feed',
      contentType: 'application/rss+xml',
      body: '<rss><channel /></rss>'
    }

    expect(() => normalizeFeedDocument(htmlDocument)).toThrow('Expected a configured feed')
    expect(() => normalizeHtmlDocument(feedDocument)).toThrow('Expected a configured HTML')
    expect(normalizeHtmlDocument(htmlDocument)).toEqual({ items: [], rejectedCount: 1 })
    expect(
      normalizeHtmlDocument({ ...htmlDocument, contentType: 'application/json', body: 'not-json' })
    ).toEqual({ items: [], rejectedCount: 1 })
  })
})

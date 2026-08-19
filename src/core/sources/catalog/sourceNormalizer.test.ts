import { describe, expect, it } from 'vitest'
import type { ConfiguredHttpDocument } from './configuredHttpClient'
import { normalizeC114Document } from './c114Normalizer'
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

  it('normalizes bounded C114 mobile listings without executing remote HTML', () => {
    const document: ConfiguredHttpDocument = {
      sourceId: 'folo:523',
      transport: 'html',
      endpoint: 'https://m.c114.com.cn/',
      contentType: 'text/html; charset=gb2312',
      retrievedAt: '2026-08-19T09:00:00.000Z',
      body: `<div class="contentList"><div class="titImg">
        <a href="https://m.c114.com.cn/w126-1301901.html">通信网络与边缘智能新进展</a>
        <span class="time"><span>8/19</span></span>
      </div></div><div class="contentList"><div class="titImg">
        <a href="javascript:alert(1)">不安全记录</a><span class="time"><span>8/19</span></span>
      </div></div>`
    }

    expect(normalizeC114Document(document)).toEqual({
      items: [
        expect.objectContaining({
          source: 'folo:523',
          kind: 'article',
          title: '通信网络与边缘智能新进展',
          url: 'https://m.c114.com.cn/w126-1301901.html',
          publishedAt: '2026-08-19T00:00:00.000Z'
        })
      ],
      rejectedCount: 1
    })
  })

  it('normalizes the bounded C114 desktop latest-news list', () => {
    const document: ConfiguredHttpDocument = {
      sourceId: 'folo:523',
      transport: 'html',
      endpoint: 'https://www.c114.com.cn/',
      contentType: 'text/html',
      retrievedAt: '2026-08-19T23:00:00.000Z',
      body: `<div class="center_list"><a href="https://www.c114.com.cn/news/116/a1315962.html">
        <img src="cover.jpg" alt="ignored"><div class="text"><div class="title">
        Anthropic 扩展循环信贷额度</div><div class="time">8/19 22:05</div></div></a></div>
        <div class="center_list"><a href="javascript:alert(1)"><div class="text">
        <div class="title">不安全记录</div><div class="time">8/19 20:49</div>
        </div></a></div>`
    }

    expect(normalizeC114Document(document)).toEqual({
      items: [
        expect.objectContaining({
          source: 'folo:523',
          kind: 'article',
          title: 'Anthropic 扩展循环信贷额度',
          url: 'https://www.c114.com.cn/news/116/a1315962.html',
          publishedAt: '2026-08-19T00:00:00.000Z'
        })
      ],
      rejectedCount: 1
    })
  })

  it('maps Hugging Face records into the shared typed model', () => {
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
      sourceId: 'folo:182',
      externalId: '1',
      kind: 'article' as const,
      title: 'A valid article',
      summary: 'Summary',
      url: 'https://openai.com/news/1',
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
      /^folo:182:article:sha256:[a-f0-9]{64}$/u
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
    expect(normalizeConfiguredItem({ ...base, url: 'http://openai.com/1' }).url).toBe(
      'https://openai.com/1'
    )
    expect(() =>
      normalizeConfiguredItem({ ...base, url: 'https://user:secret@openai.com/1' })
    ).toThrow('credential-free HTTPS')
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

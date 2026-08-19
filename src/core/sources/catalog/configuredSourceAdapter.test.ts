import { describe, expect, it, vi } from 'vitest'
import type { InterestProfile } from '../../interests/interestProfile'
import { getConfiguredSourceDefinition } from './configuredSources'
import { fetchConfiguredSourceBatch } from './configuredSourceAdapter'

const profile: InterestProfile = {
  name: 'Adapter test',
  arxiv: {
    categories: ['cs.LG'],
    keywords: ['edge ai'],
    excludeKeywords: ['medical imaging']
  },
  github: {
    keywords: ['model compression'],
    topics: ['smart-grid'],
    languages: []
  }
}
const now = new Date('2026-08-19T09:00:00.000Z')

describe('fetchConfiguredSourceBatch', () => {
  it('routes fixed RSS and HTML responses through their safe normalizers', async () => {
    const feed = await fetchConfiguredSourceBatch(
      getConfiguredSourceDefinition('folo:302'),
      profile,
      { now },
      {
        fetchHttp: vi.fn().mockResolvedValue({
          sourceId: 'folo:302',
          transport: 'feed',
          endpoint: 'https://rsshub.rssforever.com/baai/hub',
          contentType: 'application/rss+xml',
          retrievedAt: now.toISOString(),
          body: '<rss><channel><item><guid>1</guid><title>Edge AI</title><link>https://www.baai.ac.cn/1</link><pubDate>2026-08-19T08:00:00Z</pubDate></item></channel></rss>'
        })
      }
    )
    const html = await fetchConfiguredSourceBatch(
      getConfiguredSourceDefinition('folo:611'),
      profile,
      { now },
      {
        fetchHttp: vi.fn().mockResolvedValue({
          sourceId: 'folo:611',
          transport: 'html',
          endpoint: 'https://www.ncpssd.cn/',
          contentType: 'text/html',
          retrievedAt: now.toISOString(),
          body: `<ul class="latest-list"><li>
            <a onclick="openDetail('/Literature/secure/articleinfo?params=one')"
              title="Energy-market policy">Energy-market policy</a>
            <span>《经济研究》2026年8月</span>
          </li></ul>`
        })
      }
    )

    expect(feed.items[0]).toMatchObject({ source: 'folo:302', kind: 'article' })
    expect(html.items[0]).toMatchObject({ source: 'folo:611', kind: 'paper' })
  })

  it('routes NBER and Nikkei through dated official-feed enrichment', async () => {
    const fetchDatedFeed = vi.fn().mockResolvedValue({ items: [], rejectedCount: 0 })

    await fetchConfiguredSourceBatch(
      getConfiguredSourceDefinition('folo:444'),
      profile,
      { now },
      { fetchDatedFeed }
    )

    expect(fetchDatedFeed).toHaveBeenCalledWith(getConfiguredSourceDefinition('folo:444'), { now })
  })

  it('normalizes Hugging Face records and forwards an optional token', async () => {
    const fetchHuggingFace = vi.fn().mockResolvedValue([
      {
        id: 'huggingface:model:org/model',
        sourceId: 'folo:64',
        externalId: 'org/model',
        kind: 'model',
        title: 'org/model',
        summary: 'Edge model',
        url: 'https://huggingface.co/org/model',
        publishedAt: '2026-08-19T08:00:00Z',
        authors: [],
        tags: ['edge-ai'],
        metrics: { downloads: 2 }
      },
      {
        id: 'invalid',
        sourceId: 'folo:64',
        externalId: '',
        kind: 'model',
        title: '',
        summary: '',
        url: 'https://huggingface.co/invalid',
        publishedAt: 'invalid',
        authors: [],
        tags: [],
        metrics: {}
      }
    ])

    const batch = await fetchConfiguredSourceBatch(
      getConfiguredSourceDefinition('folo:64'),
      profile,
      { now, huggingFaceToken: 'hf_example' },
      { fetchHuggingFace }
    )

    expect(fetchHuggingFace).toHaveBeenCalledWith({
      maxItemsPerKind: 10,
      token: 'hf_example'
    })
    expect(batch).toMatchObject({ rejectedCount: 1 })
    expect(batch.items).toHaveLength(1)
  })

  it('builds a bounded latest X query from the research profile', async () => {
    const fetchX = vi.fn().mockResolvedValue([])
    await fetchConfiguredSourceBatch(
      getConfiguredSourceDefinition('folo:2'),
      profile,
      { now },
      { fetchX }
    )

    expect(fetchX).toHaveBeenCalledWith(
      '"edge ai" OR "model compression" OR smart-grid -"medical imaging"',
      { count: 20 }
    )
  })

  it('does not issue an unbounded X search without a keyword or topic', async () => {
    await expect(
      fetchConfiguredSourceBatch(
        getConfiguredSourceDefinition('folo:2'),
        {
          ...profile,
          arxiv: { categories: ['cs.LG'], keywords: [], excludeKeywords: [] },
          github: { keywords: [], topics: [], languages: ['Python'] }
        },
        { now },
        { fetchX: vi.fn() }
      )
    ).rejects.toThrow('X retrieval requires at least one keyword or topic')
  })
})

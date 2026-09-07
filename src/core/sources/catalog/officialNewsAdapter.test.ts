import { Buffer } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import { fetchConfiguredSourceBatch } from './configuredSourceAdapter'
import { getConfiguredSourceDefinition } from './configuredSources'

const now = new Date('2026-09-07T10:00:00Z')
const profile = {
  name: 'Official news fixtures',
  arxiv: { categories: [], keywords: [], excludeKeywords: [] },
  github: { keywords: [], topics: [], languages: [] }
}
function read(sourceId: string, body: string) {
  return fetchConfiguredSourceBatch(
    getConfiguredSourceDefinition(sourceId),
    profile,
    { now },
    {
      fetchHttp: vi.fn().mockResolvedValue({
        sourceId,
        body,
        transport: sourceId === 'folo:67' ? 'html' : 'json',
        contentType: sourceId === 'folo:67' ? 'text/html' : 'application/json',
        retrievedAt: now.toISOString(),
        endpoint: 'https://fixture.invalid/'
      })
    }
  )
}
const baai = {
  is_event: false,
  story_id: 123,
  story_info: {
    id: 123,
    title: '研究动态',
    content: '<b>公开摘要</b><script>untrusted()</script>',
    created_at: '2026-09-07 17:30 分享',
    user_name: '研究团队',
    tag_names: [{ title: 'AI' }]
  }
}
const mit = {
  id: 456,
  name: '工程方法',
  summary: '公开简述',
  start_time: 1788773322,
  authors: [{ username: '作者', summary: 'unneeded contact details' }],
  typeName: '人工智能'
}
const aibase = {
  Id: 789,
  title: '技术新闻',
  description: '公开摘要',
  summary: '$1e',
  addtime: '2026-09-07 17:41:29',
  author: '编辑'
}
const push = (value: string) => `<script>self.__next_f.push(${JSON.stringify([1, value])})</script>`
const frame = (rows: unknown) =>
  `0:${JSON.stringify(['$', 'main', null, { initialArticles: rows }])}\n`

describe('official news adapters', () => {
  it('reads the official BAAI list while retaining legacy URL identity and bounded plain text', async () => {
    const result = await read('folo:302', JSON.stringify({ code: 0, data: [baai, baai] }))
    expect(result.rejectedCount).toBe(0)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'folo:302:article:https://hub.baai.ac.cn/view/123',
      externalId: 'https://hub.baai.ac.cn/view/123',
      source: 'folo:302',
      kind: 'article',
      title: '研究动态',
      summary: '公开摘要',
      publishedAt: '2026-09-07T09:30:00.000Z',
      authors: ['研究团队'],
      topics: ['AI']
    })
  })
  it('uses MIT list timestamps without fetching article bodies or author profiles', async () => {
    const result = await read('folo:93', JSON.stringify({ code: 10000, data: { items: [mit] } }))
    expect(result.items[0]).toMatchObject({
      externalId: 'https://www.mittrchina.com/news/detail/456',
      publishedAt: new Date(mit.start_time * 1000).toISOString(),
      summary: '公开简述',
      authors: ['作者'],
      topics: ['人工智能']
    })
    expect(JSON.stringify(result)).not.toContain('unneeded contact details')
  })
  it('parses AIbase split JSON frames and skips multibyte text without executing scripts', async () => {
    const rawText = '中文\n0:{"initialArticles":[{"Id":999}]}\n'
    const encoded = `a:T${Buffer.byteLength(rawText).toString(16)},${rawText}${frame([aibase])}`
    const result = await read(
      'folo:67',
      '<script>throw new Error("never execute")</script>' +
        push(':HL["/style.css"]\n') +
        push(encoded.slice(0, 17)) +
        push(encoded.slice(17))
    )
    expect(result).toMatchObject({
      rejectedCount: 0,
      items: [
        {
          externalId: 'https://www.aibase.com/zh/news/789',
          summary: '公开摘要',
          publishedAt: '2026-09-07T09:41:29.000Z'
        }
      ]
    })
    expect(JSON.stringify(result)).not.toContain('$1e')
  })
  it.each([
    ['folo:302', JSON.stringify({ code: 0, data: [] })],
    ['folo:93', JSON.stringify({ code: 10000, data: { items: [] } })],
    ['folo:67', push(frame([]))]
  ])('recognizes explicit empty containers for %s', async (id, body) => {
    expect(await read(id, body)).toEqual({ items: [], rejectedCount: 0 })
  })
  it.each([
    ['folo:302', '{'],
    ['folo:302', JSON.stringify({ code: 1, data: [] })],
    ['folo:302', JSON.stringify({ code: 0, data: {} })],
    ['folo:93', JSON.stringify({ code: 10000, data: {} })],
    ['folo:93', JSON.stringify({ code: 401, data: { items: [] } })],
    ['folo:67', '<html>Access denied</html>'],
    ['folo:67', push('0:{"initialArticles":{}}\n')],
    ['folo:67', push('a:Tffff,short')],
    ['folo:67', push('a:Tbad-length,data')],
    ['folo:67', push('0:{"initialArticles":[]')],
    ['folo:67', push('0:[invalid]\n')],
    ['folo:67', 'x'.repeat(5_000_001)]
  ])('fails closed on missing, malformed, or truncated lists for %s', async (id, body) => {
    await expect(read(id, body)).rejects.toThrow()
  })
  it('rejects event dates, invalid calendar dates and invalid identifiers independently', async () => {
    const result = await read(
      'folo:302',
      JSON.stringify({
        code: 0,
        data: [
          baai,
          { ...baai, is_event: true },
          { ...baai, story_info: { ...baai.story_info, created_at: '2026-02-30 10:00 发布' } },
          { ...baai, story_id: '../escape' },
          null,
          { ...baai, story_info: { ...baai.story_info, title: '' } }
        ]
      })
    )
    expect(result.items).toHaveLength(1)
    expect(result.rejectedCount).toBe(5)
    const mitResult = await read(
      'folo:93',
      JSON.stringify({
        code: 10000,
        data: {
          items: [
            mit,
            { ...mit, start_time: null },
            { ...mit, id: -1 },
            { ...mit, start_time: 1e30 }
          ]
        }
      })
    )
    expect(mitResult.items).toHaveLength(1)
    expect(mitResult.rejectedCount).toBe(3)
    const aiResult = await read(
      'folo:67',
      push(frame([aibase, { ...aibase, addtime: 'yesterday' }, { ...aibase, Id: 1.5 }]))
    )
    expect(aiResult.items).toHaveLength(1)
    expect(aiResult.rejectedCount).toBe(2)
  })
  it('bounds list size, nesting and frame count', async () => {
    const rows = Array.from({ length: 110 }, (_, i) => ({ ...aibase, Id: i + 1 }))
    expect((await read('folo:67', push(frame(rows)))).items).toHaveLength(100)
    let deep: unknown = { initialArticles: [] }
    for (let i = 0; i < 40; i++) deep = { child: deep }
    await expect(read('folo:67', push(`0:${JSON.stringify(deep)}\n`))).rejects.toThrow()
    await expect(read('folo:67', push('0:I[]\n'.repeat(10_001) + frame([])))).rejects.toThrow()
  })
})

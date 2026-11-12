import { describe, expect, it } from 'vitest'
import type { ConfiguredHttpDocument } from './configuredHttpClient'
import { normalizeNcpssdDocument } from './ncpssdNormalizer'

describe('normalizeNcpssdDocument', () => {
  it('distinguishes a missing list from an explicitly empty list and rejects an impossible month', () => {
    const document: ConfiguredHttpDocument = {
      sourceId: 'folo:611',
      transport: 'html',
      endpoint: 'https://www.ncpssd.cn/',
      contentType: 'text/html',
      retrievedAt: '2026-09-07',
      body: '<html>Unavailable</html>'
    }
    expect(() => normalizeNcpssdDocument(document)).toThrow(/list/i)
    expect(normalizeNcpssdDocument({ ...document, body: '<ul class="latest-list"></ul>' })).toEqual(
      { items: [], rejectedCount: 0 }
    )
    expect(
      normalizeNcpssdDocument({
        ...document,
        body: '<ul class="latest-list"><li><a onclick="openDetail(\'/Literature/secure/articleinfo?params=test\')" title="Paper">Paper</a><span>《期刊》2026年13月</span></li></ul>'
      })
    ).toMatchObject({ items: [], rejectedCount: 1 })
  })
  it('extracts the official latest-literature list without executing onclick JavaScript', () => {
    const document: ConfiguredHttpDocument = {
      sourceId: 'folo:611',
      transport: 'html',
      endpoint: 'https://www.ncpssd.cn/',
      contentType: 'text/html',
      retrievedAt: '2026-08-19T12:00:00.000Z',
      body: `<ul class="clr latest-list"><li>
        <a onclick="openDetail('/Literature/secure/articleinfo?params=safe-token&amp;synUpdateType=2')"
          href="javascript:void(0)" title="人工智能与科学发现">人工智能与科学发现</a>
        <span>《科学与社会》2026年8月</span>
      </li><li><a href="javascript:void(0)" title="missing route">missing route</a></li></ul>`
    }

    expect(normalizeNcpssdDocument(document)).toEqual({
      items: [
        expect.objectContaining({
          source: 'folo:611',
          kind: 'paper',
          title: '人工智能与科学发现',
          summary: '《科学与社会》2026年8月',
          url: 'https://www.ncpssd.cn/Literature/secure/articleinfo?params=safe-token&synUpdateType=2',
          publishedAt: '2026-08-01T00:00:00.000Z'
        })
      ],
      rejectedCount: 1
    })
  })

  it('counts issue-numbered entries as omitted, not invalid', () => {
    const entry = (title: string, date: string) =>
      `<li><a onclick="openDetail('/Literature/articleinfo?id=${title}')" title="${title}">${title}</a><span>《期刊》${date}</span></li>`
    const document: ConfiguredHttpDocument = {
      sourceId: 'folo:611',
      transport: 'html',
      endpoint: 'https://www.ncpssd.cn/',
      contentType: 'text/html',
      retrievedAt: '2026-11-12T06:00:00.000Z',
      body: `<ul class="latest-list">${entry('A', '2026年9期')}${entry('B', '2026年5期')}</ul>`
    }

    expect(normalizeNcpssdDocument(document)).toEqual({
      items: [],
      rejectedCount: 2,
      omittedCount: 2,
      rejectionReason:
        '2 entries lack a publication month; issue numbers were not converted to dates'
    })
    expect(
      normalizeNcpssdDocument({
        ...document,
        body: `<ul class="latest-list">${entry('A', '2026年9期')}<li><a onclick="openDetail('/x')" title=""></a><span>2026年9期</span></li></ul>`
      })
    ).toMatchObject({ items: [], rejectedCount: 2, omittedCount: 1 })
    expect(
      normalizeNcpssdDocument({
        ...document,
        body: `<ul class="latest-list"><li><a onclick="openDetail('https://evil.example/x')" title="C">C</a><span>2026年9期</span></li></ul>`
      })
    ).toEqual({ items: [], rejectedCount: 1 })
  })

  it('rejects documents outside the fixed NCPSD identity', () => {
    expect(() =>
      normalizeNcpssdDocument({
        sourceId: 'folo:444',
        transport: 'html',
        endpoint: 'https://www.nber.org/',
        contentType: 'text/html',
        retrievedAt: '2026-08-19T12:00:00.000Z',
        body: '<html></html>'
      })
    ).toThrow('Expected the NCPSD source document')
  })
})

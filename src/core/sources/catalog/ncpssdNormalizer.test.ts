import { describe, expect, it } from 'vitest'
import type { ConfiguredHttpDocument } from './configuredHttpClient'
import { normalizeNcpssdDocument } from './ncpssdNormalizer'

describe('normalizeNcpssdDocument', () => {
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

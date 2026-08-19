import { describe, expect, it } from 'vitest'
import { CONFIGURED_SOURCE_DEFINITIONS, getConfiguredSourceDefinition } from './configuredSources'

const strictHttpSourceIds = [
  'folo:302',
  'folo:611',
  'folo:444',
  'folo:182',
  'folo:77',
  'folo:208',
  'folo:93',
  'folo:84',
  'folo:67',
  'folo:523',
  'folo:253',
  'folo:44',
  'folo:792',
  'folo:79',
  'folo:172',
  'folo:1104',
  'folo:177',
  'folo:257',
  'folo:312'
] as const

describe('CONFIGURED_SOURCE_DEFINITIONS', () => {
  it('contains the 19 live-verified strict HTTP routes plus Hugging Face', () => {
    expect(CONFIGURED_SOURCE_DEFINITIONS).toHaveLength(20)
    expect(new Set(CONFIGURED_SOURCE_DEFINITIONS.map((source) => source.id)).size).toBe(20)
    expect(
      CONFIGURED_SOURCE_DEFINITIONS.filter((source) => source.transport === 'feed')
    ).toHaveLength(15)
    expect(
      CONFIGURED_SOURCE_DEFINITIONS.filter((source) => source.transport === 'html')
    ).toHaveLength(2)
    expect(
      CONFIGURED_SOURCE_DEFINITIONS.filter((source) => source.transport === 'dated_feed')
    ).toHaveLength(2)
    expect(
      strictHttpSourceIds.every((id) =>
        CONFIGURED_SOURCE_DEFINITIONS.some((source) => source.id === id)
      )
    ).toBe(true)
    expect(CONFIGURED_SOURCE_DEFINITIONS.some((source) => source.id === 'folo:1286')).toBe(false)
  })

  it('uses fixed HTTPS endpoints and preserves the audited route type', () => {
    for (const source of CONFIGURED_SOURCE_DEFINITIONS) {
      if (source.transport === 'feed' || source.transport === 'html') {
        expect(new URL(source.endpoint).protocol).toBe('https:')
        expect(source.verifiedOn).toBe('2026-08-19')
      }
    }

    expect(getConfiguredSourceDefinition('folo:302')).toMatchObject({
      transport: 'feed',
      endpoint: 'https://rsshub.rssforever.com/baai/hub'
    })
    expect(getConfiguredSourceDefinition('folo:611')).toMatchObject({
      transport: 'html',
      endpoint: 'https://www.ncpssd.cn/',
      fallbackEndpoint: 'https://m.ncpssd.cn/',
      retryAttempts: 2
    })
    expect(getConfiguredSourceDefinition('folo:444')).toMatchObject({
      transport: 'dated_feed',
      endpoint: 'https://back.nber.org/rss/new.xml',
      articleOrigin: 'https://www.nber.org',
      dateMetaNames: ['citation_publication_date', 'dcterms.date']
    })
    expect(getConfiguredSourceDefinition('folo:84')).toMatchObject({
      transport: 'feed',
      endpoint: 'https://www.mckinsey.com/insights/rss'
    })
    expect(getConfiguredSourceDefinition('folo:77')).toMatchObject({
      transport: 'feed',
      endpoint: 'https://www.sciencenet.cn/xml/blog.aspx?di=0'
    })
    expect(getConfiguredSourceDefinition('folo:523')).toMatchObject({
      transport: 'html',
      endpoint: 'https://www.c114.com.cn/',
      fallbackEndpoint: 'https://m.c114.com.cn/',
      retryAttempts: 2,
      encoding: 'gb18030'
    })
    expect(getConfiguredSourceDefinition('folo:177')).toMatchObject({
      transport: 'dated_feed',
      endpoint: 'https://asia.nikkei.com/rss/feed/nar',
      articleOrigin: 'https://asia.nikkei.com',
      dateMetaNames: ['date']
    })
  })

  it('configures Hugging Face as three public APIs and excludes deferred X retrieval', () => {
    expect(getConfiguredSourceDefinition('folo:64')).toEqual({
      id: 'folo:64',
      transport: 'huggingface',
      endpoints: {
        models: 'https://huggingface.co/api/models',
        datasets: 'https://huggingface.co/api/datasets',
        papers: 'https://huggingface.co/api/daily_papers'
      }
    })
    expect(() => getConfiguredSourceDefinition('folo:2')).toThrow('is not configured')
  })

  it('rejects unknown configured source identities', () => {
    expect(() => getConfiguredSourceDefinition('folo:1286')).toThrow('is not configured')
  })
})

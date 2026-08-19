import { describe, expect, it } from 'vitest'
import sourceCatalogData from './sourceCatalogData.json'
import { RETAINED_SOURCE_CATALOG_IDS, SOURCE_CATALOG, SOURCE_CATALOG_STATS } from './sourceCatalog'

const expectedRetainedIds = [
  'official:arxiv',
  'folo:10',
  'folo:64',
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

describe('SOURCE_CATALOG', () => {
  it('exposes exactly the 22 previously live-verified source identities', () => {
    expect(RETAINED_SOURCE_CATALOG_IDS).toEqual(expectedRetainedIds)
    expect(SOURCE_CATALOG.map((source) => source.id)).toEqual(expectedRetainedIds)
    expect(SOURCE_CATALOG_STATS).toEqual({
      total: 22,
      priorities: { A: 7, B: 15, C: 0 },
      acquisition: { active: 22, configured: 0, rsshub_candidate: 0, adapter_required: 0 }
    })
    expect(new Set(SOURCE_CATALOG.map((source) => source.id)).size).toBe(22)
    expect(new Set(SOURCE_CATALOG.map((source) => source.name)).size).toBe(22)
    expect(SOURCE_CATALOG.every((source) => source.acquisition === 'active')).toBe(true)
    expect(SOURCE_CATALOG.every((source) => new URL(source.url).protocol === 'https:')).toBe(true)
  })

  it('keeps the larger raw catalog dormant and out of the current product surface', () => {
    expect(sourceCatalogData).toHaveLength(105)
    expect(sourceCatalogData.filter((source) => source.acquisition === 'active')).toHaveLength(22)
    expect(SOURCE_CATALOG.some((source) => source.id === 'folo:2')).toBe(false)
    expect(SOURCE_CATALOG.some((source) => source.name === '3GPP Specifications')).toBe(false)
    expect(SOURCE_CATALOG.some((source) => source.acquisition !== 'active')).toBe(false)
  })
})

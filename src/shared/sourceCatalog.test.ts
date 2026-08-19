import { describe, expect, it } from 'vitest'
import { SOURCE_CATALOG, SOURCE_CATALOG_STATS } from './sourceCatalog'

const expectedOfficialAdditions = [
  '3GPP Specifications',
  'arXiv',
  'ENTSO-E Transparency Platform',
  'IEEE Power & Energy Society (PES)',
  'International Energy Agency (IEA)',
  'International Telecommunication Union (ITU)',
  'MLPerf / MLCommons Benchmarks',
  'National Laboratory of the Rockies (NLR; formerly NREL)',
  'U.S. Energy Information Administration (EIA)',
  'GSMA',
  'NVIDIA Developer Technical Blog'
] as const

describe('SOURCE_CATALOG', () => {
  it('contains the exact selected source counts and unique safe identities', () => {
    expect(SOURCE_CATALOG).toHaveLength(105)
    expect(SOURCE_CATALOG_STATS).toEqual({
      total: 105,
      priorities: { A: 39, B: 63, C: 3 },
      acquisition: { active: 23, configured: 0, rsshub_candidate: 72, adapter_required: 10 }
    })
    expect(new Set(SOURCE_CATALOG.map((source) => source.id)).size).toBe(105)
    expect(new Set(SOURCE_CATALOG.map((source) => source.name)).size).toBe(105)
    expect(SOURCE_CATALOG.every((source) => new URL(source.url).protocol === 'https:')).toBe(true)
  })

  it('preserves the requested C-class identities and official additions', () => {
    expect(
      SOURCE_CATALOG.filter((source) => source.priority === 'C')
        .map((source) => source.name)
        .sort()
    ).toEqual(['LinkedIn', 'Substack', 'X (Twitter)'])
    expect(
      expectedOfficialAdditions.every((name) => SOURCE_CATALOG.some((row) => row.name === name))
    ).toBe(true)
  })

  it('marks the two core and 21 configured adapters as active', () => {
    expect(SOURCE_CATALOG.filter((source) => source.acquisition === 'active')).toHaveLength(23)
    expect(
      ['arXiv', 'GitHub', 'Huggingface', 'X (Twitter)'].every((name) =>
        SOURCE_CATALOG.some((source) => source.name === name && source.acquisition === 'active')
      )
    ).toBe(true)
  })

  it('removes OpenAlex and promotes every executable configured definition', () => {
    expect(SOURCE_CATALOG.some((source) => source.id === 'folo:1286')).toBe(false)
    expect(
      SOURCE_CATALOG.filter(
        (source) => source.acquisition === 'active' && source.id.startsWith('folo:')
      )
        .map((source) => source.id)
        .sort()
    ).toEqual(
      [
        'folo:10',
        'folo:1104',
        'folo:172',
        'folo:177',
        'folo:182',
        'folo:2',
        'folo:208',
        'folo:253',
        'folo:257',
        'folo:302',
        'folo:312',
        'folo:44',
        'folo:444',
        'folo:523',
        'folo:611',
        'folo:64',
        'folo:67',
        'folo:77',
        'folo:79',
        'folo:792',
        'folo:84',
        'folo:93'
      ].sort()
    )
  })
})

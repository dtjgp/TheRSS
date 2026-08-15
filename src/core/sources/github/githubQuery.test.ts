import { describe, expect, it } from 'vitest'
import { buildGitHubRadarQueries } from './githubQuery'

describe('GitHub Interest Radar query construction', () => {
  it('creates small official-search queries for each interest dimension', () => {
    const queries = buildGitHubRadarQueries(
      {
        keywords: ['edge intelligence'],
        topics: ['model-compression'],
        languages: ['Python']
      },
      new Date('2026-08-15T08:00:00Z'),
      14
    )

    expect(queries).toEqual([
      '"edge intelligence" in:name,description,topics pushed:>=2026-08-01 archived:false fork:false',
      'topic:model-compression pushed:>=2026-08-01 archived:false fork:false',
      'language:Python pushed:>=2026-08-01 stars:>=10 archived:false fork:false'
    ])
  })

  it('deduplicates normalized interests', () => {
    const queries = buildGitHubRadarQueries(
      {
        keywords: [' Pruning ', 'pruning'],
        topics: ['edge-ai', 'edge-ai'],
        languages: []
      },
      new Date('2026-08-15T08:00:00Z')
    )

    expect(queries).toHaveLength(2)
  })

  it('rejects unsupported lookback windows', () => {
    expect(() =>
      buildGitHubRadarQueries(
        { keywords: ['pruning'], topics: [], languages: [] },
        new Date('2026-08-15T08:00:00Z'),
        0
      )
    ).toThrow(/between 1 and 90/)
  })
})

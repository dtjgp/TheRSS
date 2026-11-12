import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { DISCOVER_SOURCE_IDS } from '../../shared/discover'
import { ResearchRepository } from './researchRepository'
import { migrateResearchDatabase } from './researchSchema'

/** A database as an earlier release left it: sessions exist, the preference table does not. */
function upgradedDatabase(sessions: readonly { id: string; at: string; searched: string[] }[]) {
  const database = new Database(':memory:')
  migrateResearchDatabase(database)
  database.exec('DROP TABLE discover_source_preference')
  for (const session of sessions) {
    database
      .prepare(
        `INSERT INTO discover_session(id, intent, runner, status, plan_json, provenance_json, created_at)
         VALUES (?, 'question', 'codex', 'completed', '{}', '{}', ?)`
      )
      .run(session.id, session.at)
    for (const source of DISCOVER_SOURCE_IDS)
      database
        .prepare(
          `INSERT INTO discover_source_run(session_id, source, status, result_count, error_message)
           VALUES (?, ?, ?, 0, NULL)`
        )
        .run(session.id, source, session.searched.includes(source) ? 'healthy' : 'not_searched')
  }
  return database
}

describe('default Discover source preference', () => {
  it('starts from the latest searched session once and never from a later session', () => {
    const database = upgradedDatabase([
      { id: 'older', at: '2026-11-01T00:00:00.000Z', searched: ['arxiv'] },
      { id: 'latest', at: '2026-11-10T00:00:00.000Z', searched: ['github', 'arxiv', 'folo:64'] }
    ])
    const repository = new ResearchRepository(database)
    expect(repository.getDiscoverSourcePreference()).toMatchObject({
      sources: ['arxiv', 'github', 'folo:64'],
      unavailable: [],
      origin: 'latest-session'
    })
    // A newer session does not replace an existing preference, also after a reopen.
    database
      .prepare(
        `INSERT INTO discover_session(id, intent, runner, status, plan_json, provenance_json, created_at)
         VALUES ('newest', 'q', 'codex', 'completed', '{}', '{}', '2026-11-11T00:00:00.000Z')`
      )
      .run()
    database
      .prepare(
        `INSERT INTO discover_source_run(session_id, source, status, result_count, error_message)
         VALUES ('newest', 'folo:84', 'healthy', 0, NULL)`
      )
      .run()
    migrateResearchDatabase(database)
    expect(repository.getDiscoverSourcePreference().sources).toEqual(['arxiv', 'github', 'folo:64'])
    repository.close()
  })

  it('starts from all current sources when no session searched any source', () => {
    const repository = new ResearchRepository(
      upgradedDatabase([{ id: 'empty', at: '2026-11-01T00:00:00.000Z', searched: [] }])
    )
    expect(repository.getDiscoverSourcePreference()).toMatchObject({
      sources: DISCOVER_SOURCE_IDS,
      origin: 'all-sources'
    })
    repository.close()
  })

  it('saves one or all sources in registry order and rejects invalid sets without writing', () => {
    const repository = new ResearchRepository(new Database(':memory:'))
    expect(repository.saveDiscoverSourcePreference(['github'], '2026-11-12T10:00:00.000Z')).toEqual(
      {
        sources: ['github'],
        unavailable: [],
        origin: 'user',
        updatedAt: '2026-11-12T10:00:00.000Z'
      }
    )
    expect(
      repository.saveDiscoverSourcePreference([...DISCOVER_SOURCE_IDS].reverse()).sources
    ).toEqual(DISCOVER_SOURCE_IDS)
    repository.saveDiscoverSourcePreference(['folo:84', 'arxiv'])
    for (const invalid of [
      [],
      ['arxiv', 'arxiv'],
      ['folo:999999'],
      ['ARXIV'],
      [42],
      'arxiv',
      null,
      [...DISCOVER_SOURCE_IDS, 'arxiv']
    ])
      expect(() => repository.saveDiscoverSourcePreference(invalid as never)).toThrow()
    expect(repository.getDiscoverSourcePreference().sources).toEqual(['arxiv', 'folo:84'])
    repository.close()
  })

  it('reports stored sources that are no longer available and adds no new source', () => {
    const database = new Database(':memory:')
    const repository = new ResearchRepository(database)
    database
      .prepare('UPDATE discover_source_preference SET sources_json = ?, origin = ?')
      .run(JSON.stringify(['folo:999999', 'github', 'retired:source', 'github']), 'user')
    expect(repository.getDiscoverSourcePreference()).toMatchObject({
      sources: ['github'],
      unavailable: ['folo:999999', 'retired:source']
    })
    database
      .prepare('UPDATE discover_source_preference SET sources_json = ?')
      .run(JSON.stringify(['retired:source']))
    expect(repository.getDiscoverSourcePreference()).toMatchObject({
      sources: [],
      unavailable: ['retired:source']
    })
    database.prepare('UPDATE discover_source_preference SET sources_json = ?').run('{broken')
    expect(() => repository.getDiscoverSourcePreference()).toThrow()
    repository.close()
  })
})

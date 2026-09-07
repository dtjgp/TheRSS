import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { ResearchRepository } from './researchRepository'

function setup() {
  const db = new Database(':memory:')
  const repository = new ResearchRepository(db)
  const observe = (id: string, date: string, status: string, source = 'folo:523') => {
    db.prepare(
      `INSERT INTO discover_session VALUES (?, 'fixture', 'codex', 'partial', '{}', '{}', ?)`
    ).run(id, date)
    db.prepare('INSERT INTO discover_source_run VALUES (?, ?, ?, 0, ?)').run(
      id,
      source,
      status,
      status === 'failed' ? 'Bounded retrieval failed' : null
    )
  }
  const rows = () =>
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => {
        const name = (row as { name: string }).name
        return [name, db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()]
      })
  return { db, repository, observe, rows }
}

describe('latest recorded source observations', () => {
  it('projects newer search outcomes over old source records without writing history or changing refresh semantics', () => {
    const { repository, observe, rows } = setup()
    repository.recordSourceRun(
      'folo:523',
      'partial',
      '2026-08-19T16:25:12.190Z',
      'Old rejected rows'
    )
    observe('new', '2026-09-07T14:35:34.199Z', 'no_results')
    const before = rows()
    const dashboard = repository.getDashboardSnapshot()
    expect(dashboard.sourceHealth['folo:523']).toBe('no_results')
    expect(dashboard.sourceHealthDetails['folo:523']).toEqual({
      status: 'no_results',
      observedAt: '2026-09-07T14:35:34.199Z',
      errorMessage: null,
      context: 'discover'
    })
    expect(dashboard.lastRefreshAt).toBeNull()
    expect(rows()).toEqual(before)
    repository.close()
  })
  it('uses a newer explicit source read, and source reads win equal timestamps', () => {
    const { repository, observe } = setup()
    observe('old', '2026-09-01T00:00:00Z', 'failed')
    repository.recordSourceRun('folo:523', 'healthy', '2026-09-02T00:00:00.000Z', null, 0)
    observe('tie', '2026-09-02T02:00:00+02:00', 'partial')
    expect(repository.getDashboardSnapshot().sourceHealthDetails['folo:523']).toMatchObject({
      status: 'no_results',
      context: 'source',
      observedAt: '2026-09-02T00:00:00.000Z'
    })
    repository.close()
  })
  it('ignores unsearched, canceled, invalid dates and older replayed observations', () => {
    const { repository, observe } = setup()
    observe('valid', '2026-09-02T00:00:00Z', 'healthy')
    observe('skip', '2026-09-03T00:00:00Z', 'not_searched')
    observe('cancel', '2026-09-04T00:00:00Z', 'canceled')
    observe('invalid', 'not-a-date', 'failed')
    observe('replayed', '2026-09-01T00:00:00Z', 'failed')
    expect(repository.getDashboardSnapshot().sourceHealthDetails['folo:523']).toMatchObject({
      status: 'healthy',
      observedAt: '2026-09-02T00:00:00Z'
    })
    expect(repository.getDashboardSnapshot().sourceHealthDetails.github).toEqual({
      status: 'idle',
      observedAt: null,
      errorMessage: null
    })
    repository.close()
  })
  it('selects per source, breaks search ties by session id and redacts bounded failure details', () => {
    const { db, repository, observe } = setup()
    observe('a', '2026-09-02T00:00:00Z', 'partial')
    observe('b', '2026-09-02T00:00:00Z', 'failed')
    observe('c', '2026-09-03T00:00:00Z', 'partial', 'arxiv')
    db.prepare('UPDATE discover_source_run SET error_message = ? WHERE session_id = ?').run(
      'Token ghp_fixtureonly /Users/fixture/private\n' + 'detail '.repeat(100),
      'b'
    )
    const details = repository.getDashboardSnapshot().sourceHealthDetails
    expect(details.arxiv).toMatchObject({ status: 'partial', context: 'discover' })
    expect(details['folo:523']).toMatchObject({ status: 'failed', context: 'discover' })
    expect(details['folo:523']?.errorMessage).toHaveLength(300)
    expect(details['folo:523']?.errorMessage).not.toMatch(/ghp_fixtureonly|\/Users\//)
    repository.close()
  })
})

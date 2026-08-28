import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { ResearchRepository } from './researchRepository'

function setup() {
  const database = new Database(':memory:')
  const repository = new ResearchRepository(database)
  database
    .prepare(
      `INSERT INTO discovery_item(
         id, source, item_kind, external_id, title, summary, url, published_at, updated_at,
         authors_json, categories_json, topics_json, language, stars, score, excluded,
         reasons_json, in_daily_inbox, triage_state, triage_updated_at, first_seen_at, last_seen_at
       ) VALUES (?, 'arxiv', 'paper', ?, ?, ?, ?, ?, ?, '[]', '[]', '[]', NULL, NULL, 50, 0,
                 '[]', 0, 'saved', ?, ?, ?)`
    )
    .run(
      'arxiv:saved',
      'saved',
      'Structured pruning for edge deployment',
      'A saved resource-aware method.',
      'https://arxiv.org/abs/saved',
      '2026-08-20T00:00:00.000Z',
      '2026-08-20T00:00:00.000Z',
      '2026-08-20T01:00:00.000Z',
      '2026-08-20T00:00:00.000Z',
      '2026-08-20T01:00:00.000Z'
    )
  database
    .prepare(
      `INSERT INTO discover_session(
         id, intent, runner, status, plan_json, provenance_json, created_at
       ) VALUES (?, ?, 'codex', 'completed', '{}', '{}', ?)`
    )
    .run('discover-session-search', 'quantum edge networks', '2026-08-21T01:00:00.000Z')
  database
    .prepare(
      `INSERT INTO discover_result(
         session_id, item_id, source, item_kind, external_id, title, summary, url,
         published_at, updated_at, authors_json, categories_json, topics_json,
         language, stars, score, reasons_json, result_rank
       ) VALUES (?, ?, 'github', 'repository', ?, ?, ?, ?, ?, ?, '[]', '[]', '[]',
                 'TypeScript', 12, 40, '[]', 0)`
    )
    .run(
      'discover-session-search',
      'github:quantum/edge',
      'quantum/edge',
      'quantum/edge',
      'A quantum edge networking toolkit.',
      'https://github.com/quantum/edge',
      '2026-08-21T00:00:00.000Z',
      '2026-08-21T00:00:00.000Z'
    )
  repository.saveAnalysis(
    {
      id: 'analysis-search',
      itemId: 'arxiv:saved',
      providerId: 'local-agent:codex',
      providerName: 'Codex CLI',
      model: 'codex-cli',
      promptVersion: 'discovery-analysis-v1',
      sourceHash: 'a'.repeat(64),
      content: 'Energy-aware scheduling implications.',
      createdAt: '2026-08-22T01:00:00.000Z'
    },
    { inputTokens: null, outputTokens: null }
  )
  return { database, repository }
}

describe('ResearchRepository local search', () => {
  it('searches bounded local Saved, Discover, and analysis records without external work', () => {
    const { repository } = setup()

    expect(repository.searchLocal('structured').results).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'saved', itemId: 'arxiv:saved' })])
    )
    expect(repository.searchLocal('quantum edge').results).toEqual([
      expect.objectContaining({ kind: 'discover', itemId: 'github:quantum/edge' })
    ])
    expect(repository.searchLocal('energy-aware').results).toEqual([
      expect.objectContaining({ kind: 'analysis', id: 'analysis-search' })
    ])
    repository.close()
  })

  it('rejects blank, one-character, and oversized local queries', () => {
    const { repository } = setup()
    expect(() => repository.searchLocal(' ')).toThrow()
    expect(() => repository.searchLocal('x')).toThrow()
    expect(() => repository.searchLocal('x'.repeat(201))).toThrow()
    repository.close()
  })
})

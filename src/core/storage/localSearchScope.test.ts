import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { ResearchRepository } from './researchRepository'

const minute = (offset: number) => new Date(Date.UTC(2026, 9, 1) + offset * 60_000).toISOString()

function setup() {
  const database = new Database(':memory:')
  const repository = new ResearchRepository(database)
  const insertItem = database.prepare(
    `INSERT INTO discovery_item(
       id, source, item_kind, external_id, title, summary, url, published_at, updated_at,
       authors_json, categories_json, topics_json, language, stars, score, excluded,
       reasons_json, in_daily_inbox, triage_state, triage_updated_at, first_seen_at, last_seen_at
     ) VALUES (?, 'arxiv', 'paper', ?, ?, '', ?, ?, ?, '[]', '[]', '[]', NULL, NULL, 50, 0,
               '[]', 0, ?, ?, ?, ?)`
  )
  const insertSession = database.prepare(
    `INSERT INTO discover_session(id, intent, runner, status, plan_json, provenance_json, created_at)
     VALUES (?, 'unrelated intent', 'codex', 'completed', '{}', '{}', ?)`
  )
  const insertResult = database.prepare(
    `INSERT INTO discover_result(
       session_id, item_id, source, item_kind, external_id, title, summary, url,
       published_at, updated_at, authors_json, categories_json, topics_json,
       language, stars, score, reasons_json, result_rank
     ) VALUES (?, ?, 'arxiv', 'paper', ?, ?, '', ?, ?, ?, '[]', '[]', '[]', NULL, NULL, 40, '[]', ?)`
  )
  const item = (id: string, title: string, state: 'saved' | 'new', at: string) =>
    insertItem.run(id, id, title, `https://arxiv.org/abs/${id}`, at, at, state, at, at, at)
  const saved = (count: number, start: number) => {
    for (let index = 0; index < count; index++)
      item(`saved-${index}`, `Saved pruning ${index}`, 'saved', minute(start + index))
  }
  const discover = (count: number, start: number) => {
    insertSession.run('session-scope', minute(start))
    for (let index = 0; index < count; index++) {
      const id = `discover-${index}`
      insertResult.run(
        'session-scope',
        id,
        id,
        `Session pruning ${index}`,
        `https://arxiv.org/abs/${id}`,
        minute(start),
        minute(start),
        index
      )
    }
  }
  const analyses = (count: number, start: number) => {
    for (let index = 0; index < count; index++) {
      const itemId = `analyzed-${index}`
      item(itemId, `Analyzed pruning ${index}`, 'new', minute(start))
      repository.saveAnalysis(
        {
          id: `analysis-${index}`,
          itemId,
          providerId: 'local-agent:codex',
          providerName: 'Codex CLI',
          model: 'codex-cli',
          promptVersion: 'discovery-analysis-v1',
          sourceHash: 'a'.repeat(64),
          content: 'Derived notes.',
          createdAt: minute(start + 1 + index)
        },
        { inputTokens: null, outputTokens: null }
      )
    }
  }
  return { repository, saved, discover, analyses }
}

const kinds = (results: readonly { kind: string }[]) =>
  results.reduce<Record<string, number>>(
    (counts, { kind }) => ({ ...counts, [kind]: (counts[kind] ?? 0) + 1 }),
    {}
  )

describe('local search scope', () => {
  it('finds older Saved items that newer sessions and analyses hide from the all scope', () => {
    const { repository, saved, discover, analyses } = setup()
    saved(5, 0)
    discover(30, 1000)
    analyses(30, 2000)

    const all = repository.searchLocal('pruning')
    expect(all.scope).toBe('all')
    expect(kinds(all.results)).toEqual({ discover: 25, analysis: 25 })
    expect(all.truncated).toBe(true)

    const savedOnly = repository.searchLocal('pruning', 'saved')
    expect(savedOnly.scope).toBe('saved')
    expect(savedOnly.results.map(({ itemId }) => itemId)).toEqual([
      'saved-4',
      'saved-3',
      'saved-2',
      'saved-1',
      'saved-0'
    ])
    expect(savedOnly.truncated).toBe(false)
    expect(kinds(repository.searchLocal('pruning', 'discover').results)).toEqual({ discover: 30 })
    expect(kinds(repository.searchLocal('pruning', 'analysis').results)).toEqual({ analysis: 30 })
    repository.close()
  })

  it('reports truncation only when a kind or the merged list exceeds its limit', () => {
    const empty = setup()
    expect(empty.repository.searchLocal('pruning')).toEqual({
      query: 'pruning',
      scope: 'all',
      results: [],
      truncated: false
    })
    expect(empty.repository.searchLocal('pruning', 'saved').truncated).toBe(false)

    const exactKind = setup()
    exactKind.saved(25, 0)
    expect(exactKind.repository.searchLocal('pruning').results).toHaveLength(25)
    expect(exactKind.repository.searchLocal('pruning').truncated).toBe(false)

    const overKind = setup()
    overKind.saved(26, 0)
    expect(overKind.repository.searchLocal('pruning').results).toHaveLength(25)
    expect(overKind.repository.searchLocal('pruning').truncated).toBe(true)
    expect(overKind.repository.searchLocal('pruning', 'saved').results).toHaveLength(26)
    expect(overKind.repository.searchLocal('pruning', 'saved').truncated).toBe(false)

    const exactMerged = setup()
    exactMerged.saved(25, 0)
    exactMerged.discover(25, 1000)
    expect(exactMerged.repository.searchLocal('pruning').results).toHaveLength(50)
    expect(exactMerged.repository.searchLocal('pruning').truncated).toBe(false)

    const overMerged = setup()
    overMerged.saved(25, 0)
    overMerged.discover(25, 1000)
    overMerged.analyses(1, 2000)
    const merged = overMerged.repository.searchLocal('pruning')
    expect(merged.results).toHaveLength(50)
    expect(kinds(merged.results)).toEqual({ saved: 24, discover: 25, analysis: 1 })
    expect(merged.truncated).toBe(true)

    const exactScope = setup()
    exactScope.saved(50, 0)
    expect(exactScope.repository.searchLocal('pruning', 'saved').results).toHaveLength(50)
    expect(exactScope.repository.searchLocal('pruning', 'saved').truncated).toBe(false)

    const overScope = setup()
    overScope.saved(51, 0)
    const scoped = overScope.repository.searchLocal('pruning', 'saved')
    expect(scoped.results).toHaveLength(50)
    expect(scoped.results[0]?.itemId).toBe('saved-50')
    expect(scoped.truncated).toBe(true)
    for (const fixture of [empty, exactKind, overKind, exactMerged, overMerged, exactScope])
      fixture.repository.close()
    overScope.repository.close()
  })

  it('rejects an unsupported scope', () => {
    const { repository } = setup()
    expect(() => repository.searchLocal('pruning', 'recent' as never)).toThrow()
    repository.close()
  })
})

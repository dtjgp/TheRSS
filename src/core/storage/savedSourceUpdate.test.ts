import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { ResearchRepository } from './researchRepository'
import type { DiscoverResultItem, DiscoverSnapshot } from '../../shared/discover'
import { DISCOVER_SOURCE_IDS } from '../../shared/discover'
import { hashAnalysisSource } from '../analysis/sourceSnapshot'

const original: DiscoverResultItem = {
  id: 'github:owner/pruning',
  source: 'github',
  kind: 'repository',
  externalId: 'owner/pruning',
  title: 'Pruning',
  summary: 'Original source description',
  url: 'https://github.com/owner/pruning',
  publishedAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  authors: [],
  categories: [],
  topics: ['pruning'],
  language: 'Python',
  stars: 1,
  metrics: {},
  score: 10,
  reasons: ['Original match'],
  saved: false
}
function snapshot(id: string, createdAt: string, item = original): DiscoverSnapshot {
  return {
    id,
    createdAt,
    intent: 'Public pruning query',
    runner: 'codex',
    status: 'completed',
    plan: {
      version: 'discover-plan-v1',
      intentSummary: 'Pruning',
      arxiv: { categories: [], keywords: ['pruning'], excludeKeywords: [] },
      github: { keywords: ['pruning'], topics: [], languages: [] },
      rationale: 'Bounded test'
    },
    provenance: {
      providerId: 'local:codex',
      providerName: 'Codex CLI',
      model: 'fixture',
      promptVersion: 'semantic-discover-v2',
      personalizationApplied: false,
      inputHash: 'a'.repeat(64),
      createdAt
    },
    sourceOutcomes: Object.fromEntries(
      DISCOVER_SOURCE_IDS.map((source) => [
        source,
        {
          status: source === 'github' ? 'healthy' : 'not_searched',
          resultCount: source === 'github' ? 1 : 0,
          error: null
        }
      ])
    ) as DiscoverSnapshot['sourceOutcomes'],
    counts: {
      total: 1,
      arxiv: 0,
      github: 1,
      byKind: { paper: 0, repository: 1, article: 0, model: 0, dataset: 0, post: 0 },
      bySource: { github: 1 } as DiscoverSnapshot['counts']['bySource']
    },
    items: [item]
  }
}
function setup() {
  const db = new Database(':memory:')
  const repository = new ResearchRepository(db)
  repository.saveDiscoverSnapshot(snapshot('old', '2026-09-02T00:00:00.000Z'))
  repository.saveDiscoverResult('old', original.id, '2026-09-03T00:00:00.000Z')
  const current = repository.getDiscoveryItem(original.id)!
  const artifact = {
    id: 'old-analysis',
    itemId: original.id,
    providerId: 'fixture',
    providerName: 'Fixture',
    model: 'fixture',
    promptVersion: 'discovery-analysis-v2',
    sourceHash: hashAnalysisSource(current),
    content: 'Immutable prior analysis',
    createdAt: '2026-09-03T01:00:00.000Z'
  }
  repository.saveAnalysis(artifact, { inputTokens: null, outputTokens: null })
  const newer = {
    ...original,
    summary: 'New source description',
    updatedAt: '2026-09-05T00:00:00.000Z',
    stars: 3,
    score: 20,
    reasons: ['New match']
  }
  repository.saveDiscoverSnapshot(snapshot('new', '2026-09-06T00:00:00.000Z', newer))
  return { db, repository, current, artifact, newer }
}

describe('Saved source snapshot updates', () => {
  it('applies the precise newer local snapshot without unsaving or rewriting analysis/history', () => {
    const { db, repository, current, artifact, newer } = setup()
    const before = db
      .prepare('SELECT triage_updated_at, first_seen_at FROM discovery_item WHERE id=?')
      .get(original.id)
    const candidate = repository.getSavedSourceUpdate(original.id)!
    expect(candidate).toMatchObject({
      itemId: original.id,
      sessionId: 'new',
      retrievedAt: '2026-09-06T00:00:00.000Z',
      currentSourceHash: hashAnalysisSource(current),
      title: newer.title,
      sourceHash: hashAnalysisSource({ ...newer, triageState: 'saved' })
    })
    expect(
      repository.applySavedSourceUpdate(
        {
          itemId: candidate.itemId,
          sessionId: candidate.sessionId,
          expectedSourceHash: candidate.currentSourceHash,
          sourceHash: candidate.sourceHash
        },
        '2026-09-07T00:00:00.000Z'
      )
    ).toBe('updated')
    expect(repository.getDiscoveryItem(original.id)).toMatchObject({
      summary: newer.summary,
      score: newer.score,
      reasons: newer.reasons,
      triageState: 'saved'
    })
    expect(
      db
        .prepare('SELECT triage_updated_at, first_seen_at FROM discovery_item WHERE id=?')
        .get(original.id)
    ).toEqual(before)
    expect(repository.getAnalysisArtifact(artifact.id)).toEqual(artifact)
    expect(repository.getDiscoverSnapshot('old')?.items[0]?.summary).toBe(original.summary)
    expect(repository.getSavedSourceUpdate(original.id)).toBeNull()
    repository.close()
  })
  it('can update an old historical snapshot saved after the newer snapshot was retrieved', () => {
    const { repository } = setup()
    repository.saveDiscoverResult('old', original.id, '2026-09-07T00:00:00.000Z')
    expect(repository.getSavedSourceUpdate(original.id)?.sessionId).toBe('new')
    repository.close()
  })
  it.each(['viewed', 'dismissed'] as const)('never restores a record that is now %s', (state) => {
    const { repository, current } = setup()
    const candidate = repository.getSavedSourceUpdate(original.id)!
    repository.setTriageState(original.id, state)
    expect(repository.getSavedSourceUpdate(original.id)).toBeNull()
    expect(
      repository.applySavedSourceUpdate({
        itemId: original.id,
        sessionId: 'new',
        expectedSourceHash: hashAnalysisSource(current),
        sourceHash: candidate.sourceHash
      })
    ).toBe('unavailable')
    expect(repository.getDiscoveryItem(original.id)?.triageState).toBe(state)
    repository.close()
  })
  it('does not overwrite source changes or a newer candidate that arrived after preview', () => {
    const { repository, current, newer } = setup()
    const candidate = repository.getSavedSourceUpdate(original.id)!
    const request = {
      itemId: original.id,
      sessionId: 'new',
      expectedSourceHash: hashAnalysisSource(current),
      sourceHash: candidate.sourceHash
    }
    repository.saveDiscoverSnapshot(
      snapshot('newest', '2026-09-07T00:00:00.000Z', { ...newer, summary: 'Newest description' })
    )
    expect(repository.applySavedSourceUpdate(request)).toBe('conflict')
    expect(repository.getDiscoveryItem(original.id)?.summary).toBe(original.summary)
    repository.saveDiscoverResult('new', original.id)
    expect(repository.applySavedSourceUpdate(request)).toBe('conflict')
    repository.close()
  })
  it('rejects old source versions even if fetched later, and ignores other item identities', () => {
    const { repository } = setup()
    repository.saveDiscoverResult('new', original.id)
    repository.saveDiscoverSnapshot(
      snapshot('recent-but-stale', '2026-09-08T00:00:00.000Z', {
        ...original,
        summary: 'Stale server response'
      })
    )
    repository.saveDiscoverSnapshot(
      snapshot('other-item', '2026-09-09T00:00:00.000Z', {
        ...original,
        id: 'github:owner/other',
        summary: 'Other record'
      })
    )
    expect(repository.getSavedSourceUpdate(original.id)).toBeNull()
    expect(repository.getSavedSourceUpdate('missing')).toBeNull()
    repository.close()
  })
  it('has no update for equal data or a repository without a later local capture', () => {
    const { repository } = setup()
    repository.saveDiscoverResult('new', original.id)
    const current = repository.getDiscoveryItem(original.id)!
    expect(
      repository.applySavedSourceUpdate({
        itemId: original.id,
        sessionId: 'new',
        expectedSourceHash: hashAnalysisSource(current),
        sourceHash: hashAnalysisSource(current)
      })
    ).toBe('unchanged')
    repository.close()
  })
})

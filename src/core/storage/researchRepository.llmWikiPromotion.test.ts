import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import type { DiscoveryItem, RankedDiscoveryItem } from '../../shared/discovery'
import type { LlmWikiPromotionReceipt } from '../../shared/llmWikiPromotion'
import { ResearchRepository } from './researchRepository'

const paper: DiscoveryItem = {
  id: 'arxiv:2608.00001',
  source: 'arxiv',
  kind: 'paper',
  externalId: '2608.00001',
  title: 'Structured pruning for edge deployment',
  summary: 'A resource-aware method.',
  url: 'https://arxiv.org/abs/2608.00001',
  publishedAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T01:00:00.000Z',
  authors: ['Ada Researcher', 'Bo Engineer'],
  categories: ['cs.LG', 'cs.CV'],
  topics: ['structured pruning'],
  language: null,
  stars: null,
  metrics: {}
}

const rankedPaper: RankedDiscoveryItem = {
  item: paper,
  score: 62,
  excluded: false,
  reasons: [
    {
      kind: 'keyword',
      value: 'structured pruning',
      field: 'title',
      weight: 30,
      label: 'Title matches “structured pruning”'
    }
  ]
}

function receipt(
  id: string,
  status: LlmWikiPromotionReceipt['status'],
  startedAt: string,
  completedAt: string | null
): LlmWikiPromotionReceipt {
  const completed = status === 'completed'
  return {
    version: 'llm-wiki-promotion-v1',
    id,
    itemId: paper.id,
    arxivId: paper.externalId,
    status,
    runner: 'codex',
    promptVersion: 'llm-wiki-promotion-v1',
    sourceHash: 'a'.repeat(64),
    contractHash: 'b'.repeat(64),
    evidenceTier: completed ? 'full-text-verified' : 'pending',
    summary: completed ? 'Promotion complete.' : 'Promotion is running.',
    createdPaths: completed
      ? [
          'raw/papers/Researcher et al. - 2026 - Structured pruning.pdf',
          'raw/paper_records/Researcher et al. - 2026 - Structured pruning.md',
          'Literature/Paper_Notes/L2_Structured/Researcher_2026_StructuredPruning.md'
        ]
      : [],
    updatedPaths: completed ? ['index.md', 'log.md'] : [],
    pdfPath: completed ? 'raw/papers/Researcher et al. - 2026 - Structured pruning.pdf' : null,
    sidecarPath: completed
      ? 'raw/paper_records/Researcher et al. - 2026 - Structured pruning.md'
      : null,
    notePath: completed
      ? 'Literature/Paper_Notes/L2_Structured/Researcher_2026_StructuredPruning.md'
      : null,
    auditPath: completed
      ? 'Automation_Conversations/2026-08-21__therss-paper-promotion__120000.md'
      : null,
    blockers: [],
    startedAt,
    completedAt
  }
}

function createRepository(): {
  readonly database: Database.Database
  readonly repository: ResearchRepository
} {
  const database = new Database(':memory:')
  const repository = new ResearchRepository(database)
  repository.upsertRankedItems([rankedPaper], '2026-08-21T09:00:00.000Z')
  return { database, repository }
}

describe('ResearchRepository llm-wiki promotion persistence', () => {
  it('restores the complete persisted discovery record required by promotion', () => {
    const { repository } = createRepository()

    expect(repository.getDiscoveryRecord(paper.id)).toEqual(paper)
    expect(repository.getDiscoveryRecord('arxiv:missing')).toBeNull()

    repository.close()
  })

  it('adds the append-only receipt migration without changing existing discovery data', () => {
    const { database, repository: existingRepository } = createRepository()
    database.exec('DROP TABLE llm_wiki_promotion_receipt')

    const migratedRepository = new ResearchRepository(database)
    const columns = database.pragma('table_info(llm_wiki_promotion_receipt)') as Array<{
      name: string
    }>
    const indexes = database.pragma('index_list(llm_wiki_promotion_receipt)') as Array<{
      name: string
    }>

    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'sequence',
        'id',
        'item_id',
        'status',
        'source_hash',
        'created_paths_json',
        'updated_paths_json',
        'blockers_json',
        'started_at',
        'completed_at'
      ])
    )
    expect(columns.map((column) => column.name)).not.toEqual(
      expect.arrayContaining(['content', 'stderr', 'vault_root', 'prompt'])
    )
    expect(indexes.map((index) => index.name)).toContain('llm_wiki_promotion_receipt_by_item')
    expect(migratedRepository.getDiscoveryRecord(paper.id)).toEqual(paper)
    expect(database.pragma('foreign_key_check')).toEqual([])

    existingRepository.close()
  })

  it('appends receipts and returns the latest insertion without overwriting history', () => {
    const { database, repository } = createRepository()
    const running = receipt('promotion-running', 'running', '2026-08-21T10:00:00.000Z', null)
    const completed = receipt(
      'promotion-completed',
      'completed',
      '2026-08-21T10:00:00.000Z',
      '2026-08-21T10:02:00.000Z'
    )

    repository.saveLlmWikiPromotionReceipt(running)
    repository.saveLlmWikiPromotionReceipt(completed)

    expect(repository.getLatestLlmWikiPromotionReceipt(paper.id)).toEqual(completed)
    expect(repository.getLatestLlmWikiPromotionReceipt('arxiv:missing')).toBeNull()
    expect(() =>
      repository.saveLlmWikiPromotionReceipt({
        ...completed,
        id: 'promotion-unsafe-path',
        createdPaths: ['../escape.md']
      })
    ).toThrow('Expected a safe llm-wiki relative path')
    expect(() =>
      repository.saveLlmWikiPromotionReceipt({ ...completed, status: 'failed' })
    ).toThrow()
    expect(database.prepare('SELECT COUNT(*) FROM llm_wiki_promotion_receipt').pluck().get()).toBe(
      2
    )
    expect(
      database
        .prepare('SELECT status FROM llm_wiki_promotion_receipt ORDER BY sequence ASC')
        .pluck()
        .all()
    ).toEqual(['running', 'completed'])

    repository.close()
  })

  it('reconciles a startup-stale running receipt as an append-only partial outcome', () => {
    const { database, repository } = createRepository()
    repository.saveLlmWikiPromotionReceipt(
      receipt('promotion-running', 'running', '2026-08-21T10:00:00.000Z', null)
    )

    expect(repository.reconcileInterruptedLlmWikiPromotions('2026-08-21T10:05:00.000Z')).toBe(1)
    expect(repository.getLatestLlmWikiPromotionReceipt(paper.id)).toMatchObject({
      id: 'interrupted:promotion-running',
      status: 'partial',
      evidenceTier: 'partial',
      completedAt: '2026-08-21T10:05:00.000Z'
    })
    expect(
      database
        .prepare('SELECT status FROM llm_wiki_promotion_receipt ORDER BY sequence')
        .pluck()
        .all()
    ).toEqual(['running', 'partial'])
    expect(repository.reconcileInterruptedLlmWikiPromotions('2026-08-21T10:06:00.000Z')).toBe(0)

    repository.close()
  })
})

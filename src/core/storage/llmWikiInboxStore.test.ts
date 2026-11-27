import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { LLM_WIKI_INBOX_RECEIPT_VERSION, type LlmWikiInboxReceipt } from '../../shared/llmWikiInbox'
import { ResearchRepository } from './researchRepository'
import { LlmWikiInboxStore } from './llmWikiInboxStore'

function createRepoFixture() {
  const db = new Database(':memory:')
  const repo = new ResearchRepository(db)
  repo.upsertRankedItems([
    {
      item: {
        id: 'github:org/repo',
        source: 'github',
        kind: 'repository',
        externalId: 'org/repo',
        title: 'Structured Pruning Toolkit',
        summary: 'A PyTorch pruning toolkit.',
        url: 'https://github.com/org/repo',
        publishedAt: '2026-11-20T00:00:00.000Z',
        updatedAt: '2026-11-21T00:00:00.000Z',
        authors: ['org'],
        categories: [],
        topics: ['pruning'],
        language: 'Python',
        stars: 120,
        metrics: {}
      },
      score: 12,
      excluded: false,
      reasons: [{ kind: 'keyword', value: 'pruning', weight: 12, label: 'Matches pruning' }]
    }
  ])
  return { db, repo, store: new LlmWikiInboxStore(db) }
}

const runningReceipt: LlmWikiInboxReceipt = {
  version: LLM_WIKI_INBOX_RECEIPT_VERSION,
  id: 'run-1',
  itemId: 'github:org/repo',
  source: 'github',
  kind: 'repository',
  status: 'running',
  sourceHash: 'a'.repeat(64),
  contractHash: 'b'.repeat(64),
  evidenceTier: 'pending',
  summary: 'Writing Inbox note.',
  createdPaths: [],
  updatedPaths: [],
  notePath: null,
  auditPath: null,
  blockers: [],
  startedAt: '2026-11-27T10:00:00.000Z',
  completedAt: null
}

describe('LlmWikiInboxStore', () => {
  it('saves, updates, and retrieves the latest Inbox capture receipt per item', () => {
    const { store } = createRepoFixture()
    expect(store.getLatestReceipt('github:org/repo')).toBeNull()
    store.saveReceipt(runningReceipt)
    expect(store.getLatestReceipt('github:org/repo')?.status).toBe('running')

    const completed: LlmWikiInboxReceipt = {
      ...runningReceipt,
      id: 'done-1',
      status: 'completed',
      evidenceTier: 'metadata-only',
      summary: 'Captured into Inbox.',
      createdPaths: [
        'Inbox/TheRSS_2026-11-27_toolkit_aaaaaaaa.md',
        'Automation_Conversations/a.json'
      ],
      updatedPaths: ['log.md'],
      notePath: 'Inbox/TheRSS_2026-11-27_toolkit_aaaaaaaa.md',
      auditPath: 'Automation_Conversations/a.json',
      completedAt: '2026-11-27T10:01:00.000Z'
    }
    store.saveReceipt(completed)
    expect(store.getLatestReceipt('github:org/repo')).toEqual(completed)
  })

  it('reconciles interrupted running receipts into partial receipts on startup', () => {
    const { store } = createRepoFixture()
    expect(store.reconcileInterruptedReceipts('2026-11-27T11:00:00.000Z')).toBe(0)
    store.saveReceipt(runningReceipt)
    expect(store.reconcileInterruptedReceipts('2026-11-27T11:00:00.000Z')).toBe(1)
    const latest = store.getLatestReceipt('github:org/repo')
    expect(latest?.status).toBe('partial')
    expect(latest?.evidenceTier).toBe('partial')
    expect(latest?.completedAt).toBe('2026-11-27T11:00:00.000Z')
    expect(latest?.blockers.length).toBeGreaterThan(0)
  })
})

import { describe, expect, it, vi } from 'vitest'
import {
  LLM_WIKI_INBOX_PREVIEW_VERSION,
  LLM_WIKI_INBOX_RECEIPT_VERSION,
  type LlmWikiInboxPreview,
  type LlmWikiInboxReceipt
} from '../../shared/llmWikiInbox'
import { NativeModals } from './modals'
import { ResearchReader, TriageHistory } from './reading'
import { nativeHarness } from './testSupport'

const samplePreview: LlmWikiInboxPreview = {
  version: LLM_WIKI_INBOX_PREVIEW_VERSION,
  previewId: '00000000-0000-4000-8000-000000000099',
  itemId: 'github:org/repo',
  source: 'github',
  kind: 'repository',
  title: 'Edge Pruning Repo',
  url: 'https://github.com/org/repo',
  ready: true,
  vaultLabel: 'llm-wiki',
  destination: 'Inbox',
  intendedPaths: ['Inbox/TheRSS_2026-11-27_edge.md', 'log.md', 'Automation_Conversations/a.json'],
  evidenceBoundary: 'Metadata-only Inbox capture.',
  blockers: [],
  sourceHash: 'a'.repeat(64),
  contractHash: 'b'.repeat(64),
  expiresAt: '2026-11-27T13:00:00.000Z'
}

const sampleReceipt: LlmWikiInboxReceipt = {
  version: LLM_WIKI_INBOX_RECEIPT_VERSION,
  id: 'rcpt-1',
  itemId: 'github:org/repo',
  source: 'github',
  kind: 'repository',
  status: 'completed',
  sourceHash: 'a'.repeat(64),
  contractHash: 'b'.repeat(64),
  evidenceTier: 'metadata-only',
  summary: 'Captured into Inbox.',
  createdPaths: ['Inbox/TheRSS_2026-11-27_edge.md', 'Automation_Conversations/a.json'],
  updatedPaths: ['log.md'],
  notePath: 'Inbox/TheRSS_2026-11-27_edge.md',
  auditPath: 'Automation_Conversations/a.json',
  blockers: [],
  startedAt: '2026-11-27T12:00:00.000Z',
  completedAt: '2026-11-27T12:00:02.000Z'
}

describe('Native AppKit P1-3 Inbox capture', () => {
  it('shows Inbox capture action for non-paper items and hides it for arXiv papers', async () => {
    const h = nativeHarness()
    const triage = new TriageHistory(h.context)
    const reader = new ResearchReader(h.context, 'saved', triage)

    reader.select({
      id: 'github:org/repo',
      source: 'github',
      kind: 'repository',
      title: 'Edge Pruning Repo',
      summary: 'Repo summary',
      url: 'https://github.com/org/repo',
      publishedAt: '2026-11-26T00:00:00Z',
      score: 10,
      triageState: 'saved',
      reasons: ['pruning']
    })
    const repoTree = h.render(reader)
    expect(h.find(repoTree, 'saved-inbox-capture')?.title).toBe('Preview llm-wiki Inbox capture')
    expect(h.find(repoTree, 'saved-promote')).toBeUndefined()
    await h.act(reader, 'saved-inbox-capture')
    expect(h.context.captureToInbox).toHaveBeenCalledWith('github:org/repo', undefined)

    reader.select({
      id: 'arxiv:2611.00001',
      source: 'arxiv',
      kind: 'paper',
      title: 'Paper Title',
      summary: 'Abstract',
      url: 'https://arxiv.org/abs/2611.00001',
      publishedAt: '2026-11-26T00:00:00Z',
      score: 10,
      triageState: 'saved',
      reasons: ['pruning']
    })
    const paperTree = h.render(reader)
    expect(h.find(paperTree, 'saved-promote')).toBeDefined()
    expect(h.find(paperTree, 'saved-inbox-capture')).toBeUndefined()
  })

  it('previews, confirms, and cancels Inbox capture through NativeModals', async () => {
    const previewLlmWikiInboxCapture = vi.fn(async () => samplePreview)
    const confirmLlmWikiInboxCapture = vi.fn(async () => sampleReceipt)
    const cancelLlmWikiInboxCapture = vi.fn(async () => ({
      ...sampleReceipt,
      status: 'skipped' as const,
      evidenceTier: 'partial' as const,
      createdPaths: [],
      updatedPaths: [],
      notePath: null,
      auditPath: null
    }))
    const getLatestLlmWikiInboxCapture = vi.fn(async () => null)

    const h = nativeHarness({
      previewLlmWikiInboxCapture,
      confirmLlmWikiInboxCapture,
      cancelLlmWikiInboxCapture,
      getLatestLlmWikiInboxCapture
    })
    const modals = new NativeModals(h.context)

    await modals.openInboxCapture('github:org/repo', 'session-1')
    const modalScreen = { render: () => modals.render()! }
    const previewNode = h.render(modalScreen)
    expect(h.find(previewNode, 'modal-heading')?.text).toBe('Capture item to llm-wiki Inbox')
    expect(h.find(previewNode, 'inbox-capture-paths')?.text).toContain(
      'Inbox/TheRSS_2026-11-27_edge.md'
    )
    expect(h.find(previewNode, 'inbox-capture-confirm')?.title).toBe('Write to llm-wiki…')

    await h.act(modalScreen, 'inbox-capture-confirm')
    expect(confirmLlmWikiInboxCapture).toHaveBeenCalledWith(samplePreview.previewId)
    const receiptNode = h.render(modalScreen)
    expect(h.find(receiptNode, 'inbox-capture-receipt-status')?.text).toBe('Completed')
    expect(h.find(receiptNode, 'inbox-capture-receipt-text')?.text).toContain('metadata-only')

    // Re-open and close without confirming cancels the pending preview.
    await modals.openInboxCapture('github:org/repo')
    await modals.close()
    expect(cancelLlmWikiInboxCapture).toHaveBeenCalledWith(samplePreview.previewId)
    expect(modals.visible).toBe(false)
  })

  it('displays governance blockers without enabling Write to llm-wiki when blocked', async () => {
    const blockedPreview: LlmWikiInboxPreview = {
      ...samplePreview,
      previewId: null,
      ready: false,
      intendedPaths: [],
      blockers: ['Register therss-inbox-capture in Automation_Runtime_Scopes.json']
    }
    const h = nativeHarness({
      previewLlmWikiInboxCapture: vi.fn(async () => blockedPreview),
      getLatestLlmWikiInboxCapture: vi.fn(async () => null)
    })
    const modals = new NativeModals(h.context)
    await modals.openInboxCapture('github:org/repo')
    const node = modals.render()!
    expect(h.find(node, 'inbox-capture-confirm')).toBeUndefined()
    expect(h.find(node, 'inbox-capture-blockers-list')?.text).toContain('therss-inbox-capture')
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { DiscoveryItem } from '../../shared/discovery'
import {
  LLM_WIKI_INBOX_PREVIEW_VERSION,
  LLM_WIKI_INBOX_RECEIPT_VERSION,
  type LlmWikiInboxReceipt
} from '../../shared/llmWikiInbox'
import {
  LlmWikiInboxService,
  type LlmWikiInboxAdapterPort,
  type LlmWikiInboxRepository
} from './llmWikiInboxService'

const repoItem: DiscoveryItem = {
  id: 'github:org/edge-prune',
  source: 'github',
  kind: 'repository',
  externalId: 'org/edge-prune',
  title: 'Edge Prune Toolkit',
  summary: 'Structured pruning experiments.',
  url: 'https://github.com/org/edge-prune',
  publishedAt: '2026-11-20T00:00:00.000Z',
  updatedAt: '2026-11-21T00:00:00.000Z',
  authors: ['org'],
  categories: [],
  topics: ['pruning'],
  language: 'Python',
  stars: 42,
  metrics: {}
}

const paperItem: DiscoveryItem = {
  ...repoItem,
  id: 'arxiv:2611.12345',
  source: 'arxiv',
  kind: 'paper',
  externalId: '2611.12345',
  url: 'https://arxiv.org/abs/2611.12345'
}

function createHarness(items: DiscoveryItem[] = [repoItem, paperItem]) {
  const records = new Map(items.map((item) => [item.id, item]))
  const receipts: LlmWikiInboxReceipt[] = []
  let nowMs = Date.parse('2026-11-27T12:00:00.000Z')
  let counter = 0
  const repository: LlmWikiInboxRepository = {
    getDiscoveryRecord: (id) => records.get(id) ?? null,
    saveReceipt: (receipt) => receipts.push(receipt),
    getLatestReceipt: (id) => [...receipts].reverse().find((r) => r.itemId === id) ?? null
  }
  const adapter: LlmWikiInboxAdapterPort = {
    prepare: vi.fn(async (item, context) => ({
      preview: {
        version: LLM_WIKI_INBOX_PREVIEW_VERSION,
        previewId: context.previewId,
        itemId: item.id,
        source: item.source,
        kind: item.kind as Exclude<typeof item.kind, 'paper'>,
        title: item.title,
        url: item.url,
        ready: true,
        vaultLabel: 'llm-wiki' as const,
        destination: 'Inbox' as const,
        intendedPaths: [
          'Inbox/TheRSS_2026-11-27_edge.md',
          'log.md',
          'Automation_Conversations/a.json'
        ],
        evidenceBoundary: 'Metadata-only capture.',
        blockers: [],
        sourceHash: context.sourceHash,
        contractHash: 'c'.repeat(64),
        expiresAt: context.expiresAt
      },
      opaqueHandle: { ok: true }
    })),
    confirm: vi.fn(async (prepared) => ({
      version: LLM_WIKI_INBOX_RECEIPT_VERSION,
      id: `receipt-${++counter}`,
      itemId: prepared.preview.itemId,
      source: prepared.preview.source,
      kind: prepared.preview.kind,
      status: 'completed' as const,
      sourceHash: prepared.preview.sourceHash,
      contractHash: prepared.preview.contractHash,
      evidenceTier: 'metadata-only' as const,
      summary: 'Captured into Inbox.',
      createdPaths: ['Inbox/TheRSS_2026-11-27_edge.md', 'Automation_Conversations/a.json'],
      updatedPaths: ['log.md'],
      notePath: 'Inbox/TheRSS_2026-11-27_edge.md',
      auditPath: 'Automation_Conversations/a.json',
      blockers: [],
      startedAt: '2026-11-27T12:00:00.000Z',
      completedAt: '2026-11-27T12:00:05.000Z'
    })),
    dispose: vi.fn(async () => undefined)
  }
  const service = new LlmWikiInboxService(repository, adapter, {
    now: () => new Date(nowMs),
    previewIdFactory: () => `00000000-0000-4000-8000-00000000000${++counter}`,
    receiptIdFactory: () => `rcpt-${++counter}`
  })
  return {
    records,
    receipts,
    adapter,
    service,
    advanceMs: (ms: number) => {
      nowMs += ms
    }
  }
}

describe('LlmWikiInboxService', () => {
  it('rejects papers, unknown items, and non-https URLs before touching the adapter', async () => {
    const unsafeItem: DiscoveryItem = { ...repoItem, id: 'bad:1', url: 'http://example.com/a' }
    const { service, adapter } = createHarness([repoItem, paperItem, unsafeItem])
    await expect(service.preview(paperItem.id)).rejects.toThrow('full-text llm-wiki promotion')
    await expect(service.preview('missing:id')).rejects.toThrow('Unknown discovery item')
    await expect(service.preview(unsafeItem.id)).rejects.toThrow('https://')
    expect(adapter.prepare).not.toHaveBeenCalled()
  })

  it('runs preview -> confirm -> receipt and enforces single-use owner isolation', async () => {
    const { service, receipts } = createHarness()
    const preview = await service.preview(repoItem.id, 'win-1')
    expect(preview.ready).toBe(true)
    await expect(service.confirm(preview.previewId!, 'win-2')).rejects.toThrow('missing, expired')

    const receipt = await service.confirm(preview.previewId!, 'win-1')
    expect(receipt.status).toBe('completed')
    expect(receipt.evidenceTier).toBe('metadata-only')
    expect(service.getLatest(repoItem.id)?.id).toBe(receipt.id)
    expect(receipts.map((r) => r.status)).toEqual(['running', 'completed'])
    await expect(service.confirm(preview.previewId!, 'win-1')).rejects.toThrow('missing, expired')
  })

  it('rejects confirmation when the item changes after preview or the preview expires', async () => {
    const { service, records, advanceMs } = createHarness()
    const p1 = await service.preview(repoItem.id, 'win-1')
    records.set(repoItem.id, { ...repoItem, title: 'Mutated Title' })
    await expect(service.confirm(p1.previewId!, 'win-1')).rejects.toThrow('changed after preview')

    const p2 = await service.preview(repoItem.id, 'win-1')
    advanceMs(31 * 60_000)
    await expect(service.confirm(p2.previewId!, 'win-1')).rejects.toThrow('missing, expired')
  })

  it('records skipped on cancel, conservative partial on confirm error, and shuts down cleanly', async () => {
    const { service, adapter } = createHarness()
    const p1 = await service.preview(repoItem.id, 'win-1')
    const skipped = await service.cancel(p1.previewId!, 'win-1')
    expect(skipped.status).toBe('skipped')

    const p2 = await service.preview(repoItem.id, 'win-1')
    vi.mocked(adapter.confirm).mockRejectedValueOnce(new Error('disk full'))
    const partial = await service.confirm(p2.previewId!, 'win-1')
    expect(partial.status).toBe('partial')
    expect(partial.blockers.length).toBeGreaterThan(0)

    const p3 = await service.preview(repoItem.id, 'win-2')
    await service.disposeOwner('win-2')
    await expect(service.confirm(p3.previewId!, 'win-2')).rejects.toThrow('missing, expired')

    await service.disposeAll()
    await expect(service.preview(repoItem.id)).rejects.toThrow('shutting down')
  })
})

import { describe, expect, it, vi } from 'vitest'
import type {
  LlmWikiPromotionPreview,
  LlmWikiPromotionReceipt
} from '../../shared/llmWikiPromotion'
import { NativeModals } from './modals'
import { nativeHarness } from './testSupport'

const preview: LlmWikiPromotionPreview = {
  version: 'llm-wiki-promotion-preview-v1',
  previewId: 'a0000000-0000-4000-8000-000000000001',
  itemId: 'arxiv:1',
  arxivId: '2609.00001',
  title: 'Paper',
  ready: true,
  vaultLabel: 'llm-wiki',
  level: 'L2',
  routingRationale: 'Fixture',
  intendedPaths: ['raw/paper.pdf', 'raw/record.md', 'Literature/note.md', 'index.md'],
  pdf: { pageCount: 12, byteSize: 12000, sha256: 'a'.repeat(64) },
  evidenceBoundary: 'Fixture only.',
  blockers: [],
  sourceHash: 'b'.repeat(64),
  contractHash: 'c'.repeat(64),
  expiresAt: '2026-09-06T23:00:00.000Z'
}
const receipt = {
  status: 'completed',
  summary: 'Fixture completed',
  evidenceTier: 'full-text-verified',
  createdPaths: ['raw/paper.pdf'],
  updatedPaths: ['index.md'],
  blockers: [],
  auditPath: 'audit.md'
} as unknown as LlmWikiPromotionReceipt

describe('native modal workflows', () => {
  it('keeps Saved and analysis records with the same identifier distinct when opening locally', async () => {
    const results = (['saved', 'analysis'] as const).map((kind) => ({
      id: 'same-id',
      kind,
      itemId: 'arxiv:1',
      title: 'Same paper',
      detail: kind,
      source: 'arxiv' as const,
      url: 'https://arxiv.org/abs/1',
      createdAt: 'now',
      target: kind === 'saved' ? { kind, itemId: 'arxiv:1' } : { kind, analysisId: 'same-id' }
    }))
    const h = nativeHarness({ searchLocal: vi.fn(async () => ({ query: 'paper', results })) })
    const modal = new NativeModals(h.context)
    modal.openSearch()
    const screen = { render: () => modal.render()! }
    await h.act(screen, 'local-search-query', 'paper')
    await h.context.presentation.dispatch(
      JSON.stringify({ action: h.find(h.render(screen), 'local-search-query')!.activate })
    )
    const rows = h.find(h.render(screen), 'local-search-results')!.rows!
    expect(new Set(rows.map((row) => row.id)).size).toBe(2)
    await h.act(screen, 'local-search-results', 'analysis:same-id')
    await h.context.presentation.dispatch(
      JSON.stringify({
        action: h.find(h.render(screen), 'local-search-results')!.activate,
        value: 'analysis:same-id'
      })
    )
    expect(h.context.openLocal).toHaveBeenCalledWith(
      { kind: 'analysis', analysisId: 'same-id' },
      expect.any(Function)
    )
    expect(h.context.openExternal).not.toHaveBeenCalled()
  })
  it('supports immediate Return, validates length, and hides late results after close', async () => {
    let finish!: (value: { query: string; results: [] }) => void
    const search = vi.fn(
      () =>
        new Promise<{ query: string; results: [] }>((resolve) => {
          finish = resolve
        })
    )
    const h = nativeHarness({ searchLocal: search })
    const modal = new NativeModals(h.context)
    modal.openSearch()
    const screen = { render: () => modal.render()! }
    await h.act(screen, 'local-search-query', 'x')
    expect(h.find(h.render(screen), 'local-search-submit')).toBeUndefined()
    await h.act(screen, 'local-search-query', 'edge')
    expect(search).not.toHaveBeenCalled()
    const running = h.context.presentation.dispatch(
      JSON.stringify({ action: h.find(h.render(screen), 'local-search-query')!.activate })
    )
    await modal.close()
    finish({ query: 'edge', results: [] })
    await running
    expect(modal.render()).toBeUndefined()
  })

  it('renders all intended paths and requires confirmation before writing', async () => {
    const confirm = vi.fn(async () => receipt)
    const h = nativeHarness({
      getLatestLlmWikiPromotion: vi.fn(async () => null),
      previewLlmWikiPromotion: vi.fn(async () => preview),
      confirmLlmWikiPromotion: confirm,
      cancelLlmWikiPromotion: vi.fn(async () => receipt)
    })
    const modal = new NativeModals(h.context)
    await modal.openPromotion('arxiv:1', 'session-1')
    const screen = { render: () => modal.render()! }
    expect(confirm).not.toHaveBeenCalled()
    for (const path of preview.intendedPaths)
      expect(h.find(h.render(screen), 'promotion-preview-text')?.text).toContain(path)
    await h.act(screen, 'promotion-confirm')
    expect(confirm).toHaveBeenCalledWith(preview.previewId)
    expect(h.find(h.render(screen), 'promotion-confirm')).toBeUndefined()
    expect(h.find(h.render(screen), 'promotion-receipt-text')?.text).toContain('Fixture completed')
  })

  it('cancels a prepared preview on dismissal and ignores duplicate confirm while running', async () => {
    let finish!: (value: LlmWikiPromotionReceipt) => void
    const confirm = vi.fn(
      () =>
        new Promise<LlmWikiPromotionReceipt>((resolve) => {
          finish = resolve
        })
    )
    const cancel = vi.fn(async () => receipt)
    const h = nativeHarness({
      getLatestLlmWikiPromotion: vi.fn(async () => null),
      previewLlmWikiPromotion: vi.fn(async () => preview),
      confirmLlmWikiPromotion: confirm,
      cancelLlmWikiPromotion: cancel
    })
    const modal = new NativeModals(h.context)
    await modal.openPromotion('arxiv:1')
    await modal.close()
    expect(cancel).toHaveBeenCalledWith(preview.previewId)
    await modal.openPromotion('arxiv:1')
    const screen = { render: () => modal.render()! }
    const work = h.act(screen, 'promotion-confirm')
    await modal.close()
    expect(modal.render()).toBeDefined()
    expect(confirm).toHaveBeenCalledOnce()
    finish(receipt)
    await work
  })
})

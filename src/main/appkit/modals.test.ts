import { describe, expect, it, vi } from 'vitest'
import type {
  LlmWikiPromotionPreview,
  LlmWikiPromotionReceipt
} from '../../shared/llmWikiPromotion'
import { NativeModals } from './modals'
import type { NativeNode } from './presentation'
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
const blocked: LlmWikiPromotionPreview = {
  ...preview,
  previewId: null,
  ready: false,
  level: null,
  intendedPaths: [],
  pdf: null,
  blockers: ['The vault writer lease is held.', 'No official PDF.']
}
const ids = (node: NativeNode): string[] => [node.id, ...(node.children ?? []).flatMap(ids)]
const open = async (overrides: Record<string, unknown> = {}) => {
  const h = nativeHarness({
    getLatestLlmWikiPromotion: vi.fn(async () => null),
    previewLlmWikiPromotion: vi.fn(async () => preview),
    cancelLlmWikiPromotion: vi.fn(async () => receipt),
    ...overrides
  })
  const modal = new NativeModals(h.context)
  const screen = { render: () => modal.render()! }
  return { h, modal, screen }
}

describe('native modal workflows', () => {
  it('makes Return close only read-only document sheets', async () => {
    const h = nativeHarness({
      getLatestLlmWikiPromotion: vi.fn(async () => null),
      previewLlmWikiPromotion: vi.fn(async () => preview),
      cancelLlmWikiPromotion: vi.fn(async () => receipt)
    })
    const modal = new NativeModals(h.context)
    const screen = { render: () => modal.render()! }
    modal.openDocument('TheRSS Help', '# Help')
    expect(h.find(h.render(screen), 'modal-close')?.shortcut).toBe('return')
    await modal.close()
    await modal.openPromotion('arxiv:1')
    expect(h.find(h.render(screen), 'modal-close')?.shortcut).toBeUndefined()
    expect(h.find(h.render(screen), 'promotion-confirm')?.shortcut).toBeUndefined()
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
      expect(h.find(h.render(screen), 'promotion-paths')?.text).toContain(path)
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
    expect(modal.visible).toBe(true)
    expect(confirm).toHaveBeenCalledOnce()
    finish(receipt)
    await work
  })

  it('steps the preview sheet aside while the final system confirmation is open', async () => {
    // A standard (non-critical) macOS alert waits until the window's current sheet ends.
    let finish!: (value: LlmWikiPromotionReceipt) => void
    const confirm = vi.fn(
      () =>
        new Promise<LlmWikiPromotionReceipt>((resolve) => {
          finish = resolve
        })
    )
    const h = nativeHarness({
      getLatestLlmWikiPromotion: vi.fn(async () => null),
      previewLlmWikiPromotion: vi.fn(async () => preview),
      confirmLlmWikiPromotion: confirm,
      cancelLlmWikiPromotion: vi.fn(async () => receipt)
    })
    const modal = new NativeModals(h.context)
    await modal.openPromotion('arxiv:1')
    const screen = { render: () => modal.render()! }
    const work = h.act(screen, 'promotion-confirm')
    await Promise.resolve()
    expect(confirm).toHaveBeenCalledOnce()
    expect(modal.render()).toBeUndefined()
    expect(modal.visible).toBe(true)
    expect(modal.blocksNavigation).toBe(true)
    finish(receipt)
    await work
    expect(h.find(h.render(screen), 'promotion-receipt-text')?.text).toContain('Fixture completed')
    expect(modal.focus).toBe('modal-close')
  })
})

describe('native promotion sheet layout', () => {
  it('puts the write set and blockers before the technical provenance', async () => {
    const { h, modal, screen } = await open()
    await modal.openPromotion('arxiv:1')
    const tree = h.render(screen)
    const order = ids(tree)
    const sections = [
      'promotion-summary',
      'promotion-blockers',
      'promotion-paths-heading',
      'promotion-paths',
      'promotion-evidence',
      'promotion-technical'
    ].map((id) => order.indexOf(id))
    expect(sections.every((index) => index >= 0)).toBe(true)
    expect([...sections].sort((a, b) => a - b)).toEqual(sections)
    expect(h.find(tree, 'promotion-summary')?.surface).toBe('inset')
    expect(h.find(tree, 'promotion-paper-title')?.text).toBe('Paper')
    expect(h.find(tree, 'promotion-destination')?.text).toBe('llm-wiki · Review level L2')
    expect(h.find(tree, 'promotion-rationale')?.text).toBe('Fixture')
    expect(h.find(tree, 'promotion-blockers')?.text).toBe('No blockers')
    expect(h.find(tree, 'promotion-paths-heading')?.text).toBe('Will write 4 files')
    expect(h.find(tree, 'promotion-evidence')?.text).toContain('Fixture only.')
    const paths = h.find(tree, 'promotion-paths')?.text ?? ''
    const technical = h.find(tree, 'promotion-technical')?.text ?? ''
    expect(paths).not.toContain(preview.sourceHash)
    for (const value of [
      '12 pages',
      '12000 bytes',
      preview.pdf!.sha256,
      preview.sourceHash,
      preview.contractHash,
      preview.expiresAt
    ])
      expect(technical).toContain(value)
    expect(h.find(tree, 'promotion-preview-text')).toBeUndefined()
  })

  it('lists every blocker with a marker and offers no write for a blocked preview', async () => {
    const { h, modal, screen } = await open({
      previewLlmWikiPromotion: vi.fn(async () => blocked)
    })
    await modal.openPromotion('arxiv:1')
    const tree = h.render(screen)
    expect(h.find(tree, 'promotion-blockers-symbol')).toMatchObject({
      kind: 'symbol',
      symbol: 'exclamationmark.circle',
      title: 'Blocked'
    })
    expect(h.find(tree, 'promotion-blockers-heading')).toMatchObject({
      text: '2 blockers prevent this write',
      weight: 'bold'
    })
    for (const blocker of blocked.blockers)
      expect(h.find(tree, 'promotion-blockers-list')?.text).toContain(blocker)
    expect(h.find(tree, 'promotion-destination')?.text).toBe('llm-wiki · Review level Blocked')
    expect(h.find(tree, 'promotion-paths-heading')?.text).toBe('No paths approved')
    expect(h.find(tree, 'promotion-technical')?.text).toContain('No verified PDF.')
    expect(h.find(tree, 'promotion-confirm')).toBeUndefined()
    const footer = h.find(tree, 'modal-footer')!
    expect(footer.children?.map((child) => child.id)).toEqual([
      'modal-footer-spacer',
      'promotion-new-preview',
      'modal-close'
    ])
  })

  it('right-aligns the sheet actions with the previewed write as the primary button', async () => {
    const { h, modal, screen } = await open()
    await modal.openPromotion('arxiv:1')
    const footer = h.find(h.render(screen), 'modal-footer')!
    expect(footer.children?.map((child) => child.id)).toEqual([
      'modal-footer-spacer',
      'modal-close',
      'promotion-confirm'
    ])
    expect(footer.children?.[0]?.flex).toBe(1)
    expect(footer.children?.[1]?.title).toBe('Cancel preview')
    expect(footer.children?.[2]).toMatchObject({
      title: 'Write to llm-wiki…',
      emphasis: 'primary',
      enabled: true
    })
    // The write keeps a deliberate click; only read-only documents close with Return.
    expect(footer.children?.[2]?.shortcut).toBeUndefined()
    await modal.close()
    modal.openDocument('TheRSS Help', '# Help')
    const document = h.find(h.render(screen), 'modal-footer')!
    expect(document.children?.map((child) => child.id)).toEqual([
      'modal-footer-spacer',
      'modal-close'
    ])
  })

  it('shows a native progress indicator only while the preview is prepared', async () => {
    let finish!: (value: LlmWikiPromotionPreview) => void
    const { h, modal, screen } = await open({
      previewLlmWikiPromotion: vi.fn(
        () =>
          new Promise<LlmWikiPromotionPreview>((resolve) => {
            finish = resolve
          })
      )
    })
    const work = modal.openPromotion('arxiv:1')
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    const busy = h.render(screen)
    expect(h.find(busy, 'promotion-progress-indicator')).toMatchObject({
      kind: 'progress',
      title: 'Preparing the PDF and write preview…'
    })
    expect(h.find(busy, 'promotion-progress-indicator')?.completed).toBeUndefined()
    expect(h.find(busy, 'promotion-progress')?.text).toBe('Preparing the PDF and write preview…')
    finish(preview)
    await work
    expect(h.find(h.render(screen), 'promotion-progress-indicator')).toBeUndefined()
  })

  it.each([
    ['running', 'In progress', false],
    ['completed', 'Completed', false],
    ['partial', 'Partially completed', true],
    ['blocked', 'Blocked', true],
    ['no-change', 'No change', false],
    ['no-source', 'No source', true],
    ['skipped', 'Skipped', false],
    ['failed', 'Failed', true]
  ])('names the %s receipt status as "%s"', async (status, phrase, attention) => {
    const { h, modal, screen } = await open({
      getLatestLlmWikiPromotion: vi.fn(async () => ({ ...receipt, status })),
      previewLlmWikiPromotion: vi.fn(async () => blocked)
    })
    await modal.openPromotion('arxiv:1')
    const tree = h.render(screen)
    expect(h.find(tree, 'promotion-receipt-status')).toMatchObject({
      text: phrase,
      weight: 'bold'
    })
    expect(h.find(tree, 'promotion-receipt-status-symbol')?.title).toBe(
      attention ? phrase : undefined
    )
    expect(h.find(tree, 'promotion-receipt-text')?.text).toContain('Fixture completed')
    expect(h.find(tree, 'promotion-receipt-text')?.text).not.toContain('Status:')
  })
})

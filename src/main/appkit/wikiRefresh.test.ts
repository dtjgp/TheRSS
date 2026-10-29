import { describe, expect, it, vi } from 'vitest'
import type { DashboardItem } from '../../shared/api'
import type { LlmWikiLibraryStatus, LlmWikiStatusRequest } from '../../shared/llmWikiLibrary'
import type {
  LlmWikiPromotionPreview,
  LlmWikiPromotionReceipt
} from '../../shared/llmWikiPromotion'
import { NativeModals } from './modals'
import { NativePresenter } from './presenter'
import { defaultNativePreferences } from './preferences'
import type { NativeNode } from './presentation'
import { nativeDiscoverFixture, nativeHarness } from './testSupport'

const arxivId = '2609.00001'
const preview: LlmWikiPromotionPreview = {
  version: 'llm-wiki-promotion-preview-v1',
  previewId: 'a0000000-0000-4000-8000-000000000001',
  itemId: 'arxiv:0',
  arxivId,
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
const absent: LlmWikiLibraryStatus = {
  arxivId,
  status: 'not-found',
  checkedAt: '2026-10-29T10:00:00Z',
  recordPath: null,
  notePath: null,
  level: null,
  readStatus: null,
  reason: null
}
const collected: LlmWikiLibraryStatus = {
  ...absent,
  status: 'recorded',
  checkedAt: '2026-10-29T10:05:00Z',
  recordPath: 'raw/paper_records/Paper.md',
  notePath: 'Literature/Paper_Notes/L2_Structured/Test/Paper.md',
  level: 'L2',
  readStatus: 'unread'
}

const promotionApi = (confirm: () => Promise<LlmWikiPromotionReceipt>) => ({
  getLatestLlmWikiPromotion: vi.fn(async () => null),
  previewLlmWikiPromotion: vi.fn(async () => preview),
  confirmLlmWikiPromotion: vi.fn(confirm),
  cancelLlmWikiPromotion: vi.fn(async () => receipt)
})

describe('llm-wiki status after a promotion write', () => {
  it('reports a settled confirm, including a failed one, but not a cancellation', async () => {
    const settled = vi.fn()
    const confirm = vi
      .fn<() => Promise<LlmWikiPromotionReceipt>>()
      .mockResolvedValueOnce(receipt)
      .mockRejectedValueOnce(new Error('Write failed'))
    const h = nativeHarness(promotionApi(confirm))
    const modal = new NativeModals(h.context, settled)
    const screen = { render: () => modal.render()! }

    await modal.openPromotion('arxiv:0')
    await modal.close()
    expect(settled).not.toHaveBeenCalled()

    await modal.openPromotion('arxiv:0')
    await h.act(screen, 'promotion-confirm')
    expect(settled).toHaveBeenCalledExactlyOnceWith(arxivId)

    await modal.openPromotion('arxiv:0')
    await h.act(screen, 'promotion-confirm')
    expect(h.find(h.render(screen), 'modal-message')?.text).toBe('Write failed')
    expect(settled).toHaveBeenCalledTimes(2)
    expect(settled).toHaveBeenLastCalledWith(arxivId)
  })

  it('does not report a write that ends after the window is disposed', async () => {
    let finish!: (value: LlmWikiPromotionReceipt) => void
    const settled = vi.fn()
    const h = nativeHarness(
      promotionApi(
        () =>
          new Promise<LlmWikiPromotionReceipt>((resolve) => {
            finish = resolve
          })
      )
    )
    const modal = new NativeModals(h.context, settled)
    await modal.openPromotion('arxiv:0')
    const work = h.act({ render: () => modal.render()! }, 'promotion-confirm')
    await Promise.resolve()
    modal.dispose()
    finish(receipt)
    await work
    expect(settled).not.toHaveBeenCalled()
  })

  it('rechecks the paper shown in the main window after the user confirms a write', async () => {
    const fixture = {
      ...nativeDiscoverFixture,
      items: nativeDiscoverFixture.items.map((item) => ({
        ...item,
        url: `https://arxiv.org/abs/${arxivId}v1`
      }))
    }
    let written = false
    const get = vi.fn(async (_request: LlmWikiStatusRequest) => (written ? collected : absent))
    const h = nativeHarness({
      getLocalAgentStatuses: vi.fn(async () => []),
      getLatestDiscover: vi.fn(async () => fixture),
      getLlmWikiStatus: get,
      ...promotionApi(async () => {
        written = true
        return receipt
      })
    })
    let json = ''
    const presenter = new NativePresenter(h.api, {
      preferences: { ...defaultNativePreferences },
      present: (scene) => {
        json = scene
      },
      persist: vi.fn(async () => undefined),
      openExternal: vi.fn()
    })
    // A sheet is presented in the scene's `modal` tree, beside the window root.
    const node = (id: string): NativeNode | undefined => {
      const scene = JSON.parse(json) as { root: NativeNode; modal?: NativeNode }
      return h.find(scene.root, id) ?? (scene.modal ? h.find(scene.modal, id) : undefined)
    }
    const press = async (id: string) => {
      const action = node(id)?.action
      if (!action) throw new Error(`Missing native action ${id}`)
      await presenter.presentation.dispatch(JSON.stringify({ action }))
    }
    const navigate = (route: string) =>
      presenter.presentation.dispatch(
        JSON.stringify({ action: node('native-navigation')!.action, value: route })
      )
    // The same paper is also on the Saved shelf, whose reader was shown before the write.
    const first = fixture.items[0]!
    const savedItem: DashboardItem = {
      id: first.id,
      source: first.source,
      kind: first.kind,
      title: first.title,
      summary: first.summary,
      url: first.url,
      publishedAt: first.publishedAt,
      score: first.score,
      triageState: 'saved',
      reasons: first.reasons
    }
    Object.assign(h.dashboard, { savedItems: [savedItem] })
    try {
      await presenter.start()
      await navigate('saved')
      await vi.waitFor(() =>
        expect(node('saved-wiki-status')?.text).toBe('No llm-wiki paper record found')
      )
      await navigate('discover')
      await vi.waitFor(() =>
        expect(node('discover-wiki-status')?.text).toBe('No llm-wiki paper record found')
      )
      await press('discover-promote')
      await vi.waitFor(() => expect(node('promotion-confirm')).toBeDefined())
      await press('promotion-confirm')
      await vi.waitFor(() => expect(node('discover-wiki-status')?.text).toContain('In llm-wiki'))
      expect(get).toHaveBeenLastCalledWith({ arxivId, refresh: true })
      expect(get.mock.calls.filter(([request]) => request.refresh === true)).toHaveLength(2)
      expect(node('discover-wiki-open')?.emphasis).toBe('primary')
      await press('modal-close')
      await navigate('saved')
      expect(node('saved-wiki-status')?.text).toContain('In llm-wiki')
    } finally {
      presenter.dispose()
    }
  })
})

// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { TheRSSApi } from '../../shared/api'
import type {
  LlmWikiPromotionPreview,
  LlmWikiPromotionReceipt
} from '../../shared/llmWikiPromotion'
import { PaperPromotionAction } from './PaperPromotionAction'

const preview: LlmWikiPromotionPreview = {
  version: 'llm-wiki-promotion-preview-v1',
  previewId: '11111111-1111-4111-8111-111111111111',
  itemId: 'arxiv:2608.00001',
  arxivId: '2608.00001',
  title: 'Structured pruning for edge deployment',
  ready: true,
  vaultLabel: 'llm-wiki',
  level: 'L2',
  routingRationale: 'Important reference; not yet foundational.',
  intendedPaths: [
    'raw/papers/Researcher et al. - 2026 - Structured pruning.pdf',
    'raw/paper_records/Researcher et al. - 2026 - Structured pruning.md',
    'Literature/Paper_Notes/L2_Structured/Researcher_2026_Paper.md'
  ],
  pdf: { pageCount: 12, byteSize: 120000, sha256: 'c'.repeat(64) },
  evidenceBoundary: 'Verified full text, not reproduced results.',
  blockers: [],
  sourceHash: 'a'.repeat(64),
  contractHash: 'b'.repeat(64),
  expiresAt: '2026-08-21T10:30:00.000Z'
}

const receipt: LlmWikiPromotionReceipt = {
  version: 'llm-wiki-promotion-v1',
  id: 'promotion-1',
  itemId: preview.itemId,
  arxivId: preview.arxivId,
  status: 'completed',
  runner: 'codex',
  promptVersion: 'llm-wiki-promotion-v1',
  sourceHash: preview.sourceHash,
  contractHash: preview.contractHash,
  evidenceTier: 'full-text-verified',
  summary: 'PDF, sidecar, and note verified.',
  createdPaths: preview.intendedPaths,
  updatedPaths: ['Literature/Paper_Notes/Paper_Notes_Index.md', 'index.md', 'log.md'],
  pdfPath: preview.intendedPaths[0]!,
  sidecarPath: preview.intendedPaths[1]!,
  notePath: preview.intendedPaths[2]!,
  auditPath: 'Automation_Conversations/2026-08-21__therss-paper-promotion__120000.md',
  blockers: [],
  startedAt: '2026-08-21T10:00:00.000Z',
  completedAt: '2026-08-21T10:02:00.000Z'
}

function api(overrides: Partial<TheRSSApi> = {}): TheRSSApi {
  return {
    previewLlmWikiPromotion: vi.fn().mockResolvedValue(preview),
    confirmLlmWikiPromotion: vi.fn().mockResolvedValue(receipt),
    cancelLlmWikiPromotion: vi.fn().mockResolvedValue({ ...receipt, status: 'skipped' }),
    getLatestLlmWikiPromotion: vi.fn().mockResolvedValue(null),
    ...overrides
  } as unknown as TheRSSApi
}

describe('PaperPromotionAction', () => {
  it('previews exact paths and requires a separate confirmation before writing', async () => {
    const user = userEvent.setup()
    const bridge = api()
    render(
      <PaperPromotionAction api={bridge} itemId={preview.itemId} sessionId="discover-session-1" />
    )

    await user.click(screen.getByRole('button', { name: 'Promote to llm-wiki' }))

    const dialog = await screen.findByRole('dialog', { name: 'Promote paper to llm-wiki' })
    expect(bridge.previewLlmWikiPromotion).toHaveBeenCalledWith(
      preview.itemId,
      'discover-session-1'
    )
    expect(dialog).toHaveTextContent('local llm-wiki vault')
    expect(dialog).toHaveTextContent('L2')
    expect(dialog).toHaveTextContent(preview.intendedPaths[0]!)
    expect(bridge.confirmLlmWikiPromotion).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Confirm local promotion' }))
    expect(bridge.confirmLlmWikiPromotion).toHaveBeenCalledWith(preview.previewId)
    expect(await screen.findByRole('status')).toHaveTextContent('PDF, sidecar, and note verified.')
  })

  it('cancels a prepared preview without confirming', async () => {
    const user = userEvent.setup()
    const bridge = api()
    render(<PaperPromotionAction api={bridge} itemId={preview.itemId} />)

    await user.click(screen.getByRole('button', { name: 'Promote to llm-wiki' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel promotion' }))

    expect(bridge.cancelLlmWikiPromotion).toHaveBeenCalledWith(preview.previewId)
    expect(bridge.confirmLlmWikiPromotion).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows blockers without exposing a confirmation action', async () => {
    const user = userEvent.setup()
    const bridge = api({
      previewLlmWikiPromotion: vi.fn().mockResolvedValue({
        ...preview,
        previewId: null,
        ready: false,
        level: null,
        pdf: null,
        intendedPaths: [],
        blockers: ['The llm-wiki writer scope is not registered.']
      })
    })
    render(<PaperPromotionAction api={bridge} itemId={preview.itemId} />)

    await user.click(screen.getByRole('button', { name: 'Promote to llm-wiki' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('writer scope is not registered')
    expect(
      screen.queryByRole('button', { name: 'Confirm local promotion' })
    ).not.toBeInTheDocument()
  })

  it('renders a persisted receipt in the separate detail status host when provided', async () => {
    document.body.innerHTML = '<div id="promotion-status-host"></div>'
    const bridge = api({ getLatestLlmWikiPromotion: vi.fn().mockResolvedValue(receipt) })

    render(
      <PaperPromotionAction
        api={bridge}
        itemId={preview.itemId}
        statusTargetId="promotion-status-host"
      />
    )

    const host = document.getElementById('promotion-status-host')!
    expect(await within(host).findByRole('status')).toHaveTextContent(receipt.summary)
    expect(screen.getByRole('button', { name: 'Promote to llm-wiki' })).toBeVisible()
  })

  it('closes a consumed preview and exposes a retryable error when confirmation fails', async () => {
    const user = userEvent.setup()
    const bridge = api({
      confirmLlmWikiPromotion: vi
        .fn()
        .mockRejectedValue(new Error('Promotion preview is missing, expired, or already used'))
    })
    render(<PaperPromotionAction api={bridge} itemId={preview.itemId} />)

    await user.click(screen.getByRole('button', { name: 'Promote to llm-wiki' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm local promotion' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('missing, expired, or already used')
    expect(screen.getByRole('button', { name: 'Promote to llm-wiki' })).toBeEnabled()
  })
})

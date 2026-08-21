import { describe, expect, it, vi } from 'vitest'
import type { DiscoveryItem } from '../../shared/discovery'
import type { LlmWikiPromotionReceipt } from '../../shared/llmWikiPromotion'
import {
  hashPromotionSource,
  LlmWikiPromotionService,
  type PreparedLlmWikiPromotion
} from './llmWikiPromotionService'

const paper: DiscoveryItem = {
  id: 'arxiv:2608.00001',
  source: 'arxiv',
  kind: 'paper',
  externalId: '2608.00001',
  title: 'Structured pruning for edge deployment',
  summary: 'A resource-aware method.',
  url: 'https://arxiv.org/abs/2608.00001',
  publishedAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
  authors: ['Ada Researcher', 'Bo Engineer'],
  categories: ['cs.LG'],
  topics: [],
  language: null,
  stars: null,
  metrics: {}
}

const prepared: PreparedLlmWikiPromotion = {
  preview: {
    version: 'llm-wiki-promotion-preview-v1',
    previewId: '11111111-1111-4111-8111-111111111111',
    itemId: paper.id,
    arxivId: paper.externalId,
    title: paper.title,
    ready: true,
    vaultLabel: 'llm-wiki',
    level: 'L2',
    routingRationale: 'Important reference; not yet a foundational result.',
    intendedPaths: [
      'raw/papers/Researcher et al. - 2026 - Structured pruning for edge deployment.pdf',
      'raw/paper_records/Researcher et al. - 2026 - Structured pruning for edge deployment.md',
      'Literature/Paper_Notes/L2_Structured/Model_Compression/Researcher_2026_StructuredPruning.md',
      'Literature/Paper_Notes/Paper_Notes_Index.md',
      'index.md',
      'log.md'
    ],
    pdf: { pageCount: 12, byteSize: 120000, sha256: 'c'.repeat(64) },
    evidenceBoundary: 'The note will be based on the verified PDF; no reproduction is implied.',
    blockers: [],
    sourceHash: hashPromotionSource(paper),
    contractHash: 'b'.repeat(64),
    expiresAt: '2026-08-21T10:30:00.000Z'
  },
  opaqueHandle: { tempDirectory: '/tmp/fixture' }
}

function completedReceipt(): LlmWikiPromotionReceipt {
  return {
    version: 'llm-wiki-promotion-v1',
    id: 'promotion-1',
    itemId: paper.id,
    arxivId: paper.externalId,
    status: 'completed',
    runner: 'codex',
    promptVersion: 'llm-wiki-promotion-v1',
    sourceHash: hashPromotionSource(paper),
    contractHash: 'b'.repeat(64),
    evidenceTier: 'full-text-verified',
    summary: 'Promotion complete.',
    createdPaths: prepared.preview.intendedPaths.slice(0, 3),
    updatedPaths: prepared.preview.intendedPaths.slice(3),
    pdfPath: prepared.preview.intendedPaths[0]!,
    sidecarPath: prepared.preview.intendedPaths[1]!,
    notePath: prepared.preview.intendedPaths[2]!,
    auditPath: 'Automation_Conversations/2026-08-21__therss-paper-promotion__120000.md',
    blockers: [],
    startedAt: '2026-08-21T10:00:00.000Z',
    completedAt: '2026-08-21T10:02:00.000Z'
  }
}

function setup(item: DiscoveryItem | null = paper) {
  const repository = {
    getDiscoveryRecord: vi.fn(() => item),
    saveLlmWikiPromotionReceipt: vi.fn(),
    getLatestLlmWikiPromotionReceipt: vi.fn(() => null)
  }
  const adapter = {
    prepare: vi.fn(async () => prepared),
    confirm: vi.fn(async () => completedReceipt()),
    dispose: vi.fn(async () => undefined)
  }
  const service = new LlmWikiPromotionService(repository, adapter, {
    now: () => new Date('2026-08-21T10:00:00.000Z'),
    previewIdFactory: () => '11111111-1111-4111-8111-111111111111'
  })
  return { service, repository, adapter }
}

describe('LlmWikiPromotionService', () => {
  it('rejects non-arXiv and non-paper records before preparing a vault write', async () => {
    const { service, adapter } = setup({ ...paper, source: 'folo:302', externalId: 'paper-1' })

    await expect(service.preview(paper.id)).rejects.toThrow('Only arXiv papers can be promoted')
    expect(adapter.prepare).not.toHaveBeenCalled()

    const nonPaper = setup({ ...paper, kind: 'article' })
    await expect(nonPaper.service.preview(paper.id)).rejects.toThrow(
      'Only arXiv papers can be promoted'
    )
    expect(nonPaper.adapter.prepare).not.toHaveBeenCalled()
  })

  it('rejects missing records, malformed identifiers, and non-arXiv URLs', async () => {
    await expect(setup(null).service.preview(paper.id)).rejects.toThrow('Unknown discovery item')
    await expect(
      setup({ ...paper, externalId: 'not-an-arxiv-id' }).service.preview(paper.id)
    ).rejects.toThrow('no canonical arXiv identifier')
    await expect(
      setup({ ...paper, url: 'https://example.com/abs/2608.00001' }).service.preview(paper.id)
    ).rejects.toThrow('no canonical arXiv URL')
    await expect(
      setup({ ...paper, url: 'https://arxiv.org/abs/2608.000010' }).service.preview(paper.id)
    ).rejects.toThrow('no canonical arXiv URL')
    await expect(
      setup({ ...paper, url: 'https://arxiv.org/abs/2608.00001evil' }).service.preview(paper.id)
    ).rejects.toThrow('no canonical arXiv URL')
  })

  it('accepts a versioned record on the canonical www arXiv host', async () => {
    const versioned = {
      ...paper,
      externalId: '2608.00001v2',
      url: 'https://www.arxiv.org/abs/2608.00001v2'
    }
    const { service } = setup(versioned)

    await expect(service.preview(versioned.id)).resolves.toMatchObject({ arxivId: '2608.00001' })
  })

  it('prepares an opaque expiring preview from the full persisted record', async () => {
    const { service, adapter } = setup()

    await expect(service.preview(paper.id)).resolves.toEqual(prepared.preview)
    expect(adapter.prepare).toHaveBeenCalledWith(
      paper,
      expect.objectContaining({
        previewId: prepared.preview.previewId,
        expiresAt: prepared.preview.expiresAt
      })
    )
  })

  it('disposes a blocked adapter preview instead of retaining a confirmation token', async () => {
    const { service, adapter } = setup()
    adapter.prepare.mockResolvedValue({
      ...prepared,
      preview: {
        ...prepared.preview,
        previewId: null,
        ready: false,
        level: null,
        intendedPaths: [],
        pdf: null,
        blockers: ['Fixture preflight blocker.']
      }
    })

    await expect(service.preview(paper.id)).resolves.toMatchObject({
      ready: false,
      previewId: null
    })
    expect(adapter.dispose).toHaveBeenCalledOnce()
  })

  it('confirms a preview once and persists running plus terminal receipts', async () => {
    const { service, repository, adapter } = setup()
    const preview = await service.preview(paper.id)

    await expect(service.confirm(preview.previewId!)).resolves.toEqual(completedReceipt())
    expect(repository.saveLlmWikiPromotionReceipt).toHaveBeenCalledTimes(2)
    expect(repository.saveLlmWikiPromotionReceipt.mock.calls[0]![0]).toMatchObject({
      itemId: paper.id,
      status: 'running'
    })
    expect(repository.saveLlmWikiPromotionReceipt.mock.calls[1]![0]).toEqual(completedReceipt())
    expect(adapter.confirm).toHaveBeenCalledWith(prepared)

    await expect(service.confirm(preview.previewId!)).rejects.toThrow(
      'Promotion preview is missing, expired, or already used'
    )
  })

  it('returns a conservative partial receipt when the adapter outcome is ambiguous', async () => {
    const { service, repository, adapter } = setup()
    const preview = await service.preview(paper.id)
    adapter.confirm.mockRejectedValue(new Error('sensitive adapter error'))

    await expect(service.confirm(preview.previewId!)).resolves.toMatchObject({
      status: 'partial',
      summary: expect.not.stringContaining('sensitive adapter error')
    })
    expect(repository.saveLlmWikiPromotionReceipt).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'partial' })
    )
    expect(adapter.dispose).toHaveBeenCalledWith(prepared)
  })

  it('disposes staging without starting a vault write when the running receipt cannot persist', async () => {
    const { service, repository, adapter } = setup()
    const preview = await service.preview(paper.id)
    repository.saveLlmWikiPromotionReceipt.mockImplementationOnce(() => {
      throw new Error('fixture sqlite failure')
    })

    await expect(service.confirm(preview.previewId!)).rejects.toThrow('fixture sqlite failure')
    expect(adapter.confirm).not.toHaveBeenCalled()
    expect(adapter.dispose).toHaveBeenCalledWith(prepared)
  })

  it('binds confirmation tokens to the IPC owner that created the preview', async () => {
    const { service, adapter } = setup()
    const preview = await service.preview(paper.id, 'renderer-1')

    await expect(service.confirm(preview.previewId!, 'renderer-2')).rejects.toThrow(
      'missing, expired, or already used'
    )
    expect(adapter.confirm).not.toHaveBeenCalled()
    await expect(service.cancel(preview.previewId!, 'renderer-1')).resolves.toMatchObject({
      status: 'skipped'
    })
  })

  it('fails closed when the persisted paper changes after preview', async () => {
    const { service, repository, adapter } = setup()
    const preview = await service.preview(paper.id)
    repository.getDiscoveryRecord.mockReturnValue({ ...paper, summary: 'A changed abstract.' })

    await expect(service.confirm(preview.previewId!)).rejects.toThrow(
      'The paper changed after preview'
    )
    expect(adapter.confirm).not.toHaveBeenCalled()
    expect(adapter.dispose).toHaveBeenCalledWith(prepared)
  })

  it('cancels without writing the vault and records a skipped receipt', async () => {
    const { service, repository, adapter } = setup()
    const preview = await service.preview(paper.id)

    await expect(service.cancel(preview.previewId!)).resolves.toMatchObject({
      itemId: paper.id,
      status: 'skipped'
    })
    expect(adapter.dispose).toHaveBeenCalledWith(prepared)
    expect(adapter.confirm).not.toHaveBeenCalled()
    expect(repository.saveLlmWikiPromotionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped' })
    )
  })

  it('disposes an expired preview and exposes latest-receipt plus shutdown cleanup', async () => {
    const repository = {
      getDiscoveryRecord: vi.fn(() => paper),
      saveLlmWikiPromotionReceipt: vi.fn(),
      getLatestLlmWikiPromotionReceipt: vi.fn(() => completedReceipt())
    }
    const adapter = {
      prepare: vi.fn(async () => prepared),
      confirm: vi.fn(async () => completedReceipt()),
      dispose: vi.fn(async () => undefined)
    }
    let current = new Date('2026-08-21T10:00:00.000Z')
    let sequence = 0
    const service = new LlmWikiPromotionService(repository, adapter, {
      now: () => current,
      previewIdFactory: () =>
        sequence++ === 0
          ? '11111111-1111-4111-8111-111111111111'
          : '22222222-2222-4222-8222-222222222222'
    })
    const expired = await service.preview(paper.id)
    current = new Date('2026-08-21T10:31:00.000Z')

    await expect(service.confirm(expired.previewId!)).rejects.toThrow('missing, expired')
    expect(adapter.dispose).toHaveBeenCalledTimes(1)
    expect(service.getLatest(paper.id)).toEqual(completedReceipt())

    await service.preview(paper.id)
    await service.disposeAll()
    expect(adapter.dispose).toHaveBeenCalledTimes(2)
  })

  it('bounds retained staging and disposes the oldest preview before accepting a fifth', async () => {
    const fixture = setup()
    let sequence = 0
    const service = new LlmWikiPromotionService(fixture.repository, fixture.adapter, {
      now: () => new Date('2026-08-21T10:00:00.000Z'),
      previewIdFactory: () => `11111111-1111-4111-8111-${String(sequence++).padStart(12, '0')}`
    })

    for (let index = 0; index < 5; index += 1) {
      await service.preview(`paper-${index}`, `renderer-${index}`)
    }

    expect(fixture.adapter.dispose).toHaveBeenCalledTimes(1)
    await service.disposeAll()
    expect(fixture.adapter.dispose).toHaveBeenCalledTimes(5)
  })

  it('replaces an older preview for the same paper and disposes its staging', async () => {
    const fixture = setup()

    await fixture.service.preview(paper.id)
    await fixture.service.preview(paper.id)

    expect(fixture.adapter.dispose).toHaveBeenCalledTimes(1)
    await fixture.service.disposeAll()
  })

  it('supports production default clocks and UUID factories', async () => {
    const fixture = setup()
    const service = new LlmWikiPromotionService(fixture.repository, fixture.adapter)

    const preview = await service.preview(paper.id)
    expect(preview.previewId).toMatch(/^[a-f0-9-]{36}$/u)
    await expect(service.cancel(preview.previewId!)).resolves.toMatchObject({ status: 'skipped' })
  })

  it('waits for an in-flight confirmed transaction during shutdown', async () => {
    const fixture = setup()
    let releaseConfirm: (() => void) | undefined
    fixture.adapter.confirm.mockImplementation(
      () =>
        new Promise<LlmWikiPromotionReceipt>((resolve) => {
          releaseConfirm = () => resolve(completedReceipt())
        })
    )
    const preview = await fixture.service.preview(paper.id)
    const confirmation = fixture.service.confirm(preview.previewId!)
    await vi.waitFor(() => expect(fixture.adapter.confirm).toHaveBeenCalledOnce())

    let shutdownCompleted = false
    const shutdown = fixture.service.disposeAll().then(() => {
      shutdownCompleted = true
    })
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(shutdownCompleted).toBe(false)

    releaseConfirm?.()
    await expect(confirmation).resolves.toEqual(completedReceipt())
    await shutdown
    expect(shutdownCompleted).toBe(true)
    expect(fixture.adapter.dispose).toHaveBeenCalledWith(prepared)
  })

  it('closes operation admission and disposes a preview that completes during shutdown', async () => {
    const fixture = setup()
    let releasePrepare: (() => void) | undefined
    fixture.adapter.prepare.mockImplementation(
      () =>
        new Promise<PreparedLlmWikiPromotion>((resolve) => {
          releasePrepare = () => resolve(prepared)
        })
    )

    const preparing = fixture.service.preview(paper.id)
    await vi.waitFor(() => expect(fixture.adapter.prepare).toHaveBeenCalledOnce())
    const shutdown = fixture.service.disposeAll()
    releasePrepare?.()
    const preview = await preparing
    await shutdown

    expect(fixture.adapter.dispose).toHaveBeenCalledWith(prepared)
    await expect(fixture.service.preview(paper.id)).rejects.toThrow('shutting down')
    await expect(fixture.service.confirm(preview.previewId!)).rejects.toThrow('shutting down')
    await expect(fixture.service.cancel(preview.previewId!)).rejects.toThrow('shutting down')
  })
})

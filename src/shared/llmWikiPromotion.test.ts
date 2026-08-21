import { describe, expect, it } from 'vitest'
import {
  isSafeLlmWikiRelativePath,
  llmWikiPromotionPreviewSchema,
  llmWikiPromotionPreviewRequestSchema,
  llmWikiPromotionReceiptSchema
} from './llmWikiPromotion'

describe('llm-wiki promotion contract', () => {
  it('accepts only traversal-free vault-relative paths', () => {
    expect(isSafeLlmWikiRelativePath('raw/papers/A Paper.pdf')).toBe(true)
    expect(
      isSafeLlmWikiRelativePath(
        'Literature/Paper_Notes/L2_Structured/Model_Compression/Author_2026_Paper.md'
      )
    ).toBe(true)

    expect(isSafeLlmWikiRelativePath('/Users/test/Obsidian/llm-wiki/index.md')).toBe(false)
    expect(isSafeLlmWikiRelativePath('../index.md')).toBe(false)
    expect(isSafeLlmWikiRelativePath('raw/papers/../../index.md')).toBe(false)
    expect(isSafeLlmWikiRelativePath('raw\\papers\\Paper.pdf')).toBe(false)
    expect(isSafeLlmWikiRelativePath('')).toBe(false)
    expect(isSafeLlmWikiRelativePath('raw/papers/Bad\u0000Name.pdf')).toBe(false)
  })

  it('keeps renderer preview input limited to stable local identifiers', () => {
    expect(
      llmWikiPromotionPreviewRequestSchema.parse({
        itemId: 'arxiv:2608.00001',
        sessionId: 'discover-session-1'
      })
    ).toEqual({ itemId: 'arxiv:2608.00001', sessionId: 'discover-session-1' })

    expect(() =>
      llmWikiPromotionPreviewRequestSchema.parse({
        itemId: 'arxiv:2608.00001',
        vaultRoot: '/tmp/forged',
        title: 'renderer supplied title'
      })
    ).toThrow()
  })

  it('validates append-only terminal receipts and rejects unsafe output paths', () => {
    const receipt = {
      version: 'llm-wiki-promotion-v1',
      id: 'promotion-1',
      itemId: 'arxiv:2608.00001',
      arxivId: '2608.00001',
      status: 'completed',
      runner: 'codex',
      promptVersion: 'llm-wiki-promotion-v1',
      sourceHash: 'a'.repeat(64),
      contractHash: 'b'.repeat(64),
      evidenceTier: 'full-text-verified',
      summary: 'PDF, sidecar, and L2 note verified.',
      createdPaths: [
        'raw/papers/Researcher et al. - 2026 - Structured pruning.pdf',
        'raw/paper_records/Researcher et al. - 2026 - Structured pruning.md',
        'Literature/Paper_Notes/L2_Structured/Model_Compression/Researcher_2026_Paper.md'
      ],
      updatedPaths: ['Literature/Paper_Notes/Paper_Notes_Index.md', 'index.md', 'log.md'],
      pdfPath: 'raw/papers/Researcher et al. - 2026 - Structured pruning.pdf',
      sidecarPath: 'raw/paper_records/Researcher et al. - 2026 - Structured pruning.md',
      notePath: 'Literature/Paper_Notes/L2_Structured/Model_Compression/Researcher_2026_Paper.md',
      auditPath: 'Automation_Conversations/2026-08-21__therss-paper-promotion__120000.md',
      blockers: [],
      startedAt: '2026-08-21T10:00:00.000Z',
      completedAt: '2026-08-21T10:02:00.000Z'
    } as const

    expect(llmWikiPromotionReceiptSchema.parse(receipt)).toEqual(receipt)
    expect(() =>
      llmWikiPromotionReceiptSchema.parse({
        ...receipt,
        createdPaths: ['../../outside.md']
      })
    ).toThrow()
    expect(
      llmWikiPromotionReceiptSchema.safeParse({
        ...receipt,
        pdfPath: null,
        sidecarPath: null,
        notePath: null,
        auditPath: null
      }).success
    ).toBe(false)
    expect(
      llmWikiPromotionReceiptSchema.safeParse({
        ...receipt,
        status: 'running',
        completedAt: receipt.completedAt,
        evidenceTier: 'full-text-verified'
      }).success
    ).toBe(false)
  })

  it('rejects contradictory ready and blocked preview states', () => {
    const base = {
      version: 'llm-wiki-promotion-preview-v1',
      previewId: '11111111-1111-4111-8111-111111111111',
      itemId: 'arxiv:2608.00001',
      arxivId: '2608.00001',
      title: 'Paper',
      ready: true,
      vaultLabel: 'llm-wiki',
      level: 'L2',
      routingRationale: 'Fixture route.',
      intendedPaths: ['raw/a', 'raw/b', 'Literature/c', 'index.md'],
      pdf: { pageCount: 1, byteSize: 10, sha256: 'a'.repeat(64) },
      evidenceBoundary: 'Fixture evidence boundary.',
      blockers: [],
      sourceHash: 'b'.repeat(64),
      contractHash: 'c'.repeat(64),
      expiresAt: '2026-08-21T10:30:00.000Z'
    } as const

    expect(llmWikiPromotionPreviewSchema.safeParse(base).success).toBe(true)
    expect(
      llmWikiPromotionPreviewSchema.safeParse({
        ...base,
        ready: false,
        previewId: null,
        level: null,
        pdf: null,
        intendedPaths: [],
        blockers: []
      }).success
    ).toBe(false)
    expect(
      llmWikiPromotionPreviewSchema.safeParse({ ...base, blockers: ['Contradiction'] }).success
    ).toBe(false)
  })
})

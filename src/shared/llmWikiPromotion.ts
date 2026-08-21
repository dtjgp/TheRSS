import { z } from 'zod'

export const LLM_WIKI_PROMOTION_PROMPT_VERSION = 'llm-wiki-promotion-v1' as const
export const LLM_WIKI_PROMOTION_PREVIEW_VERSION = 'llm-wiki-promotion-preview-v1' as const
export const LLM_WIKI_PROMOTION_RECEIPT_VERSION = 'llm-wiki-promotion-v1' as const

export const LLM_WIKI_PROMOTION_STATUSES = [
  'running',
  'completed',
  'partial',
  'blocked',
  'no-change',
  'no-source',
  'skipped',
  'failed'
] as const

export type LlmWikiPromotionStatus = (typeof LLM_WIKI_PROMOTION_STATUSES)[number]
export type LlmWikiPromotionLevel = 'L1' | 'L2'
export type LlmWikiPromotionEvidenceTier =
  'pending' | 'full-text-verified' | 'partial' | 'no-source'

const boundedIdSchema = z.string().trim().min(1).max(300)
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/u)

export function isSafeLlmWikiRelativePath(value: string): boolean {
  if (!value || value.length > 512 || value.startsWith('/') || value.startsWith('\\')) return false
  if (
    value.includes('\\') ||
    [...value].some((character) => {
      const code = character.charCodeAt(0)
      return code <= 31 || code === 127
    })
  ) {
    return false
  }
  const segments = value.split('/')
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
}

export const llmWikiRelativePathSchema = z
  .string()
  .max(512)
  .refine(isSafeLlmWikiRelativePath, 'Expected a safe llm-wiki relative path')

export const llmWikiPromotionPreviewRequestSchema = z
  .object({
    itemId: boundedIdSchema,
    sessionId: boundedIdSchema.optional()
  })
  .strict()

export const llmWikiPromotionPreviewIdSchema = z.string().uuid()

export const llmWikiPromotionConfirmRequestSchema = z
  .object({ previewId: llmWikiPromotionPreviewIdSchema })
  .strict()

const pdfPreviewSchema = z
  .object({
    pageCount: z.number().int().positive().max(10_000),
    byteSize: z.number().int().positive().max(100_000_000),
    sha256: hashSchema
  })
  .strict()

export const llmWikiPromotionPreviewSchema = z
  .object({
    version: z.literal(LLM_WIKI_PROMOTION_PREVIEW_VERSION),
    previewId: llmWikiPromotionPreviewIdSchema.nullable(),
    itemId: boundedIdSchema,
    arxivId: z.string().regex(/^\d{4}\.\d{4,5}$/u),
    title: z.string().min(1).max(1_000),
    ready: z.boolean(),
    vaultLabel: z.literal('llm-wiki'),
    level: z.enum(['L1', 'L2']).nullable(),
    routingRationale: z.string().max(2_000),
    intendedPaths: z.array(llmWikiRelativePathSchema).max(32),
    pdf: pdfPreviewSchema.nullable(),
    evidenceBoundary: z.string().min(1).max(2_000),
    blockers: z.array(z.string().min(1).max(1_000)).max(16),
    sourceHash: hashSchema,
    contractHash: hashSchema,
    expiresAt: z.string().datetime()
  })
  .strict()
  .superRefine((preview, context) => {
    if (preview.ready) {
      if (
        !preview.previewId ||
        !preview.level ||
        !preview.pdf ||
        preview.intendedPaths.length < 4
      ) {
        context.addIssue({ code: 'custom', message: 'A ready preview is missing write facts' })
      }
      if (preview.blockers.length > 0) {
        context.addIssue({ code: 'custom', message: 'A ready preview cannot contain blockers' })
      }
      return
    }
    if (
      preview.previewId !== null ||
      preview.level !== null ||
      preview.pdf !== null ||
      preview.intendedPaths.length > 0 ||
      preview.blockers.length === 0
    ) {
      context.addIssue({ code: 'custom', message: 'A blocked preview has inconsistent state' })
    }
  })

export type LlmWikiPromotionPreview = z.infer<typeof llmWikiPromotionPreviewSchema>

export const llmWikiPromotionReceiptSchema = z
  .object({
    version: z.literal(LLM_WIKI_PROMOTION_RECEIPT_VERSION),
    id: boundedIdSchema,
    itemId: boundedIdSchema,
    arxivId: z.string().regex(/^\d{4}\.\d{4,5}$/u),
    status: z.enum(LLM_WIKI_PROMOTION_STATUSES),
    runner: z.literal('codex'),
    promptVersion: z.literal(LLM_WIKI_PROMOTION_PROMPT_VERSION),
    sourceHash: hashSchema,
    contractHash: hashSchema,
    evidenceTier: z.enum(['pending', 'full-text-verified', 'partial', 'no-source']),
    summary: z.string().max(4_000),
    createdPaths: z.array(llmWikiRelativePathSchema).max(32),
    updatedPaths: z.array(llmWikiRelativePathSchema).max(32),
    pdfPath: llmWikiRelativePathSchema.nullable(),
    sidecarPath: llmWikiRelativePathSchema.nullable(),
    notePath: llmWikiRelativePathSchema.nullable(),
    auditPath: llmWikiRelativePathSchema.nullable(),
    blockers: z.array(z.string().min(1).max(1_000)).max(16),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable()
  })
  .strict()
  .superRefine((receipt, context) => {
    const artifactPaths = [
      receipt.pdfPath,
      receipt.sidecarPath,
      receipt.notePath,
      receipt.auditPath
    ]
    if (receipt.status === 'running') {
      if (
        receipt.completedAt !== null ||
        receipt.evidenceTier !== 'pending' ||
        artifactPaths.some((path) => path !== null) ||
        receipt.createdPaths.length > 0 ||
        receipt.updatedPaths.length > 0
      ) {
        context.addIssue({ code: 'custom', message: 'A running receipt has terminal state' })
      }
      return
    }
    if (receipt.completedAt === null) {
      context.addIssue({ code: 'custom', message: 'A terminal receipt needs completedAt' })
    }
    if (receipt.status === 'completed') {
      if (
        receipt.evidenceTier !== 'full-text-verified' ||
        artifactPaths.some((path) => path === null) ||
        receipt.createdPaths.length === 0 ||
        receipt.updatedPaths.length === 0 ||
        receipt.blockers.length > 0
      ) {
        context.addIssue({ code: 'custom', message: 'A completed receipt is missing evidence' })
      }
    } else if (receipt.evidenceTier === 'full-text-verified') {
      context.addIssue({ code: 'custom', message: 'Only completed receipts verify full text' })
    }
  })

export type LlmWikiPromotionReceipt = z.infer<typeof llmWikiPromotionReceiptSchema>

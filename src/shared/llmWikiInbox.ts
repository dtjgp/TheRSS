import { z } from 'zod'
import {
  LLM_WIKI_PROMOTION_STATUSES,
  llmWikiPromotionPreviewIdSchema,
  llmWikiRelativePathSchema,
  type LlmWikiPromotionStatus
} from './llmWikiPromotion'

export const LLM_WIKI_INBOX_PREVIEW_VERSION = 'llm-wiki-inbox-preview-v1' as const
export const LLM_WIKI_INBOX_RECEIPT_VERSION = 'llm-wiki-inbox-receipt-v1' as const
export const LLM_WIKI_INBOX_AUTOMATION_ID = 'therss-inbox-capture' as const
export const LLM_WIKI_INBOX_REQUIRED_SCOPES = [
  'Automation_Conversations',
  'Inbox',
  'log.md'
] as const

export type LlmWikiInboxStatus = LlmWikiPromotionStatus
export type LlmWikiInboxEvidenceTier = 'pending' | 'metadata-only' | 'partial'

const boundedIdSchema = z.string().trim().min(1).max(300)
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/u)
const nonPaperKindSchema = z.enum(['repository', 'article', 'model', 'dataset', 'post'])

export const llmWikiInboxPreviewRequestSchema = z
  .object({
    itemId: boundedIdSchema,
    sessionId: boundedIdSchema.optional()
  })
  .strict()

export const llmWikiInboxConfirmRequestSchema = z
  .object({
    previewId: llmWikiPromotionPreviewIdSchema
  })
  .strict()

export const llmWikiInboxPreviewSchema = z
  .object({
    version: z.literal(LLM_WIKI_INBOX_PREVIEW_VERSION),
    previewId: llmWikiPromotionPreviewIdSchema.nullable(),
    itemId: boundedIdSchema,
    source: z.string().trim().min(1).max(120),
    kind: nonPaperKindSchema,
    title: z.string().min(1).max(1_000),
    url: z.string().url().max(2_000),
    ready: z.boolean(),
    vaultLabel: z.literal('llm-wiki'),
    destination: z.literal('Inbox'),
    intendedPaths: z.array(llmWikiRelativePathSchema).max(16),
    evidenceBoundary: z.string().min(1).max(2_000),
    blockers: z.array(z.string().min(1).max(1_000)).max(16),
    sourceHash: hashSchema,
    contractHash: hashSchema,
    expiresAt: z.string().datetime()
  })
  .strict()
  .superRefine((preview, context) => {
    if (preview.ready) {
      if (!preview.previewId || preview.intendedPaths.length < 3) {
        context.addIssue({
          code: 'custom',
          message: 'A ready Inbox preview is missing write facts'
        })
      }
      if (preview.blockers.length > 0) {
        context.addIssue({
          code: 'custom',
          message: 'A ready Inbox preview cannot contain blockers'
        })
      }
      return
    }
    if (
      preview.previewId !== null ||
      preview.intendedPaths.length > 0 ||
      preview.blockers.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        message: 'A blocked Inbox preview has inconsistent state'
      })
    }
  })

export type LlmWikiInboxPreview = z.infer<typeof llmWikiInboxPreviewSchema>

export const llmWikiInboxReceiptSchema = z
  .object({
    version: z.literal(LLM_WIKI_INBOX_RECEIPT_VERSION),
    id: boundedIdSchema,
    itemId: boundedIdSchema,
    source: z.string().trim().min(1).max(120),
    kind: nonPaperKindSchema,
    status: z.enum(LLM_WIKI_PROMOTION_STATUSES),
    sourceHash: hashSchema,
    contractHash: hashSchema,
    evidenceTier: z.enum(['pending', 'metadata-only', 'partial']),
    summary: z.string().max(4_000),
    createdPaths: z.array(llmWikiRelativePathSchema).max(16),
    updatedPaths: z.array(llmWikiRelativePathSchema).max(16),
    notePath: llmWikiRelativePathSchema.nullable(),
    auditPath: llmWikiRelativePathSchema.nullable(),
    blockers: z.array(z.string().min(1).max(1_000)).max(16),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable()
  })
  .strict()
  .superRefine((receipt, context) => {
    if (receipt.status === 'running') {
      if (
        receipt.completedAt !== null ||
        receipt.evidenceTier !== 'pending' ||
        receipt.notePath !== null ||
        receipt.auditPath !== null ||
        receipt.createdPaths.length > 0 ||
        receipt.updatedPaths.length > 0
      ) {
        context.addIssue({ code: 'custom', message: 'A running Inbox receipt has terminal state' })
      }
      return
    }
    if (receipt.completedAt === null) {
      context.addIssue({ code: 'custom', message: 'A terminal Inbox receipt needs completedAt' })
    }
    if (receipt.status === 'completed') {
      if (
        receipt.evidenceTier !== 'metadata-only' ||
        receipt.notePath === null ||
        receipt.auditPath === null ||
        receipt.createdPaths.length === 0 ||
        receipt.updatedPaths.length === 0 ||
        receipt.blockers.length > 0
      ) {
        context.addIssue({
          code: 'custom',
          message: 'A completed Inbox receipt is missing required evidence'
        })
      }
    } else if (receipt.evidenceTier === 'metadata-only') {
      context.addIssue({
        code: 'custom',
        message: 'Only completed Inbox receipts record metadata-only verification'
      })
    }
  })

export type LlmWikiInboxReceipt = z.infer<typeof llmWikiInboxReceiptSchema>

import { z } from 'zod'
import { llmWikiArxivIdSchema } from './llmWikiLibrary'

const paperSchema = z
  .object({
    arxivId: llmWikiArxivIdSchema,
    title: z.string().trim().min(1).max(1000),
    priority: z.enum(['direct', 'adjacent', 'weak', 'unclassified']),
    score: z.number().int().min(0).max(10).nullable(),
    reason: z.string().trim().min(1).max(800).nullable(),
    canOpenNote: z.boolean()
  })
  .strict()

const editionSchema = z
  .object({
    date: z.iso.date(),
    selected: z.number().int().min(0).max(100),
    scanned: z.number().int().nonnegative().max(1_000_000).nullable(),
    papers: z.array(paperSchema).max(100)
  })
  .strict()
  .refine(
    ({ papers, selected }) =>
      papers.length === selected && new Set(papers.map(({ arxivId }) => arxivId)).size === selected,
    'The shortlist must match the recorded selection count without duplicate papers'
  )

export const llmWikiDailySnapshotSchema = z
  .object({
    requestedDate: z.iso.date(),
    checkedAt: z.iso.datetime(),
    status: z.enum(['completed', 'partial', 'no-source', 'no-results', 'missing', 'unavailable']),
    edition: editionSchema.nullable()
  })
  .strict()
  .refine(({ status, edition, requestedDate }) => {
    if (status === 'missing' || status === 'unavailable') return edition === null
    if (!edition || edition.date > requestedDate) return false
    if (status === 'completed') return edition.selected > 0
    if (status === 'no-results' || status === 'no-source') return edition.selected === 0
    return true
  }, 'Daily edition does not match its date or status')

export const llmWikiDailyOpenRequestSchema = z
  .object({ date: z.iso.date(), arxivId: llmWikiArxivIdSchema.optional() })
  .strict()

export type LlmWikiDailySnapshot = z.infer<typeof llmWikiDailySnapshotSchema>
export type LlmWikiDailyOpenRequest = z.infer<typeof llmWikiDailyOpenRequestSchema>
export type LlmWikiDailyPaper = z.infer<typeof paperSchema>

export function llmWikiDailyOriginalUrl(arxivId: string): string {
  return `https://arxiv.org/abs/${llmWikiArxivIdSchema.parse(arxivId)}`
}

export function llmWikiDailyPaperLabel(paper: LlmWikiDailyPaper): string {
  const priority = {
    direct: 'Direct',
    adjacent: 'Adjacent',
    weak: 'Weak',
    unclassified: 'Unclassified'
  }[paper.priority]
  return paper.score === null ? priority : `${priority} · ${paper.score}/10`
}

export function llmWikiDailyStatusText(snapshot: LlmWikiDailySnapshot): string {
  const { status, edition, requestedDate } = snapshot
  if (status === 'unavailable') return `Daily scan for ${requestedDate} could not be read.`
  if (status === 'missing')
    return `No daily edition found for ${requestedDate} or the prior 14 days.`
  if (!edition) return `Daily scan for ${requestedDate} could not be read.`
  const freshness =
    edition.date === requestedDate
      ? `Edition ${edition.date}`
      : `No edition for ${requestedDate} yet. Showing ${edition.date}`
  const outcome = {
    completed: 'Scan complete',
    partial: 'Scan incomplete',
    'no-source': 'Announcement batch unavailable to the scan',
    'no-results': 'Scan complete; no papers selected'
  }[status]
  const coverage = edition.scanned === null ? '' : ` · ${edition.scanned} screened`
  return `${freshness} · ${outcome} · ${edition.selected} selected${coverage}`
}

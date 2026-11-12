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

export const LLM_WIKI_DAILY_REFRESH_NOTE =
  'Refresh rereads the local scan result. It does not run the scan.'

export interface LlmWikiDailyEmptyState {
  readonly title: string
  readonly detail: string
}

/**
 * Why Daily Papers shows no shortlist, from the scan record only. `null` input is a failed read.
 * It returns `null` when the edition has papers. Callers do not call it while a read is pending.
 * TheRSS never infers why a batch was unavailable and never presents it as an absence of papers.
 */
export function llmWikiDailyEmptyState(
  snapshot: LlmWikiDailySnapshot | null
): LlmWikiDailyEmptyState | null {
  const state = (title: string, reason: string) => ({
    title,
    detail: `${reason} ${LLM_WIKI_DAILY_REFRESH_NOTE}`
  })
  if (!snapshot)
    return state('Daily Papers could not be loaded', 'TheRSS could not get the local scan result.')
  const { status, edition, requestedDate } = snapshot
  if (edition?.papers.length) return null
  const digest = 'Open the digest to see the scan record.'
  switch (status) {
    // The schema requires papers for `completed`; both read as a completed scan with none.
    case 'completed':
    case 'no-results':
      return state(
        'No papers selected',
        `The scan completed and selected no papers for this edition. ${digest}`
      )
    case 'no-source':
      return state(
        'Announcement batch unavailable to the scan',
        `The scan recorded that the arXiv announcement batch was not available to it. This does not show that no relevant papers were announced. ${digest}`
      )
    case 'partial':
      return state(
        'Scan incomplete; no papers selected',
        `The scan did not finish, so this empty shortlist can be incomplete. ${digest}`
      )
    case 'missing':
      return state(
        'No daily edition found',
        `The local llm-wiki vault has no Daily ArXiv Scan digest for ${requestedDate} or the prior 14 days. Daily Papers shows only scans that llm-wiki has already written.`
      )
    case 'unavailable':
      return state(
        'Daily scan could not be read',
        'The local llm-wiki vault or its latest digest could not be read safely. Check that the vault is available and the digest is intact.'
      )
  }
}

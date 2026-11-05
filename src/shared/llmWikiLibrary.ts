import { z } from 'zod'
import { llmWikiRelativePathSchema } from './llmWikiPromotion'

export const llmWikiArxivIdSchema = z
  .string()
  .max(40)
  .regex(/^\d{4}\.\d{4,5}(?:v[1-9]\d*)?$/u)
  .transform((id) => id.replace(/v\d+$/u, ''))
export const llmWikiStatusRequestSchema = z
  .object({ arxivId: llmWikiArxivIdSchema, refresh: z.boolean().optional() })
  .strict()
export const llmWikiLibraryStatusSchema = z
  .object({
    arxivId: llmWikiArxivIdSchema,
    status: z.enum(['not-found', 'recorded', 'note-missing', 'ambiguous', 'unavailable']),
    checkedAt: z.iso.datetime(),
    recordPath: llmWikiRelativePathSchema.nullable(),
    notePath: llmWikiRelativePathSchema.nullable(),
    level: z.enum(['L1', 'L2']).nullable(),
    readStatus: z.enum(['unread', 'reading', 'read']).nullable(),
    reason: z.string().max(500).nullable()
  })
  .strict()
export type LlmWikiStatusRequest = z.input<typeof llmWikiStatusRequestSchema>
export type LlmWikiLibraryStatus = z.infer<typeof llmWikiLibraryStatusSchema>

/** Derive identity from an official paper URL, never from its title or a guessed filename. */
export function llmWikiArxivId(item: {
  source: string
  kind?: string
  url: string
}): string | null {
  if (item.source !== 'arxiv' || (item.kind && item.kind !== 'paper')) return null
  try {
    const url = new URL(item.url)
    if (
      url.protocol !== 'https:' ||
      !['arxiv.org', 'www.arxiv.org'].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null
    const result = llmWikiArxivIdSchema.safeParse(/^\/abs\/([^/]+)\/?$/u.exec(url.pathname)?.[1])
    return result.success ? result.data : null
  } catch {
    return null
  }
}

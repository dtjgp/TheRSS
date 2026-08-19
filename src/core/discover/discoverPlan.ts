import { z } from 'zod'
import type { DiscoverPlan } from '../../shared/discover'

const MAX_PLAN_CHARACTERS = 20_000
const MAX_TERM_LENGTH = 100

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 31 || codePoint === 127
  })
}

function uniqueValues(values: readonly string[], lowercase: boolean): string[] {
  const seen = new Set<string>()
  return values.flatMap((value) => {
    const trimmed = value.trim()
    const key = trimmed.toLocaleLowerCase()
    if (seen.has(key)) return []
    seen.add(key)
    return [lowercase ? key : trimmed]
  })
}

function termSchema(pattern?: RegExp) {
  let schema = z
    .string()
    .trim()
    .min(1)
    .max(MAX_TERM_LENGTH)
    .refine((value) => !containsControlCharacter(value))
  if (pattern) schema = schema.refine((value) => pattern.test(value))
  return schema
}

function termList(
  maxItems: number,
  options: { readonly lowercase?: boolean; readonly pattern?: RegExp } = {}
) {
  return z
    .array(termSchema(options.pattern))
    .max(maxItems)
    .transform((values) => uniqueValues(values, options.lowercase ?? false))
}

const discoverPlanSchema = z
  .object({
    version: z.literal('discover-plan-v1'),
    intentSummary: z.string().trim().min(1).max(500),
    arxiv: z
      .object({
        categories: termList(6, {
          pattern: /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/u
        }),
        keywords: termList(8, { lowercase: true }),
        excludeKeywords: termList(6, { lowercase: true })
      })
      .strict(),
    github: z
      .object({
        keywords: termList(6, { lowercase: true }),
        topics: termList(6, {
          lowercase: true,
          pattern: /^[A-Za-z0-9][A-Za-z0-9-]{0,49}$/u
        }),
        languages: termList(6, {
          pattern: /^[\p{L}\p{N}+#. -]+$/u
        })
      })
      .strict(),
    rationale: z.string().trim().min(1).max(1_000)
  })
  .strict()
  .superRefine((plan, context) => {
    const positiveRules =
      plan.arxiv.categories.length +
      plan.arxiv.keywords.length +
      plan.github.keywords.length +
      plan.github.topics.length +
      plan.github.languages.length
    if (positiveRules === 0) {
      context.addIssue({ code: 'custom', message: 'At least one source rule is required' })
    }

    const githubQueries =
      plan.github.keywords.length + plan.github.topics.length + plan.github.languages.length
    if (githubQueries > 6) {
      context.addIssue({ code: 'custom', message: 'GitHub query fan-out exceeds six queries' })
    }
  })

function exactJsonPayload(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```json\s*\n([\s\S]*?)\n```$/u)
  return fenced?.[1] ?? trimmed
}

export function parseDiscoverPlan(raw: string): DiscoverPlan {
  if (raw.length > MAX_PLAN_CHARACTERS) {
    throw new Error('Discover planner returned an invalid search plan')
  }

  try {
    const payload = exactJsonPayload(raw)
    const parsed: unknown = JSON.parse(payload)
    return discoverPlanSchema.parse(parsed)
  } catch {
    throw new Error('Discover planner returned an invalid search plan')
  }
}

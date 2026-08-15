import { z } from 'zod'

const MAX_RULES_PER_FIELD = 50
const MAX_RULE_LENGTH = 100

function uniqueValues(values: readonly string[], lowercase: boolean): string[] {
  const normalized = values.map((value) => value.trim()).filter(Boolean)
  const seen = new Set<string>()

  return normalized.flatMap((value) => {
    const comparisonValue = value.toLocaleLowerCase()
    if (seen.has(comparisonValue)) {
      return []
    }

    seen.add(comparisonValue)
    return [lowercase ? comparisonValue : value]
  })
}

function stringListSchema(lowercase = false) {
  return z
    .array(z.string().trim().min(1).max(MAX_RULE_LENGTH))
    .max(MAX_RULES_PER_FIELD)
    .transform((values) => uniqueValues(values, lowercase))
}

export const arxivInterestSchema = z.object({
  categories: stringListSchema(),
  keywords: stringListSchema(true),
  excludeKeywords: stringListSchema(true)
})

export const githubInterestSchema = z.object({
  keywords: stringListSchema(true),
  topics: stringListSchema(true),
  languages: stringListSchema()
})

export const interestProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    arxiv: arxivInterestSchema,
    github: githubInterestSchema
  })
  .superRefine((profile, context) => {
    const ruleCount =
      profile.arxiv.categories.length +
      profile.arxiv.keywords.length +
      profile.github.keywords.length +
      profile.github.topics.length +
      profile.github.languages.length

    if (ruleCount === 0) {
      context.addIssue({
        code: 'custom',
        message: 'At least one arXiv or GitHub discovery rule is required'
      })
    }
  })

export type ArxivInterest = z.infer<typeof arxivInterestSchema>
export type GitHubInterest = z.infer<typeof githubInterestSchema>
export type InterestProfile = z.infer<typeof interestProfileSchema>

import { z } from 'zod'
import type { DiscoveryItem } from './discovery'

export const discoverRunnerSchema = z.enum(['model-provider', 'codex', 'claude'])
export const discoverSourceSchema = z.enum(['arxiv', 'github'])

export const discoverSearchRequestSchema = z
  .object({
    intent: z.string().trim().min(1).max(2_000),
    runner: discoverRunnerSchema,
    sources: z
      .array(discoverSourceSchema)
      .min(1)
      .max(2)
      .transform((sources) => [...new Set(sources)])
  })
  .strict()

export type DiscoverRunner = z.infer<typeof discoverRunnerSchema>
export type DiscoverSource = z.infer<typeof discoverSourceSchema>
export type DiscoverSearchRequest = z.infer<typeof discoverSearchRequestSchema>

export interface DiscoverPlan {
  readonly version: 'discover-plan-v1'
  readonly intentSummary: string
  readonly arxiv: {
    readonly categories: readonly string[]
    readonly keywords: readonly string[]
    readonly excludeKeywords: readonly string[]
  }
  readonly github: {
    readonly keywords: readonly string[]
    readonly topics: readonly string[]
    readonly languages: readonly string[]
  }
  readonly rationale: string
}

export interface DiscoverPlannerProvenance {
  readonly providerId: string
  readonly providerName: string
  readonly model: string
  readonly promptVersion: 'semantic-discover-v1'
  readonly inputHash: string
  readonly createdAt: string
}

export type DiscoverSourceStatus = 'not_searched' | 'healthy' | 'no_results' | 'failed'
export type DiscoverStatus = 'completed' | 'partial' | 'no_results' | 'failed'

export interface DiscoverSourceOutcome {
  readonly status: DiscoverSourceStatus
  readonly resultCount: number
  readonly error: string | null
}

export interface DiscoverResultItem extends DiscoveryItem {
  readonly score: number
  readonly reasons: readonly string[]
  readonly saved: boolean
}

export interface DiscoverSnapshot {
  readonly id: string
  readonly intent: string
  readonly runner: DiscoverRunner
  readonly status: DiscoverStatus
  readonly createdAt: string
  readonly plan: DiscoverPlan
  readonly provenance: DiscoverPlannerProvenance
  readonly sourceOutcomes: {
    readonly arxiv: DiscoverSourceOutcome
    readonly github: DiscoverSourceOutcome
  }
  readonly counts: {
    readonly total: number
    readonly arxiv: number
    readonly github: number
  }
  readonly items: readonly DiscoverResultItem[]
}

import { z } from 'zod'
import type { DiscoveryItem, DiscoveryItemKind, DiscoverySource } from './discovery'
import { ACTIVE_TODAY_SOURCE_IDS } from './sourceIdentity'

export const discoverRunnerSchema = z.enum(['model-provider', 'codex', 'claude'])
export const discoverRunIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9:_-]+$/u)
export const DISCOVER_SOURCE_IDS: readonly DiscoverySource[] = ACTIVE_TODAY_SOURCE_IDS
const discoverSourceValues = [...DISCOVER_SOURCE_IDS] as [DiscoverySource, ...DiscoverySource[]]
export const discoverSourceSchema = z.enum(discoverSourceValues)

export const discoverSearchRequestSchema = z
  .object({
    intent: z.string().trim().min(1).max(2_000),
    runner: discoverRunnerSchema,
    sources: z
      .array(discoverSourceSchema)
      .min(1)
      .max(DISCOVER_SOURCE_IDS.length)
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
  readonly promptVersion: 'semantic-discover-v1' | 'semantic-discover-v2'
  readonly personalizationApplied: boolean
  readonly inputHash: string
  readonly createdAt: string
}

export type DiscoverSourceStatus =
  'not_searched' | 'healthy' | 'partial' | 'no_results' | 'failed' | 'canceled'
export type DiscoverStatus = 'completed' | 'partial' | 'no_results' | 'failed' | 'canceled'

export interface DiscoverSourceOutcome {
  readonly status: DiscoverSourceStatus
  readonly resultCount: number
  readonly error: string | null
}

export interface DiscoverProgress {
  readonly phase: 'planning' | 'searching' | 'cancel_requested'
  readonly completedSources: number
  readonly totalSources: number
  readonly source: DiscoverSource | null
  readonly outcome: DiscoverSourceOutcome | null
}

export interface DiscoverRunProgress extends DiscoverProgress {
  readonly runId: string
}

export interface DiscoverCancellationReceipt {
  readonly runId: string
  readonly canceled: boolean
}

const discoverSourceOutcomeSchema = z
  .object({
    status: z.enum(['not_searched', 'healthy', 'partial', 'no_results', 'failed', 'canceled']),
    resultCount: z.number().int().min(0).max(100),
    error: z.string().max(500).nullable()
  })
  .strict()

const discoverProgressObjectSchema = z
  .object({
    phase: z.enum(['planning', 'searching', 'cancel_requested']),
    completedSources: z.number().int().min(0).max(DISCOVER_SOURCE_IDS.length),
    totalSources: z.number().int().min(1).max(DISCOVER_SOURCE_IDS.length),
    source: discoverSourceSchema.nullable(),
    outcome: discoverSourceOutcomeSchema.nullable()
  })
  .strict()

export const discoverRunProgressSchema = discoverProgressObjectSchema
  .extend({ runId: discoverRunIdSchema })
  .strict()
  .superRefine((progress, context) => {
    if (progress.completedSources > progress.totalSources) {
      context.addIssue({ code: 'custom', message: 'Completed sources exceed the run total' })
    }
    if ((progress.source === null) !== (progress.outcome === null)) {
      context.addIssue({ code: 'custom', message: 'Source progress requires a matching outcome' })
    }
  })

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
    readonly [Source in DiscoverSource]: DiscoverSourceOutcome
  }
  readonly counts: {
    readonly total: number
    readonly arxiv: number
    readonly github: number
    readonly byKind: Readonly<Record<DiscoveryItemKind, number>>
    readonly bySource: Readonly<Record<DiscoverSource, number>>
  }
  readonly items: readonly DiscoverResultItem[]
}

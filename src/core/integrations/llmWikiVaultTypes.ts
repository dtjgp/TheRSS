import { z } from 'zod'
import type { DiscoveryItem } from '../../shared/discovery'
import type { LlmWikiPromotionLevel } from '../../shared/llmWikiPromotion'

export const AUTOMATION_ID = 'therss-paper-promotion'
export const MAX_NOTE_BYTES = 500_000
export const MAX_KNOWLEDGE_PAGES = 500
export const TRUSTED_AUTOMATION_RUNTIME_SHA256 =
  'aa5b24060b0169010e165b5c392eb41c6f57fa97ec5bc39eed2d41762017366e'
export const REQUIRED_FILES = [
  'AGENTS.md',
  '_schema.md',
  'System/SOPs/ArXiv_Paper_Record_Pipeline.md',
  'System/Reference/Operations/Vault_Write_Governance.md',
  'System/Configs/Automation_Runtime_Scopes.json',
  'System/Scripts/automation_runtime.py',
  'Templates/Paper_Note_L1.md',
  'Templates/Paper_Note_L2.md',
  'Literature/Paper_Notes/Paper_Notes_Index.md',
  'index.md',
  'log.md'
] as const
export const MUTABLE_INDEX_PATHS = [
  'Literature/Paper_Notes/Paper_Notes_Index.md',
  'index.md',
  'log.md'
] as const

export const llmWikiPromotionAnalysisSchema = z
  .object({
    level: z.enum(['L1', 'L2']),
    routingRationale: z.string().trim().min(1).max(2_000),
    domain: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[\p{L}\p{N}_-]+$/u),
    shortIdentifier: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[A-Za-z0-9_]+$/u),
    relatedPaths: z
      .array(
        z
          .string()
          .max(512)
          .regex(/^(?:Topics|Methods)\/.+\.md$/u)
      )
      .min(1)
      .max(4)
      .refine((paths) => new Set(paths).size === paths.length, 'Related paths must be unique'),
    noteMarkdown: z.string().min(100).max(MAX_NOTE_BYTES)
  })
  .strict()

export type PromotionAnalysis = z.infer<typeof llmWikiPromotionAnalysisSchema>

export interface PdfInspection {
  readonly pageCount: number
  readonly byteSize: number
  readonly sha256: string
  readonly text: string
}

export interface VaultPreflight {
  readonly root: string
  readonly contractHash: string
  readonly contractContents: Readonly<Record<string, string>>
  readonly domains: Readonly<Record<LlmWikiPromotionLevel, readonly string[]>>
  readonly knowledgePaths: readonly string[]
}

export interface PromotionPaths {
  readonly pdf: string
  readonly sidecar: string
  readonly note: string
  readonly audit: string
}

export interface StagedPromotionHandle {
  readonly kind: 'therss-llm-wiki-staged-v1'
  readonly stageDirectory: string | null
  readonly stagedPdfPath: string | null
  readonly vaultRoot: string
  readonly sourceItem: DiscoveryItem | null
  readonly analysis: PromotionAnalysis | null
  readonly sidecarMarkdown: string | null
  readonly sidecarPreexisting: boolean
  readonly paths: {
    readonly pdf: string | null
    readonly sidecar: string | null
    readonly note: string | null
    readonly audit: string | null
  }
  readonly mutableHashes: Readonly<Record<string, string>>
  readonly preparedAt: string
}

export interface LlmWikiVaultAdapterOptions {
  readonly vaultRoot?: string
  readonly tempRoot?: string
  readonly trustedRuntimeHash?: string
  readonly now?: () => Date
  readonly idFactory?: () => string
  readonly codexAvailable: () => Promise<boolean>
  readonly fetchPdf: (url: string) => Promise<Buffer>
  readonly inspectPdf: (path: string) => Promise<PdfInspection>
  readonly runCodex: (request: {
    readonly prompt: string
    readonly stageDirectory: string
  }) => Promise<PromotionAnalysis>
  readonly runRuntime: (
    root: string,
    args: readonly string[],
    trustedRuntimeHash: string
  ) => Promise<{ readonly status: string; readonly error?: string }>
}

export interface LlmWikiVaultRuntime {
  readonly vaultRoot: string
  readonly tempRoot: string
  readonly trustedRuntimeHash: string
  readonly now: () => Date
  readonly idFactory: () => string
  readonly codexAvailable: LlmWikiVaultAdapterOptions['codexAvailable']
  readonly fetchPdf: LlmWikiVaultAdapterOptions['fetchPdf']
  readonly inspectPdf: LlmWikiVaultAdapterOptions['inspectPdf']
  readonly runCodex: LlmWikiVaultAdapterOptions['runCodex']
  readonly runRuntime: LlmWikiVaultAdapterOptions['runRuntime']
}

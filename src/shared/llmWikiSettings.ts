import { z } from 'zod'

export const LLM_WIKI_VAULT_PATH_MAX_LENGTH = 1_000

const HAS_UNSAFE_CHARACTER = /[\p{Cc}\p{Cf}]/u

function normalizeAbsolutePosixPath(value: string): string {
  const segments = value
    .trim()
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.')
  return segments.length === 0 ? '/' : `/${segments.join('/')}`
}

function isSafeAbsoluteVaultPath(value: string): boolean {
  if (HAS_UNSAFE_CHARACTER.test(value)) return false
  if (value.length > LLM_WIKI_VAULT_PATH_MAX_LENGTH) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  // POSIX absolute path (macOS/Linux); reject relative paths and explicit parent traversal segments.
  if (!trimmed.startsWith('/')) return false
  const segments = trimmed.split('/')
  if (segments.some((segment) => segment === '..')) return false
  // Reject spellings whose normalization exposes terminal whitespace so parsing is strictly idempotent.
  const normalized = normalizeAbsolutePosixPath(trimmed)
  return normalized === normalized.trim()
}

export const llmWikiVaultPathSchema = z
  .string()
  .refine(isSafeAbsoluteVaultPath, 'Vault folder must be a valid absolute path')
  .transform(normalizeAbsolutePosixPath)
  .nullable()

export const llmWikiVaultPathInputSchema = z
  .object({
    vaultPath: llmWikiVaultPathSchema
  })
  .strict()

export const llmWikiDiagnosticCheckSchema = z
  .object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(160),
    status: z.enum(['ok', 'warning', 'error']),
    detail: z.string().min(1).max(500),
    remediation: z.string().min(1).max(500).nullable()
  })
  .strict()

export const llmWikiVaultDiagnosticsSchema = z
  .object({
    resolvedPath: z.string().min(1).max(LLM_WIKI_VAULT_PATH_MAX_LENGTH),
    origin: z.enum(['env', 'custom', 'default']),
    customPath: llmWikiVaultPathSchema,
    defaultPath: z.string().min(1).max(LLM_WIKI_VAULT_PATH_MAX_LENGTH),
    envOverridePath: z.string().min(1).max(LLM_WIKI_VAULT_PATH_MAX_LENGTH).nullable(),
    status: z.enum(['ready', 'incomplete', 'unavailable']),
    checkedAt: z.iso.datetime(),
    checks: z.array(llmWikiDiagnosticCheckSchema).max(20)
  })
  .strict()

export const llmWikiFolderChoiceSchema = z
  .object({
    canceled: z.boolean(),
    path: llmWikiVaultPathSchema
  })
  .strict()

export type LlmWikiVaultOrigin = z.infer<typeof llmWikiVaultDiagnosticsSchema>['origin']
export type LlmWikiDiagnosticCheck = z.infer<typeof llmWikiDiagnosticCheckSchema>
export type LlmWikiVaultDiagnostics = z.infer<typeof llmWikiVaultDiagnosticsSchema>
export type LlmWikiFolderChoice = z.infer<typeof llmWikiFolderChoiceSchema>

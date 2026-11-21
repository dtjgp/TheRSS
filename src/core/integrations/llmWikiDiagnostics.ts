import { lstat, realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  LLM_WIKI_VAULT_PATH_MAX_LENGTH,
  llmWikiVaultDiagnosticsSchema,
  llmWikiVaultPathSchema,
  type LlmWikiDiagnosticCheck,
  type LlmWikiVaultDiagnostics,
  type LlmWikiVaultOrigin
} from '../../shared/llmWikiSettings'
import { validateSafeVaultRoot, type VaultRootFs } from './llmWikiVaultPaths'

const REQUIRED_FILES = ['AGENTS.md', '_schema.md'] as const
const PAPER_DIRECTORIES = ['raw/paper_records', 'Literature/Paper_Notes'] as const

export interface LlmWikiVaultLocation {
  readonly resolvedPath: string
  readonly origin: LlmWikiVaultOrigin
  readonly customPath: string | null
  readonly envOverridePath: string | null
  readonly defaultPath: string
}

export type LlmWikiDiagnosticsFs = VaultRootFs

export interface LlmWikiDiagnosticsOptions {
  /** Saved custom folder, or null when the user has not chosen one. */
  readonly customPath: string | null
  /** Raw THERSS_LLM_WIKI_PATH value. Callers pass it explicitly so tests stay deterministic. */
  readonly envPath: string | undefined
  readonly defaultPath?: string
  readonly now?: () => Date
  readonly fs?: LlmWikiDiagnosticsFs
}

const DEFAULT_FS: LlmWikiDiagnosticsFs = { lstat, realpath }

type PathState = 'ok' | 'missing' | 'symlink' | 'wrong-type' | 'unreadable'

export function defaultLlmWikiVaultPath(): string {
  return join(homedir(), 'Obsidian', 'llm-wiki')
}

const UNSAFE_DISPLAY_CHARACTERS = /[\p{Cc}\p{Cf}]/gu

interface ResolvedVaultState {
  readonly location: LlmWikiVaultLocation
  readonly operationalPath: string | null
}

function boundedDisplayEnvPath(raw: string): string {
  const cleaned = raw.replace(UNSAFE_DISPLAY_CHARACTERS, '').trim()
  return cleaned.slice(0, LLM_WIKI_VAULT_PATH_MAX_LENGTH) || '[invalid THERSS_LLM_WIKI_PATH]'
}

function resolveVaultState(input: {
  readonly customPath: string | null | undefined
  readonly envPath: string | undefined
  readonly defaultPath: string
}): ResolvedVaultState {
  const customPath = llmWikiVaultPathSchema.parse(input.customPath ?? null)
  const rawEnv = input.envPath
  if (rawEnv !== undefined && rawEnv.trim().length > 0) {
    const parsedEnv = llmWikiVaultPathSchema.safeParse(rawEnv)
    if (parsedEnv.success && parsedEnv.data !== null) {
      return {
        location: {
          resolvedPath: parsedEnv.data,
          origin: 'env',
          customPath,
          envOverridePath: parsedEnv.data,
          defaultPath: input.defaultPath
        },
        operationalPath: parsedEnv.data
      }
    }
    const display = boundedDisplayEnvPath(rawEnv)
    return {
      location: {
        resolvedPath: display,
        origin: 'env',
        customPath,
        envOverridePath: display,
        defaultPath: input.defaultPath
      },
      operationalPath: null
    }
  }
  const base = { customPath, envOverridePath: null, defaultPath: input.defaultPath }
  if (customPath) {
    return {
      location: { ...base, resolvedPath: customPath, origin: 'custom' },
      operationalPath: customPath
    }
  }
  const parsedDefault = llmWikiVaultPathSchema.safeParse(input.defaultPath)
  return {
    location: { ...base, resolvedPath: input.defaultPath, origin: 'default' },
    operationalPath: parsedDefault.success ? parsedDefault.data : null
  }
}

/** Precedence: a non-blank THERSS_LLM_WIKI_PATH, then the saved custom folder, then the default. */
export function resolveLlmWikiVaultLocation(input: {
  readonly customPath: string | null | undefined
  readonly envPath: string | undefined
  readonly defaultPath: string
}): LlmWikiVaultLocation {
  return resolveVaultState(input).location
}

/** Fail-closed operational root resolver for Library, Daily, and Promotion services. */
export function resolveOperationalLlmWikiVaultRoot(input: {
  readonly customPath: string | null | undefined
  readonly envPath: string | undefined
  readonly defaultPath: string
}): string {
  const { location, operationalPath } = resolveVaultState(input)
  if (!operationalPath) {
    throw new Error(
      location.origin === 'env'
        ? 'THERSS_LLM_WIKI_PATH is not a safe absolute folder path.'
        : 'The configured llm-wiki vault path is not a safe absolute folder path.'
    )
  }
  return operationalPath
}

function errorCode(error: unknown): string | null {
  return error && typeof error === 'object' && 'code' in error ? String(error.code) : null
}

/** Inspect one path below root with lstat only; every component must be a real directory. */
async function inspectPath(
  root: string,
  relativePath: string,
  expected: 'file' | 'directory',
  fsOps: LlmWikiDiagnosticsFs
): Promise<PathState> {
  const parts = relativePath.split('/')
  for (let index = 0; index < parts.length; index += 1) {
    let info
    try {
      info = await fsOps.lstat(join(root, ...parts.slice(0, index + 1)))
    } catch (error) {
      return errorCode(error) === 'ENOENT' ? 'missing' : 'unreadable'
    }
    if (info.isSymbolicLink()) return 'symlink'
    const leaf = index === parts.length - 1
    const kindMatches = leaf && expected === 'file' ? info.isFile() : info.isDirectory()
    if (!kindMatches) return 'wrong-type'
  }
  return 'ok'
}

const STATE_LABELS: Record<Exclude<PathState, 'ok'>, string> = {
  missing: 'Missing',
  symlink: 'Symbolic link (not followed)',
  'wrong-type': 'Wrong item type',
  unreadable: 'Cannot be read'
}

function describeProblems(states: readonly (readonly [string, PathState])[]): string | null {
  const problems = states.filter(([, state]) => state !== 'ok')
  if (problems.length === 0) return null
  return problems
    .map(([path, state]) => `${STATE_LABELS[state as Exclude<PathState, 'ok'>]}: ${path}.`)
    .join(' ')
}

function rootRemediation(origin: LlmWikiVaultOrigin): string {
  return origin === 'env'
    ? 'Set THERSS_LLM_WIKI_PATH to an existing llm-wiki folder, or unset it and restart TheRSS.'
    : 'Use Choose folder… to select an existing llm-wiki vault, or use the default folder.'
}

async function checkRoot(
  location: LlmWikiVaultLocation,
  operationalPath: string | null,
  fsOps: LlmWikiDiagnosticsFs
): Promise<{ check: LlmWikiDiagnosticCheck; realRoot: string | null }> {
  const fail = (detail: string, remediation = rootRemediation(location.origin)) => ({
    check: {
      id: 'vault-root',
      label: 'Vault folder',
      status: 'error' as const,
      detail,
      remediation
    },
    realRoot: null
  })
  if (!operationalPath) {
    return fail(
      location.origin === 'env'
        ? 'THERSS_LLM_WIKI_PATH is not a safe absolute folder path. TheRSS did not open it.'
        : 'The configured vault path is not a safe absolute folder path. TheRSS did not open it.'
    )
  }
  const validated = await validateSafeVaultRoot(operationalPath, fsOps)
  if (!validated.ok) {
    if (validated.reason === 'invalid-path') {
      return fail(
        location.origin === 'env'
          ? 'THERSS_LLM_WIKI_PATH is not a safe absolute folder path. TheRSS did not open it.'
          : 'The configured vault path is not a safe absolute folder path. TheRSS did not open it.'
      )
    }
    if (validated.reason === 'missing') return fail('The vault folder does not exist.')
    if (validated.reason === 'unreadable') {
      return fail('The vault folder cannot be read.', 'Check the folder permissions, then recheck.')
    }
    if (validated.reason === 'symlink') {
      return fail(
        'The vault folder path contains a symbolic link. TheRSS does not follow vault symlinks.',
        'Choose the real vault folder instead of the link.'
      )
    }
    return fail(
      validated.reason === 'not-directory'
        ? 'The vault path is not a folder.'
        : 'The vault folder path is not a valid directory.'
    )
  }
  return {
    check: {
      id: 'vault-root',
      label: 'Vault folder',
      status: 'ok',
      detail: 'The folder exists and is a regular directory.',
      remediation: null
    },
    realRoot: validated.root
  }
}

async function checkGroup(
  root: string,
  paths: readonly string[],
  expected: 'file' | 'directory',
  text: { id: string; label: string; ok: string; remediation: string },
  fsOps: LlmWikiDiagnosticsFs
): Promise<LlmWikiDiagnosticCheck> {
  const states = await Promise.all(
    paths.map(async (path) => [path, await inspectPath(root, path, expected, fsOps)] as const)
  )
  const problems = describeProblems(states)
  return {
    id: text.id,
    label: text.label,
    status: problems ? 'error' : 'ok',
    detail: problems ?? text.ok,
    remediation: problems ? text.remediation : null
  }
}

/** Read-only vault check for Settings. It never creates, changes, or follows vault paths. */
export async function diagnoseLlmWikiVault(
  options: LlmWikiDiagnosticsOptions
): Promise<LlmWikiVaultDiagnostics> {
  const now = options.now ?? (() => new Date())
  const fsOps = options.fs ?? DEFAULT_FS
  const { location, operationalPath } = resolveVaultState({
    customPath: options.customPath,
    envPath: options.envPath,
    defaultPath: options.defaultPath ?? defaultLlmWikiVaultPath()
  })
  const checks: LlmWikiDiagnosticCheck[] = []
  if (location.origin === 'env' && location.customPath) {
    checks.push({
      id: 'env-override',
      label: 'Environment override',
      status: 'warning',
      detail: 'THERSS_LLM_WIKI_PATH overrides the saved folder.',
      remediation: 'Unset THERSS_LLM_WIKI_PATH and restart TheRSS to use the saved folder.'
    })
  }
  const { check: rootCheck, realRoot } = await checkRoot(location, operationalPath, fsOps)
  checks.unshift(rootCheck)
  if (realRoot) {
    checks.push(
      await checkGroup(
        realRoot,
        REQUIRED_FILES,
        'file',
        {
          id: 'required-files',
          label: 'Vault rules files',
          ok: 'AGENTS.md and _schema.md are present.',
          remediation:
            'Choose the llm-wiki vault folder that contains AGENTS.md and _schema.md. TheRSS does not create them.'
        },
        fsOps
      ),
      await checkGroup(
        realRoot,
        PAPER_DIRECTORIES,
        'directory',
        {
          id: 'paper-directories',
          label: 'Paper folders',
          ok: 'raw/paper_records and Literature/Paper_Notes are present.',
          remediation:
            'Create the missing folders in the vault, or choose the vault that contains them. TheRSS does not create them.'
        },
        fsOps
      )
    )
  }
  const status = !realRoot
    ? 'unavailable'
    : checks.some((check) => check.status === 'error')
      ? 'incomplete'
      : 'ready'
  return llmWikiVaultDiagnosticsSchema.parse({
    ...location,
    status,
    checkedAt: now().toISOString(),
    checks
  })
}

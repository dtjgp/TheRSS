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

const REQUIRED_FILES = ['AGENTS.md', '_schema.md'] as const
const PAPER_DIRECTORIES = ['raw/paper_records', 'Literature/Paper_Notes'] as const

export interface LlmWikiVaultLocation {
  readonly resolvedPath: string
  readonly origin: LlmWikiVaultOrigin
  readonly customPath: string | null
  readonly envOverridePath: string | null
  readonly defaultPath: string
}

export interface LlmWikiDiagnosticsOptions {
  /** Saved custom folder, or null when the user has not chosen one. */
  readonly customPath: string | null
  /** Raw THERSS_LLM_WIKI_PATH value. Callers pass it explicitly so tests stay deterministic. */
  readonly envPath: string | undefined
  readonly defaultPath?: string
  readonly now?: () => Date
}

type PathState = 'ok' | 'missing' | 'symlink' | 'wrong-type' | 'unreadable'

export function defaultLlmWikiVaultPath(): string {
  return join(homedir(), 'Obsidian', 'llm-wiki')
}

/** Precedence: a non-blank THERSS_LLM_WIKI_PATH, then the saved custom folder, then the default. */
export function resolveLlmWikiVaultLocation(input: {
  readonly customPath: string | null | undefined
  readonly envPath: string | undefined
  readonly defaultPath: string
}): LlmWikiVaultLocation {
  const customPath = llmWikiVaultPathSchema.parse(input.customPath ?? null)
  const envPath = input.envPath?.trim()
  const envOverridePath = envPath ? envPath.slice(0, LLM_WIKI_VAULT_PATH_MAX_LENGTH) : null
  const base = { customPath, envOverridePath, defaultPath: input.defaultPath }
  if (envOverridePath) return { ...base, resolvedPath: envOverridePath, origin: 'env' }
  if (customPath) return { ...base, resolvedPath: customPath, origin: 'custom' }
  return { ...base, resolvedPath: input.defaultPath, origin: 'default' }
}

function errorCode(error: unknown): string | null {
  return error && typeof error === 'object' && 'code' in error ? String(error.code) : null
}

/** Inspect one path below root with lstat only; every component must be a real directory. */
async function inspectPath(
  root: string,
  relativePath: string,
  expected: 'file' | 'directory'
): Promise<PathState> {
  const parts = relativePath.split('/')
  for (let index = 0; index < parts.length; index += 1) {
    let info
    try {
      info = await lstat(join(root, ...parts.slice(0, index + 1)))
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
  location: LlmWikiVaultLocation
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
  if (
    location.origin === 'env' &&
    !llmWikiVaultPathSchema.safeParse(location.resolvedPath).success
  ) {
    return fail('THERSS_LLM_WIKI_PATH is not a safe absolute folder path. TheRSS did not open it.')
  }
  let info
  try {
    info = await lstat(location.resolvedPath)
  } catch (error) {
    return errorCode(error) === 'ENOENT'
      ? fail('The vault folder does not exist.')
      : fail('The vault folder cannot be read.', 'Check the folder permissions, then recheck.')
  }
  if (info.isSymbolicLink()) {
    return fail(
      'The vault folder is a symbolic link. TheRSS does not follow vault symlinks.',
      'Choose the real vault folder instead of the link.'
    )
  }
  if (!info.isDirectory()) return fail('The vault path is not a folder.')
  return {
    check: {
      id: 'vault-root',
      label: 'Vault folder',
      status: 'ok',
      detail: 'The folder exists and is a regular directory.',
      remediation: null
    },
    realRoot: await realpath(location.resolvedPath)
  }
}

async function checkGroup(
  root: string,
  paths: readonly string[],
  expected: 'file' | 'directory',
  text: { id: string; label: string; ok: string; remediation: string }
): Promise<LlmWikiDiagnosticCheck> {
  const states = await Promise.all(
    paths.map(async (path) => [path, await inspectPath(root, path, expected)] as const)
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
  const location = resolveLlmWikiVaultLocation({
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
  const { check: rootCheck, realRoot } = await checkRoot(location)
  checks.unshift(rootCheck)
  if (realRoot) {
    checks.push(
      await checkGroup(realRoot, REQUIRED_FILES, 'file', {
        id: 'required-files',
        label: 'Vault rules files',
        ok: 'AGENTS.md and _schema.md are present.',
        remediation:
          'Choose the llm-wiki vault folder that contains AGENTS.md and _schema.md. TheRSS does not create them.'
      }),
      await checkGroup(realRoot, PAPER_DIRECTORIES, 'directory', {
        id: 'paper-directories',
        label: 'Paper folders',
        ok: 'raw/paper_records and Literature/Paper_Notes are present.',
        remediation:
          'Create the missing folders in the vault, or choose the vault that contains them. TheRSS does not create them.'
      })
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

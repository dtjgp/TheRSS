import { createHash } from 'node:crypto'
import { lstat, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import type { DiscoveryItem } from '../../shared/discovery'
import type { LlmWikiPromotionLevel } from '../../shared/llmWikiPromotion'
import { llmWikiVaultPathSchema } from '../../shared/llmWikiSettings'
import type { PreparedLlmWikiPromotion } from './llmWikiPromotionService'
import {
  AUTOMATION_ID,
  MAX_KNOWLEDGE_PAGES,
  MUTABLE_INDEX_PATHS,
  REQUIRED_FILES,
  type PromotionAnalysis,
  type PromotionPaths,
  type StagedPromotionHandle,
  type VaultPreflight
} from './llmWikiVaultTypes'

/** Path, symlink, file-safety, preflight, and staged-handle helpers for llm-wiki promotion. */

/**
 * Resolve the vault root on each use: a dynamic resolver wins, then the static option, then
 * THERSS_LLM_WIKI_PATH and the default folder captured once at construction (legacy behavior).
 */
export function vaultRootResolver(options: {
  readonly vaultRoot?: string | undefined
  readonly resolveVaultRoot?: (() => string) | undefined
}): () => string {
  if (options.resolveVaultRoot) return options.resolveVaultRoot
  const fallback =
    options.vaultRoot ?? process.env.THERSS_LLM_WIKI_PATH ?? join(homedir(), 'Obsidian', 'llm-wiki')
  return () => fallback
}
export function hashText(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

export function safeFilenamePart(value: string, fallback: string, maxLength: number): string {
  const normalized = value
    .normalize('NFKC')
    .replaceAll(/[/\\:]/gu, ' ')
    .split('')
    .map((character) => {
      const code = character.charCodeAt(0)
      return code <= 31 || code === 127 ? ' ' : character
    })
    .join('')
    .replace(/[<>"|?*]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/[. ]+$/gu, '')
  return (normalized || fallback).slice(0, maxLength).trim() || fallback
}

function authorLastName(item: DiscoveryItem): string {
  const firstAuthor = item.authors[0]?.trim() ?? ''
  const candidate = firstAuthor.split(/\s+/u).at(-1) ?? ''
  return safeFilenamePart(candidate, 'Unknown', 60).replace(/\s+/gu, '_')
}

function publishedYear(item: DiscoveryItem): string {
  const year = /^\d{4}/u.exec(item.publishedAt)?.[0]
  if (!year) throw new Error('The paper has no valid publication year')
  return year
}

export function assertInsideRoot(root: string, path: string): void {
  const resolvedRoot = resolve(root)
  const resolvedPath = resolve(path)
  const pathFromRoot = relative(resolvedRoot, resolvedPath)
  if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
    throw new Error('A promotion target resolved outside llm-wiki')
  }
}

export async function readRegularFile(root: string, relativePath: string): Promise<string> {
  await assertSafePathChain(root, relativePath, 'file')
  return readFile(join(root, relativePath), 'utf8')
}

export interface VaultRootFs {
  readonly lstat: (
    path: string
  ) => Promise<{ isSymbolicLink(): boolean; isDirectory(): boolean; isFile(): boolean }>
  readonly realpath: (path: string) => Promise<string>
}

export type VaultRootValidationFailure =
  'invalid-path' | 'missing' | 'unreadable' | 'symlink' | 'not-directory' | 'parent-not-directory'

export type VaultRootValidation =
  | { readonly ok: true; readonly root: string }
  | { readonly ok: false; readonly reason: VaultRootValidationFailure }

const DEFAULT_VAULT_ROOT_FS: VaultRootFs = { lstat, realpath }

function fsErrorCode(error: unknown): string | null {
  return error && typeof error === 'object' && 'code' in error ? String(error.code) : null
}

/**
 * Single validated-root policy shared by diagnostics, Library, Daily, and Promotion preflight.
 * Rejects unsafe syntax, checks every ancestor component with lstat (no symlinks), and verifies
 * realpath matches the lexically normalized path.
 */
export async function validateSafeVaultRoot(
  configuredRoot: string,
  fsOps: VaultRootFs = DEFAULT_VAULT_ROOT_FS
): Promise<VaultRootValidation> {
  const parsed = llmWikiVaultPathSchema.safeParse(configuredRoot)
  if (!parsed.success || !parsed.data) return { ok: false, reason: 'invalid-path' }
  const normalized = parsed.data
  const parts = normalized.split('/').filter(Boolean)
  const prefixes =
    parts.length === 0 ? ['/'] : parts.map((_, index) => `/${parts.slice(0, index + 1).join('/')}`)
  for (let index = 0; index < prefixes.length; index += 1) {
    let info
    try {
      info = await fsOps.lstat(prefixes[index]!)
    } catch (error) {
      return { ok: false, reason: fsErrorCode(error) === 'ENOENT' ? 'missing' : 'unreadable' }
    }
    if (info.isSymbolicLink()) return { ok: false, reason: 'symlink' }
    if (!info.isDirectory()) {
      return {
        ok: false,
        reason: index === prefixes.length - 1 ? 'not-directory' : 'parent-not-directory'
      }
    }
  }
  let realRoot: string
  try {
    realRoot = await fsOps.realpath(normalized)
  } catch (error) {
    return { ok: false, reason: fsErrorCode(error) === 'ENOENT' ? 'missing' : 'unreadable' }
  }
  if (realRoot !== normalized) return { ok: false, reason: 'symlink' }
  return { ok: true, root: normalized }
}

/** Operational helper that throws when the configured vault root violates the shared policy. */
export async function assertSafeVaultRoot(
  configuredRoot: string,
  fsOps: VaultRootFs = DEFAULT_VAULT_ROOT_FS
): Promise<string> {
  const result = await validateSafeVaultRoot(configuredRoot, fsOps)
  if (!result.ok) {
    throw new Error(`Unsafe llm-wiki vault root (${result.reason})`)
  }
  return result.root
}

export async function assertSafePathChain(
  root: string,
  relativePath: string,
  expectedLeaf: 'file' | 'directory'
): Promise<void> {
  const target = join(root, relativePath)
  assertInsideRoot(root, target)
  const parts = relativePath.split('/').filter(Boolean)
  for (let index = 0; index < parts.length; index += 1) {
    const current = join(root, ...parts.slice(0, index + 1))
    const info = await lstat(current)
    if (info.isSymbolicLink()) throw new Error(`Unsafe llm-wiki symlink: ${relativePath}`)
    const isLeaf = index === parts.length - 1
    if (!isLeaf && !info.isDirectory()) {
      throw new Error(`Unsafe llm-wiki path component: ${relativePath}`)
    }
    if (isLeaf && expectedLeaf === 'file' && !info.isFile()) {
      throw new Error(`Expected a regular llm-wiki file: ${relativePath}`)
    }
    if (isLeaf && expectedLeaf === 'directory' && !info.isDirectory()) {
      throw new Error(`Expected a regular llm-wiki directory: ${relativePath}`)
    }
  }
}

export async function assertSafeParentDirectory(root: string, targetPath: string): Promise<void> {
  assertInsideRoot(root, targetPath)
  const parentFromRoot = relative(root, dirname(targetPath)).split('\\').join('/')
  await assertSafePathChain(root, parentFromRoot, 'directory')
}

export async function existingSidecarForArxiv(
  root: string,
  arxivId: string
): Promise<{ readonly path: string; readonly content: string } | null> {
  const sidecarRoot = join(root, 'raw', 'paper_records')
  const entries = await readdir(sidecarRoot, { withFileTypes: true })
  if (entries.length > 5_000) throw new Error('The llm-wiki paper-record directory is too large')
  const marker = new RegExp(`^arxiv_id:\\s*["']?${arxivId.replace('.', '\\.')}["']?\\s*$`, 'mu')
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith('.md')) continue
    const relativePath = `raw/paper_records/${entry.name}`
    const content = await readRegularFile(root, relativePath)
    if (marker.test(content)) return { path: relativePath, content }
  }
  return null
}

async function listDomains(root: string, level: LlmWikiPromotionLevel): Promise<string[]> {
  const relativePath =
    level === 'L1' ? 'Literature/Paper_Notes/L1_Deep_Read' : 'Literature/Paper_Notes/L2_Structured'
  const directory = join(root, relativePath)
  const entries = await readdir(directory, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => entry.name)
    .filter((name) => /^[\p{L}\p{N}_-]+$/u.test(name))
    .sort()
}

async function listKnowledgePaths(root: string): Promise<string[]> {
  const found: string[] = []
  const visit = async (relativeDirectory: string): Promise<void> => {
    await assertSafePathChain(root, relativeDirectory, 'directory')
    const entries = await readdir(join(root, relativeDirectory), { withFileTypes: true })
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.isSymbolicLink()) continue
      const relativePath = `${relativeDirectory}/${entry.name}`
      if (entry.isDirectory()) await visit(relativePath)
      else if (entry.isFile() && entry.name.endsWith('.md')) found.push(relativePath)
      if (found.length > MAX_KNOWLEDGE_PAGES) {
        throw new Error('The llm-wiki Topic/Method catalog is too large')
      }
    }
  }
  await visit('Topics')
  return found
}

function parseRuntimeScope(value: string): readonly string[] | null {
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || !('automations' in parsed)) return null
  const automations = (parsed as { automations?: unknown }).automations
  if (!automations || typeof automations !== 'object' || !(AUTOMATION_ID in automations)) {
    return null
  }
  const contract = (automations as Record<string, unknown>)[AUTOMATION_ID]
  if (!contract || typeof contract !== 'object' || !('lock_scopes' in contract)) return null
  const scopes = (contract as { lock_scopes?: unknown }).lock_scopes
  return Array.isArray(scopes) && scopes.every((scope) => typeof scope === 'string') ? scopes : null
}

export async function preflightVault(
  configuredRoot: string,
  trustedRuntimeHash: string
): Promise<VaultPreflight> {
  const root = await assertSafeVaultRoot(configuredRoot)
  const entries = await Promise.all(
    REQUIRED_FILES.map(async (path) => [path, await readRegularFile(root, path)] as const)
  )
  const contractContents = Object.fromEntries(entries)
  const runtimeConfig = contractContents['System/Configs/Automation_Runtime_Scopes.json']
  if (runtimeConfig === undefined) throw new Error('The llm-wiki runtime config is unavailable')
  const scopes = parseRuntimeScope(runtimeConfig)
  const requiredScopes = [
    'Automation_Conversations',
    'Literature/Paper_Notes',
    'Topics',
    'raw/papers',
    'raw/paper_records',
    'log.md'
  ]
  if (!scopes || requiredScopes.some((scope) => !scopes.includes(scope))) {
    throw new Error('The llm-wiki writer scope is not registered for TheRSS promotion')
  }
  const domains = {
    L1: await listDomains(root, 'L1'),
    L2: await listDomains(root, 'L2')
  }
  if (domains.L1.length === 0 || domains.L2.length === 0) {
    throw new Error('The llm-wiki L1/L2 routing directories are unavailable')
  }
  if (
    hashText(contractContents['System/Scripts/automation_runtime.py'] ?? '') !== trustedRuntimeHash
  ) {
    throw new Error('The llm-wiki automation runtime does not match the trusted app baseline')
  }
  const knowledgePaths = await listKnowledgePaths(root)
  if (knowledgePaths.length === 0) throw new Error('The llm-wiki Topic/Method catalog is empty')
  return {
    root,
    contractHash: hashText(
      entries.map(([path, content]) => `${path}\n${hashText(content)}`).join('\n')
    ),
    contractContents,
    domains,
    knowledgePaths
  }
}

export function buildPaths(
  item: DiscoveryItem,
  analysis: PromotionAnalysis,
  timestamp: Date
): PromotionPaths {
  const author = authorLastName(item)
  const year = publishedYear(item)
  const basenameValue = archiveBasename(item)
  const noteRoot =
    analysis.level === 'L1'
      ? 'Literature/Paper_Notes/L1_Deep_Read'
      : 'Literature/Paper_Notes/L2_Structured'
  const compactTimestamp = timestamp
    .toISOString()
    .replace(/[-:]/gu, '')
    .replace(/\.\d{3}Z$/u, 'Z')
  return {
    pdf: `raw/papers/${basenameValue}.pdf`,
    sidecar: `raw/paper_records/${basenameValue}.md`,
    note: `${noteRoot}/${analysis.domain}/${author}_${year}_${analysis.shortIdentifier}.md`,
    audit: `Automation_Conversations/${romeDate(timestamp.toISOString())}__${AUTOMATION_ID}__${compactTimestamp}.md`
  }
}

export function archiveBasename(item: DiscoveryItem): string {
  const author = authorLastName(item)
  const year = publishedYear(item)
  const title = safeFilenamePart(item.title, item.externalId, 140)
  return `${author} et al. - ${year} - ${title}`
}

export async function atomicReplace(path: string, content: string, token: string): Promise<void> {
  const temporary = join(dirname(path), `.${basename(path)}.${token}.tmp`)
  await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' })
  try {
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

export function romeTimestamp(value: string): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '00'
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}:${part('second')} Europe/Rome`
}

export function romeDate(value: string): string {
  return romeTimestamp(value).slice(0, 10)
}

export function handleFrom(prepared: PreparedLlmWikiPromotion): StagedPromotionHandle {
  const handle = prepared.opaqueHandle
  if (
    !handle ||
    typeof handle !== 'object' ||
    !('kind' in handle) ||
    handle.kind !== 'therss-llm-wiki-staged-v1'
  ) {
    throw new Error('Invalid llm-wiki promotion handle')
  }
  return handle as StagedPromotionHandle
}

function mutablePaths(handle: StagedPromotionHandle): readonly string[] {
  return [
    ...(handle.sidecarPreexisting && handle.paths.sidecar ? [handle.paths.sidecar] : []),
    ...(handle.analysis?.relatedPaths ?? []),
    ...MUTABLE_INDEX_PATHS
  ]
}

export async function revalidateMutableFiles(
  preflight: VaultPreflight,
  handle: StagedPromotionHandle
): Promise<Map<string, string>> {
  const contents = new Map<string, string>()
  for (const path of mutablePaths(handle)) {
    const content = await readRegularFile(preflight.root, path)
    if (hashText(content) !== handle.mutableHashes[path]) {
      throw new Error(`The llm-wiki file changed after preview: ${path}`)
    }
    contents.set(path, content)
  }
  return contents
}

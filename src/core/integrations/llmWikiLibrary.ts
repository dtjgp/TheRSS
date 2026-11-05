import { constants } from 'node:fs'
import { lstat, open, readdir, realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  llmWikiArxivIdSchema,
  llmWikiLibraryStatusSchema,
  llmWikiStatusRequestSchema,
  type LlmWikiLibraryStatus,
  type LlmWikiStatusRequest
} from '../../shared/llmWikiLibrary'
import { isSafeLlmWikiRelativePath } from '../../shared/llmWikiPromotion'
import { assertSafePathChain } from './llmWikiVaultSupport'

const MAX_FILES = 5_000
const HEADER_BYTES = 16_384
const NOTE_PREFIX = /^Literature\/Paper_Notes\/(?:L1_Deep_Read|L2_Structured)\/.+\.md$/u
type Entry = { id: string; path: string; fields: Record<string, string | null>; note: boolean }
type Scan = { root: string; entries: Entry[]; checkedAt: string; incomplete: boolean }

function scalar(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'null' || trimmed === '~') return null
  if (trimmed.length > 512) throw new Error('Oversized metadata')
  if (trimmed.startsWith('"')) return JSON.parse(trimmed) as string
  if (trimmed.startsWith("'") && trimmed.endsWith("'"))
    return trimmed.slice(1, -1).replaceAll("''", "'")
  return trimmed
}

async function header(root: string, path: string): Promise<Record<string, string | null>> {
  await assertSafePathChain(root, path, 'file')
  const file = await open(join(root, path), constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    if (!(await file.stat()).isFile()) throw new Error('Not a file')
    const bytes = Buffer.alloc(HEADER_BYTES)
    const { bytesRead } = await file.read(bytes, 0, bytes.length, 0)
    const text = bytes.subarray(0, bytesRead).toString('utf8').replaceAll('\r\n', '\n')
    const match = /^---\n([\s\S]*?)\n---(?:\n|$)/u.exec(text)
    if (!match) throw new Error('Missing bounded frontmatter')
    const fields: Record<string, string | null> = {}
    for (const line of match[1]!.split('\n')) {
      const entry = /^(arxiv_id|paper_note|level|status):[ \t]*(.*)$/u.exec(line)
      if (!entry) continue
      if (entry[1]! in fields) throw new Error('Duplicate metadata field')
      fields[entry[1]!] = scalar(entry[2]!)
    }
    return fields
  } finally {
    await file.close()
  }
}

function linkedNote(value: string): string {
  const path =
    value.startsWith('[[') && value.endsWith(']]') ? value.slice(2, -2).split('|')[0]! : value
  const withExtension = path.endsWith('.md') ? path : `${path}.md`
  if (!isSafeLlmWikiRelativePath(withExtension) || !NOTE_PREFIX.test(withExtension))
    throw new Error('Unsafe linked note')
  return withExtension
}

/** Read-only, bounded metadata cache. It neither indexes note bodies nor owns durable vault state. */
export class LlmWikiLibrary {
  private readonly root: string
  private readonly now: () => Date
  private cached: Scan | undefined
  private pending: Promise<Scan> | undefined
  constructor(
    private readonly options: {
      vaultRoot?: string
      openExternal: (url: string) => Promise<void>
      now?: () => Date
    }
  ) {
    this.root =
      options.vaultRoot ??
      process.env.THERSS_LLM_WIKI_PATH ??
      join(homedir(), 'Obsidian', 'llm-wiki')
    this.now = options.now ?? (() => new Date())
  }
  async status(candidate: LlmWikiStatusRequest): Promise<LlmWikiLibraryStatus> {
    const request = llmWikiStatusRequestSchema.parse(candidate)
    const base: LlmWikiLibraryStatus = {
      arxivId: request.arxivId,
      status: 'unavailable',
      checkedAt: this.now().toISOString(),
      recordPath: null,
      notePath: null,
      level: null,
      readStatus: null,
      reason: null
    }
    try {
      const scan = await this.scan(request.refresh ?? false)
      base.checkedAt = scan.checkedAt
      const matching = scan.entries.filter((entry) => entry.id === request.arxivId)
      const records = matching.filter((entry) => !entry.note)
      const notes = matching.filter((entry) => entry.note)
      if (records.length > 1 || notes.length > 1)
        return {
          ...base,
          status: 'ambiguous',
          reason: 'Multiple llm-wiki records match this arXiv ID.'
        }
      const record = records[0]
      const explicit = record?.fields.paper_note
      const notePath = explicit ? linkedNote(explicit) : (notes[0]?.path ?? null)
      if (!record && !notePath)
        return {
          ...base,
          status: scan.incomplete ? 'unavailable' : 'not-found',
          reason: scan.incomplete
            ? 'Some paper metadata could not be checked. Recheck the local vault.'
            : null
        }
      base.recordPath = record?.path ?? null
      base.notePath = notePath
      if (notePath) {
        let fields: Record<string, string | null>
        try {
          fields = await header(scan.root, notePath)
        } catch (error) {
          if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
            return {
              ...base,
              status: 'note-missing',
              reason: 'The linked paper note is missing. TheRSS has not changed it.'
            }
          throw error
        }
        const noteId = fields.arxiv_id ? llmWikiArxivIdSchema.parse(fields.arxiv_id) : null
        if (noteId && noteId !== request.arxivId) throw new Error('Conflicting note identity')
        base.level = notePath.includes('/L1_Deep_Read/') ? 'L1' : 'L2'
        base.readStatus = ['unread', 'reading', 'read'].includes(fields.status ?? '')
          ? (fields.status as LlmWikiLibraryStatus['readStatus'])
          : null
      }
      return llmWikiLibraryStatusSchema.parse({ ...base, status: 'recorded' })
    } catch {
      return {
        ...base,
        status: 'unavailable',
        recordPath: null,
        notePath: null,
        reason: 'llm-wiki paper metadata is unavailable or unsafe. Recheck the local vault.'
      }
    }
  }
  async open(candidate: string): Promise<{ opened: true }> {
    const arxivId = llmWikiArxivIdSchema.parse(candidate)
    const status = await this.status({ arxivId, refresh: true })
    if (status.status !== 'recorded')
      throw new Error(status.reason ?? `The llm-wiki record is ${status.status}.`)
    const path = status.notePath ?? status.recordPath
    if (!path || !this.cached) throw new Error('No llm-wiki paper note or record is available.')
    await assertSafePathChain(this.cached.root, path, 'file')
    const url = new URL('obsidian://open')
    // The exact validated absolute path disambiguates two vaults with the same name.
    url.searchParams.set('path', join(this.cached.root, path))
    try {
      await this.options.openExternal(url.toString())
    } catch {
      throw new Error('Obsidian could not be opened. Check that it is installed.')
    }
    return { opened: true }
  }
  private async scan(refresh: boolean): Promise<Scan> {
    if (
      !refresh &&
      this.cached &&
      this.now().getTime() - Date.parse(this.cached.checkedAt) < 30_000
    )
      return this.cached
    if (!this.pending) {
      this.pending = this.readScan()
      void this.pending
        .finally(() => {
          this.pending = undefined
        })
        .catch(() => undefined)
    }
    this.cached = await this.pending
    return this.cached
  }
  private async readScan(): Promise<Scan> {
    const rootInfo = await lstat(this.root)
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('Unsafe vault root')
    const root = await realpath(this.root)
    for (const path of ['AGENTS.md', '_schema.md']) await assertSafePathChain(root, path, 'file')
    const paths: { path: string; note: boolean }[] = []
    let incomplete = false
    let visited = 0
    const visit = async (directory: string, note: boolean): Promise<void> => {
      await assertSafePathChain(root, directory, 'directory')
      for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
        if (++visited > MAX_FILES) throw new Error('Vault metadata count limit')
        const path = `${directory}/${entry.name}`
        if (entry.isSymbolicLink()) {
          incomplete = true
          continue
        }
        if (entry.isDirectory()) await visit(path, note)
        else if (entry.isFile() && entry.name.endsWith('.md') && (!note || NOTE_PREFIX.test(path)))
          paths.push({ path, note })
      }
    }
    await visit('raw/paper_records', false)
    await visit('Literature/Paper_Notes', true)
    const entries: Entry[] = []
    for (let offset = 0; offset < paths.length; offset += 16) {
      await Promise.all(
        paths.slice(offset, offset + 16).map(async ({ path, note }) => {
          try {
            const fields = await header(root, path)
            const id = llmWikiArxivIdSchema.safeParse(fields.arxiv_id)
            if (id.success) entries.push({ id: id.data, path, fields, note })
            else if (fields.arxiv_id) incomplete = true
          } catch {
            incomplete = true
          }
        })
      )
    }
    return { root, entries, checkedAt: this.now().toISOString(), incomplete }
  }
}

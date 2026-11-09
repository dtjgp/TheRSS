import { constants } from 'node:fs'
import { lstat, open, realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  llmWikiDailyOpenRequestSchema,
  llmWikiDailySnapshotSchema,
  type LlmWikiDailyOpenRequest,
  type LlmWikiDailyPaper,
  type LlmWikiDailySnapshot
} from '../../shared/llmWikiDaily'
import { llmWikiArxivId, llmWikiArxivIdSchema } from '../../shared/llmWikiLibrary'
import { isSafeLlmWikiRelativePath } from '../../shared/llmWikiPromotion'
import { assertSafePathChain } from './llmWikiVaultSupport'

const DIGEST_DIRECTORY = 'Literature/Digests/ArXiv_Daily'
const MAX_LOOKBACK_DAYS = 14
const DIGEST_BYTES = 256 * 1024
const NOTE_HEADER_BYTES = 16 * 1024
const NOTE_PREFIX = /^Literature\/Paper_Notes\/(?:L1_Deep_Read|L2_Structured)\/.+\.md$/u
const PRIORITY_ORDER = { direct: 0, adjacent: 1, weak: 2, unclassified: 3 } as const

type DatedPaper = Omit<LlmWikiDailyPaper, 'canOpenNote'> & { notePath: string | null }
type DatedEdition = {
  status: 'completed' | 'partial' | 'no-source' | 'no-results'
  date: string
  selected: number
  scanned: number | null
  papers: DatedPaper[]
}

function localCalendarDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function digestPath(date: string): string {
  return `${DIGEST_DIRECTORY}/ArXiv_Daily_${date}.md`
}

function isMissing(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
}

async function readBounded(
  root: string,
  path: string,
  limit: number,
  wholeFile: boolean
): Promise<string> {
  await assertSafePathChain(root, path, 'file')
  const file = await open(
    join(root, path),
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
  )
  try {
    if (!(await file.stat()).isFile()) throw new Error('Expected a regular vault file')
    const buffer = Buffer.alloc(limit + Number(wholeFile))
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0)
    if (bytesRead > limit) throw new Error('Daily edition exceeds its read limit')
    return buffer.subarray(0, bytesRead).toString('utf8').replaceAll('\r\n', '\n')
  } finally {
    await file.close()
  }
}

function splitFrontmatter(content: string): { metadata: string; body: string } {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/u.exec(content)
  if (!match) throw new Error('Missing bounded frontmatter')
  return { metadata: match[1]!, body: content.slice(match[0].length) }
}

/** The daily contract uses top-level scalar values for these fields. */
function scalar(metadata: string, key: string): string | null {
  const matches = [...metadata.matchAll(new RegExp(`^${key}:[ \\t]*([^\\n]*)$`, 'gmu'))]
  if (matches.length > 1) throw new Error('Duplicate daily metadata field')
  const raw = matches[0]?.[1]?.trim()
  if (!raw) return null
  const quoted = /^(?:'([^']*)'|"([^"\\]*)")$/u.exec(raw)
  return quoted ? (quoted[1] ?? quoted[2]!) : raw
}

function count(value: string | null, maximum: number): number | null {
  if (value === null) return null
  if (!/^\d{1,7}$/u.test(value) || Number(value) > maximum) {
    throw new Error('Invalid daily edition count')
  }
  return Number(value)
}

function plainText(markdown: string, limit: number): string {
  return markdown
    .replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/gu,
      (_match, target: string, alias?: string) => alias ?? target.split('/').at(-1)!
    )
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/<\/?[A-Za-z][^>]*>/gu, '')
    .replace(/[\p{Cc}\u202a-\u202e\u2066-\u2069]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, limit)
    .trim()
}

function noteTarget(block: string): string | null {
  const paths = new Set<string>()
  for (const match of block.matchAll(
    /\[\[(Literature\/Paper_Notes\/[^\]|\n]+)(?:\|[^\]\n]+)?\]\]/gu
  )) {
    const candidate = match[1]!
    const path = candidate.endsWith('.md') ? candidate : `${candidate}.md`
    if (NOTE_PREFIX.test(path) && isSafeLlmWikiRelativePath(path)) paths.add(path)
  }
  return paths.size === 1 ? paths.values().next().value! : null
}

function parsePaper(block: string): DatedPaper {
  const heading = block
    .split('\n', 1)[0]!
    .replace(/^\d+\.[ \t]+/u, '')
    .trim()
  const scored =
    /^(.*?)\s+—\s+(\d{1,2})\/10[\s,]+(direct|adjacent|weak)(?:\s+\([^)]*\))?\s*$/iu.exec(heading)
  const title = plainText(scored?.[1] ?? heading, 1000)
  const score = scored ? Number(scored[2]) : null
  const priority = (scored?.[3]?.toLowerCase() ?? 'unclassified') as DatedPaper['priority']
  const metadataRows = [...block.matchAll(/^\|\s*arXiv\s*\/\s*categories\s*\|([^\n]*)$/gimu)]
  const urls = metadataRows.flatMap((row) =>
    [...row[1]!.matchAll(/https:\/\/[^\s<>\])|]+/gu)].map((match) => match[0])
  )
  const arxivId = urls.length === 1 ? llmWikiArxivId({ source: 'arxiv', url: urls[0]! }) : null
  if (!arxivId || !title) throw new Error('Daily paper identity could not be verified')
  if (score !== null && score > 10) throw new Error('Daily paper score is out of range')
  const reason = /^-[ \t]+ModelCompress angle:[ \t]*([^\n]+)/mu.exec(block)?.[1] ?? ''
  return {
    arxivId,
    title,
    priority,
    score,
    reason: plainText(reason, 800) || null,
    notePath: noteTarget(block)
  }
}

function parseEdition(content: string, date: string): DatedEdition {
  const { metadata, body } = splitFrontmatter(content)
  if (
    scalar(metadata, 'type') !== 'feed' ||
    scalar(metadata, 'source') !== 'arxiv' ||
    scalar(metadata, 'date') !== date
  ) {
    throw new Error('Daily edition does not match its expected source and date')
  }
  const runStatus = scalar(metadata, 'run_status')
  if (runStatus !== 'completed' && runStatus !== 'partial' && runStatus !== 'no-source') {
    throw new Error('Daily edition has no supported run status')
  }
  const selected = count(scalar(metadata, 'selected'), 100)
  const scannedCount = count(scalar(metadata, 'scanned'), 1_000_000)
  // A scoped count can describe a stale upstream batch instead of this edition's coverage.
  const scanned = scalar(metadata, 'scanned_scope') === null ? scannedCount : null
  const sections = body
    .split(/^##[ \t]+/mu)
    .filter((section) => /^Selected papers[ \t]*\n/iu.test(section))
  const blocks = sections[0]?.split(/^###[ \t]+/mu).slice(1) ?? []
  if (
    sections.length > 1 ||
    selected !== blocks.length ||
    (runStatus === 'no-source' && selected !== 0)
  ) {
    throw new Error('Daily edition does not match its selected count')
  }
  const papers = blocks.map(parsePaper)
  if (new Set(papers.map(({ arxivId }) => arxivId)).size !== selected)
    throw new Error('Duplicate arXiv identity')
  papers.sort((left, right) => PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority])
  return {
    status: runStatus === 'completed' && selected === 0 ? 'no-results' : runStatus,
    date,
    selected,
    scanned,
    papers
  }
}

async function noteMatches(root: string, path: string, arxivId: string): Promise<boolean> {
  try {
    const { metadata } = splitFrontmatter(await readBounded(root, path, NOTE_HEADER_BYTES, false))
    const actual = llmWikiArxivIdSchema.safeParse(scalar(metadata, 'arxiv_id'))
    return actual.success && actual.data === arxivId
  } catch {
    return false
  }
}

/** Read the dated shortlist from its existing llm-wiki owner. */
export class LlmWikiDaily {
  private readonly root: string
  private readonly now: () => Date

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

  async snapshot(): Promise<LlmWikiDailySnapshot> {
    const now = this.now()
    const requestedDate = localCalendarDate(now)
    const base = { requestedDate, checkedAt: now.toISOString() }
    try {
      const { root, edition } = await this.readLatest(requestedDate)
      if (!edition) return { ...base, status: 'missing', edition: null }
      const { status, papers, ...summary } = edition
      const checked = await Promise.all(
        papers.map(async ({ notePath, ...paper }) => ({
          ...paper,
          canOpenNote: notePath !== null && (await noteMatches(root, notePath, paper.arxivId))
        }))
      )
      return llmWikiDailySnapshotSchema.parse({
        ...base,
        status,
        edition: { ...summary, papers: checked }
      })
    } catch {
      return { ...base, status: 'unavailable', edition: null }
    }
  }

  async open(candidate: LlmWikiDailyOpenRequest): Promise<{ opened: true }> {
    const request = llmWikiDailyOpenRequestSchema.parse(candidate)
    let target: string
    try {
      const { root, edition } = await this.readLatest(localCalendarDate(this.now()))
      if (!edition || edition.date !== request.date) throw new Error('Daily edition changed')
      if (request.arxivId) {
        const note = edition.papers.find((paper) => paper.arxivId === request.arxivId)?.notePath
        if (!note || !(await noteMatches(root, note, request.arxivId))) {
          throw new Error('Daily paper note is unavailable')
        }
        target = join(root, note)
      } else {
        target = join(root, digestPath(edition.date))
      }
    } catch {
      throw new Error('Daily edition or paper note is unavailable. Reload the shortlist.')
    }
    const url = new URL('obsidian://open')
    url.searchParams.set('path', target)
    try {
      await this.options.openExternal(url.toString())
    } catch {
      throw new Error('Obsidian could not be opened. Check that it is installed.')
    }
    return { opened: true }
  }

  private async readLatest(
    requestedDate: string
  ): Promise<{ root: string; edition: DatedEdition | null }> {
    const rootInfo = await lstat(this.root)
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('Unsafe vault root')
    const root = await realpath(this.root)
    for (const path of ['AGENTS.md', '_schema.md']) await assertSafePathChain(root, path, 'file')
    await assertSafePathChain(root, DIGEST_DIRECTORY, 'directory')
    const dateCursor = new Date(`${requestedDate}T12:00:00Z`)
    for (let offset = 0; offset <= MAX_LOOKBACK_DAYS; offset += 1) {
      const date = dateCursor.toISOString().slice(0, 10)
      let content: string
      try {
        content = await readBounded(root, digestPath(date), DIGEST_BYTES, true)
      } catch (error) {
        if (!isMissing(error)) throw error
        dateCursor.setUTCDate(dateCursor.getUTCDate() - 1)
        continue
      }
      return { root, edition: parseEdition(content, date) }
    }
    return { root, edition: null }
  }
}

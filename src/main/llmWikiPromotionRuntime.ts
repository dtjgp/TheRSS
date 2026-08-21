import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import {
  llmWikiPromotionAnalysisSchema,
  type LlmWikiVaultAdapterOptions,
  type PdfInspection,
  type PromotionAnalysis
} from '../core/integrations/llmWikiVaultAdapter'
import {
  executeBoundedCommand,
  resolveLocalAgentExecutable,
  type LocalAgentProcessRequest
} from '../core/agents/localAgentService'

const MAX_PDF_BYTES = 100_000_000
const MAX_PDF_TEXT_BYTES = 8_000_000
const MAX_NOTE_BYTES = 500_000

async function resolveExecutable(name: string): Promise<string | null> {
  const candidates = [
    ...(process.env.PATH ?? '')
      .split(delimiter)
      .filter(Boolean)
      .map((path) => join(path, name)),
    join('/opt/homebrew/bin', name),
    join('/usr/local/bin', name),
    join('/usr/bin', name)
  ]
  for (const candidate of [...new Set(candidates)]) {
    try {
      await access(candidate, constants.X_OK)
      return candidate
    } catch {
      // Continue through the bounded candidate list.
    }
  }
  return null
}

function boundedEnvironment(executable: string, stageDirectory: string): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    PATH: [dirname(executable), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'].join(
      delimiter
    ),
    TMPDIR: stageDirectory,
    TERM: 'dumb',
    NO_COLOR: '1'
  }
  for (const key of ['HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'CODEX_HOME'] as const) {
    if (process.env[key]) environment[key] = process.env[key]
  }
  return environment
}

async function fetchPdf(url: string): Promise<Buffer> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)
  try {
    let current = new URL(url)
    for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
      assertOfficialArxivPdfUrl(current)
      const response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'TheRSS/0.2 (+local academic archive)' }
      })
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location || redirectCount === 3) throw new Error('Unsafe arXiv PDF redirect')
        current = new URL(location, current)
        continue
      }
      if (!response.ok) throw new Error(`Official arXiv PDF returned HTTP ${response.status}`)
      const declaredLength = Number(response.headers.get('content-length') ?? 0)
      if (declaredLength > MAX_PDF_BYTES) throw new Error('The arXiv PDF exceeds the size limit')
      if (!response.body) throw new Error('The arXiv PDF response has no body')
      const reader = response.body.getReader()
      const chunks: Buffer[] = []
      let total = 0
      while (true) {
        const next = await reader.read()
        if (next.done) break
        total += next.value.byteLength
        if (total > MAX_PDF_BYTES) {
          await reader.cancel()
          throw new Error('The arXiv PDF exceeds the size limit')
        }
        chunks.push(Buffer.from(next.value))
      }
      if (total === 0) throw new Error('The arXiv PDF is empty')
      return Buffer.concat(chunks, total)
    }
    throw new Error('Unsafe arXiv PDF redirect')
  } finally {
    clearTimeout(timeout)
  }
}

function assertOfficialArxivPdfUrl(url: URL): void {
  const allowedHosts = new Set(['arxiv.org', 'www.arxiv.org', 'export.arxiv.org'])
  if (
    url.protocol !== 'https:' ||
    !allowedHosts.has(url.hostname) ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    !/^\/pdf\/\d{4}\.\d{4,5}(?:v\d+)?(?:\.pdf)?$/u.test(url.pathname)
  ) {
    throw new Error('The PDF URL is not an official bounded arXiv PDF URL')
  }
}

async function inspectPdf(path: string): Promise<PdfInspection> {
  const bytes = await readFile(path)
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('The downloaded source is not a PDF')
  }
  const pdfinfo = await resolveExecutable('pdfinfo')
  const pdftotext = await resolveExecutable('pdftotext')
  if (!pdfinfo || !pdftotext) throw new Error('PDF verification tools are unavailable')
  const common = {
    cwd: dirname(path),
    timeoutMs: 60_000,
    environment: boundedEnvironment(pdfinfo, dirname(path))
  }
  const metadata = await executeBoundedCommand({
    ...common,
    executable: pdfinfo,
    args: [path],
    stdin: '',
    maxOutputBytes: 1_000_000
  })
  const pageCount = Number(/^Pages:\s+(\d+)$/mu.exec(metadata)?.[1] ?? 0)
  if (!Number.isInteger(pageCount) || pageCount <= 0 || pageCount > 10_000) {
    throw new Error('The PDF page count could not be verified')
  }
  const text = await executeBoundedCommand({
    ...common,
    executable: pdftotext,
    args: ['-layout', '-nopgbrk', path, '-'],
    stdin: '',
    maxOutputBytes: MAX_PDF_TEXT_BYTES
  })
  if (text.trim().length < 100) throw new Error('The PDF contains no usable full text')
  return {
    pageCount,
    byteSize: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    text
  }
}

export function codexOutputSchema(): object {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'level',
      'routingRationale',
      'domain',
      'shortIdentifier',
      'relatedPaths',
      'noteMarkdown'
    ],
    properties: {
      level: { type: 'string', enum: ['L1', 'L2'] },
      routingRationale: { type: 'string', minLength: 1, maxLength: 2000 },
      domain: { type: 'string', minLength: 1, maxLength: 100 },
      shortIdentifier: { type: 'string', minLength: 1, maxLength: 100 },
      relatedPaths: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: { type: 'string', pattern: '^(Topics|Methods)/.+\\.md$' }
      },
      noteMarkdown: { type: 'string', minLength: 100, maxLength: MAX_NOTE_BYTES }
    }
  }
}

async function runCodex(request: {
  readonly prompt: string
  readonly stageDirectory: string
}): Promise<PromotionAnalysis> {
  const executable = await resolveLocalAgentExecutable('codex')
  if (!executable) throw new Error('Codex CLI was not found')
  const schemaPath = join(request.stageDirectory, 'promotion-output-schema.json')
  const resultPath = join(request.stageDirectory, 'promotion-output.json')
  await writeFile(schemaPath, JSON.stringify(codexOutputSchema()), { encoding: 'utf8', flag: 'wx' })
  const processRequest: LocalAgentProcessRequest = {
    executable,
    args: [
      'exec',
      '--ignore-user-config',
      '--sandbox',
      'read-only',
      '--ephemeral',
      '--skip-git-repo-check',
      '--disable',
      'shell_tool',
      '--color',
      'never',
      '--output-schema',
      schemaPath,
      '-o',
      resultPath,
      '-'
    ],
    stdin: request.prompt,
    cwd: request.stageDirectory,
    timeoutMs: 10 * 60_000,
    maxOutputBytes: 2_000_000,
    environment: boundedEnvironment(executable, request.stageDirectory)
  }
  await executeBoundedCommand(processRequest)
  return llmWikiPromotionAnalysisSchema.parse(JSON.parse(await readFile(resultPath, 'utf8')))
}

async function runRuntime(
  root: string,
  args: readonly string[],
  trustedRuntimeHash: string
): Promise<{ readonly status: string; readonly error?: string }> {
  const executable = await resolveExecutable('python3')
  if (!executable) return { status: 'rejected', error: 'python3_unavailable' }
  const stageDirectory = await mkdtemp(join(tmpdir(), 'therss-llm-wiki-runtime-'))
  try {
    const runtimeBytes = await readFile(join(root, 'System/Scripts/automation_runtime.py'))
    if (createHash('sha256').update(runtimeBytes).digest('hex') !== trustedRuntimeHash) {
      return { status: 'rejected', error: 'runtime_hash_mismatch' }
    }
    const stagedRuntime = join(stageDirectory, 'automation_runtime.py')
    await writeFile(stagedRuntime, runtimeBytes, { flag: 'wx', mode: 0o500 })
    const output = await executeBoundedCommand({
      executable,
      args: [stagedRuntime, ...args],
      stdin: '',
      cwd: root,
      timeoutMs: 30_000,
      maxOutputBytes: 1_000_000,
      environment: boundedEnvironment(executable, tmpdir())
    })
    const parsed: unknown = JSON.parse(output)
    if (!parsed || typeof parsed !== 'object' || !('status' in parsed)) {
      return { status: 'rejected', error: 'invalid_runtime_response' }
    }
    return parsed as { status: string; error?: string }
  } catch {
    return { status: 'rejected', error: 'runtime_command_failed' }
  } finally {
    await rm(stageDirectory, { recursive: true, force: true })
  }
}

export function createLlmWikiPromotionRuntime(): Pick<
  LlmWikiVaultAdapterOptions,
  'codexAvailable' | 'fetchPdf' | 'inspectPdf' | 'runCodex' | 'runRuntime'
> {
  return {
    codexAvailable: async () => (await resolveLocalAgentExecutable('codex')) !== null,
    fetchPdf,
    inspectPdf,
    runCodex,
    runRuntime
  }
}

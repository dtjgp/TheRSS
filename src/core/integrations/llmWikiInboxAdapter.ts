import { randomUUID } from 'node:crypto'
import { lstat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DiscoveryItem } from '../../shared/discovery'
import {
  LLM_WIKI_INBOX_AUTOMATION_ID,
  LLM_WIKI_INBOX_PREVIEW_VERSION,
  LLM_WIKI_INBOX_RECEIPT_VERSION,
  LLM_WIKI_INBOX_REQUIRED_SCOPES,
  llmWikiInboxPreviewSchema,
  llmWikiInboxReceiptSchema,
  type LlmWikiInboxPreview,
  type LlmWikiInboxReceipt
} from '../../shared/llmWikiInbox'
import { sourceDisplayName } from '../../shared/sourceIdentity'
import type { LlmWikiInboxAdapterPort, PreparedLlmWikiInboxCapture } from './llmWikiInboxService'
import {
  assertInsideRoot,
  assertSafeParentDirectory,
  assertSafePathChain,
  assertSafeVaultRoot,
  atomicReplace,
  hashText,
  readRegularFile,
  romeDate,
  romeTimestamp,
  safeFilenamePart,
  vaultRootResolver
} from './llmWikiVaultPaths'
import { assertNoActiveNoteContent } from './llmWikiVaultSupport'
import { TRUSTED_AUTOMATION_RUNTIME_SHA256 } from './llmWikiVaultTypes'

const INBOX_CONTRACT_FILES = [
  'AGENTS.md',
  '_schema.md',
  'System/Configs/Automation_Runtime_Scopes.json',
  'System/Scripts/automation_runtime.py',
  'log.md'
] as const

export interface LlmWikiInboxAdapterOptions {
  readonly vaultRoot?: string
  readonly resolveVaultRoot?: () => string
  readonly trustedRuntimeHash?: string
  readonly now?: () => Date
  readonly idFactory?: () => string
  readonly runRuntime: (
    root: string,
    args: readonly string[],
    trustedRuntimeHash: string
  ) => Promise<{ readonly status: string; readonly error?: string }>
}

interface InboxPreflight {
  readonly root: string
  readonly contractHash: string
  readonly logContent: string
}

interface StagedInboxHandle {
  readonly kind: 'therss-llm-wiki-inbox-staged-v1'
  readonly vaultRoot: string
  readonly notePath: string | null
  readonly auditPath: string | null
  readonly noteMarkdown: string | null
  readonly logHash: string | null
  readonly preparedAt: string
}

function parseInboxScope(value: string): readonly string[] | null {
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || !('automations' in parsed)) return null
  const automations = (parsed as { automations?: unknown }).automations
  if (
    !automations ||
    typeof automations !== 'object' ||
    !(LLM_WIKI_INBOX_AUTOMATION_ID in automations)
  ) {
    return null
  }
  const contract = (automations as Record<string, unknown>)[LLM_WIKI_INBOX_AUTOMATION_ID]
  if (!contract || typeof contract !== 'object' || !('lock_scopes' in contract)) return null
  const scopes = (contract as { lock_scopes?: unknown }).lock_scopes
  return Array.isArray(scopes) && scopes.every((scope) => typeof scope === 'string') ? scopes : null
}

function sanitizeLine(value: string, maxLength: number): string {
  return value
    .replace(/[\p{Cc}\u202a-\u202e\u2066-\u2069]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maxLength)
    .trim()
}

function yamlString(value: string): string {
  return JSON.stringify(sanitizeLine(value, 500))
}

export function buildInboxNote(item: DiscoveryItem, sourceHash: string, date: string): string {
  const title = sanitizeLine(item.title, 400) || 'Untitled discovery record'
  const summary = sanitizeLine(item.summary, 4_000) || 'No summary text was provided by the source.'
  const sourceLabel = sourceDisplayName(item.source)
  const topics = item.topics
    .map((topic) => sanitizeLine(topic, 120))
    .filter(Boolean)
    .slice(0, 8)
  const markdown = [
    '---',
    'type: inbox',
    'status: unprocessed',
    `date: '${date}'`,
    `title: ${yamlString(title)}`,
    `source: ${yamlString(item.source)}`,
    `source_kind: ${yamlString(item.kind)}`,
    `source_url: ${yamlString(item.url)}`,
    `source_hash: '${sourceHash}'`,
    'relevance: medium',
    'linked_to: []',
    'tags:',
    '  - type/inbox',
    '  - source/therss',
    '  - content/inbox',
    '---',
    '',
    `# ${title}`,
    '',
    '## Source metadata',
    `- Source: ${sourceLabel} (\`${item.source}\`)`,
    `- Kind: ${item.kind}`,
    `- URL: ${item.url}`,
    `- Published: ${sanitizeLine(item.publishedAt, 64)}`,
    ...(item.language ? [`- Language: ${sanitizeLine(item.language, 64)}`] : []),
    ...(typeof item.stars === 'number' ? [`- Stars (snapshot): ${item.stars}`] : []),
    '',
    '## Retrieved summary',
    summary,
    '',
    ...(topics.length > 0
      ? ['## Discovery topics', ...topics.map((topic) => `- ${topic}`), '']
      : []),
    '## Evidence boundary',
    'Captured from TheRSS discovery metadata and retrieved summary only. No repository code audit, benchmark reproduction, or independent fact verification was performed during Inbox capture.'
  ].join('\n')
  assertNoActiveNoteContent(markdown)
  return `${markdown}\n`
}

async function preflightInboxVault(
  configuredRoot: string,
  trustedRuntimeHash: string
): Promise<InboxPreflight> {
  const root = await assertSafeVaultRoot(configuredRoot)
  const entries = await Promise.all(
    INBOX_CONTRACT_FILES.map(async (path) => [path, await readRegularFile(root, path)] as const)
  )
  const contents = Object.fromEntries(entries)
  const runtimeConfig = contents['System/Configs/Automation_Runtime_Scopes.json']
  if (runtimeConfig === undefined) throw new Error('The llm-wiki runtime config is unavailable')
  const scopes = parseInboxScope(runtimeConfig)
  if (!scopes || LLM_WIKI_INBOX_REQUIRED_SCOPES.some((scope) => !scopes.includes(scope))) {
    throw new Error(
      `The llm-wiki inbox writer scope (${LLM_WIKI_INBOX_AUTOMATION_ID} with ${LLM_WIKI_INBOX_REQUIRED_SCOPES.join(', ')}) is not registered in System/Configs/Automation_Runtime_Scopes.json`
    )
  }
  if (hashText(contents['System/Scripts/automation_runtime.py'] ?? '') !== trustedRuntimeHash) {
    throw new Error('The llm-wiki automation runtime does not match the trusted app baseline')
  }
  await assertSafePathChain(root, 'Inbox', 'directory')
  await assertSafePathChain(root, 'Automation_Conversations', 'directory')
  return {
    root,
    contractHash: hashText(
      entries
        .filter(([path]) => path !== 'log.md')
        .map(([path, content]) => `${path}\n${hashText(content)}`)
        .join('\n')
    ),
    logContent: contents['log.md'] ?? ''
  }
}

function handleFrom(prepared: PreparedLlmWikiInboxCapture): StagedInboxHandle {
  const handle = prepared.opaqueHandle as Partial<StagedInboxHandle> | null
  if (!handle || handle.kind !== 'therss-llm-wiki-inbox-staged-v1') {
    throw new Error('Invalid llm-wiki Inbox capture handle')
  }
  return handle as StagedInboxHandle
}

function inboxReceipt(
  preview: LlmWikiInboxPreview,
  details: Partial<LlmWikiInboxReceipt> & {
    readonly id: string
    readonly status: LlmWikiInboxReceipt['status']
    readonly summary: string
    readonly startedAt: string
    readonly completedAt: string
  }
): LlmWikiInboxReceipt {
  return llmWikiInboxReceiptSchema.parse({
    version: LLM_WIKI_INBOX_RECEIPT_VERSION,
    id: details.id,
    itemId: preview.itemId,
    source: preview.source,
    kind: preview.kind,
    status: details.status,
    sourceHash: preview.sourceHash,
    contractHash: preview.contractHash,
    evidenceTier: details.evidenceTier ?? 'partial',
    summary: details.summary,
    createdPaths: details.createdPaths ?? [],
    updatedPaths: details.updatedPaths ?? [],
    notePath: details.notePath ?? null,
    auditPath: details.auditPath ?? null,
    blockers: details.blockers ?? [],
    startedAt: details.startedAt,
    completedAt: details.completedAt
  })
}

async function assertTargetAbsent(root: string, relativePath: string): Promise<void> {
  const absolutePath = join(root, relativePath)
  assertInsideRoot(root, absolutePath)
  await assertSafeParentDirectory(root, absolutePath)
  try {
    await lstat(absolutePath)
    throw new Error(`The Inbox capture target already exists: ${relativePath}`)
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith('The Inbox capture target') ||
        !('code' in error) ||
        error.code !== 'ENOENT')
    ) {
      throw error
    }
  }
}

export class LlmWikiInboxAdapter implements LlmWikiInboxAdapterPort {
  readonly #resolveVaultRoot: () => string
  readonly #trustedRuntimeHash: string
  readonly #now: () => Date
  readonly #idFactory: () => string
  readonly #runRuntime: LlmWikiInboxAdapterOptions['runRuntime']

  constructor(options: LlmWikiInboxAdapterOptions) {
    this.#resolveVaultRoot = vaultRootResolver(options)
    this.#trustedRuntimeHash = options.trustedRuntimeHash ?? TRUSTED_AUTOMATION_RUNTIME_SHA256
    this.#now = options.now ?? (() => new Date())
    this.#idFactory = options.idFactory ?? randomUUID
    this.#runRuntime = options.runRuntime
  }

  async prepare(
    item: DiscoveryItem,
    context: { readonly previewId: string; readonly expiresAt: string; readonly sourceHash: string }
  ): Promise<PreparedLlmWikiInboxCapture> {
    const preparedAt = this.#now().toISOString()
    const vaultRoot = this.#resolveVaultRoot()
    try {
      const preflight = await preflightInboxVault(vaultRoot, this.#trustedRuntimeHash)
      const date = romeDate(preparedAt)
      const slug = safeFilenamePart(item.title, item.source, 48)
      const compactTimestamp = preparedAt.replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z')
      const notePath = `Inbox/TheRSS_${date}_${slug}_${context.sourceHash.slice(0, 8)}.md`
      const auditPath = `Automation_Conversations/${compactTimestamp}__${LLM_WIKI_INBOX_AUTOMATION_ID}__${slug}.json`
      await assertTargetAbsent(preflight.root, notePath)
      await assertTargetAbsent(preflight.root, auditPath)
      const noteMarkdown = buildInboxNote(item, context.sourceHash, date)
      const preview = llmWikiInboxPreviewSchema.parse({
        version: LLM_WIKI_INBOX_PREVIEW_VERSION,
        previewId: context.previewId,
        itemId: item.id,
        source: item.source,
        kind: item.kind,
        title: item.title,
        url: item.url,
        ready: true,
        vaultLabel: 'llm-wiki',
        destination: 'Inbox',
        intendedPaths: [notePath, 'log.md', auditPath],
        evidenceBoundary:
          'Inbox capture writes retrieved discovery metadata and summary only (unprocessed Inbox entry, not verified claims or code review).',
        blockers: [],
        sourceHash: context.sourceHash,
        contractHash: preflight.contractHash,
        expiresAt: context.expiresAt
      })
      return {
        preview,
        opaqueHandle: {
          kind: 'therss-llm-wiki-inbox-staged-v1',
          vaultRoot: preflight.root,
          notePath,
          auditPath,
          noteMarkdown,
          logHash: hashText(preflight.logContent),
          preparedAt
        } satisfies StagedInboxHandle
      }
    } catch (error) {
      const blocker = error instanceof Error ? error.message : 'llm-wiki Inbox preflight failed'
      return {
        preview: llmWikiInboxPreviewSchema.parse({
          version: LLM_WIKI_INBOX_PREVIEW_VERSION,
          previewId: null,
          itemId: item.id,
          source: item.source,
          kind: item.kind,
          title: item.title,
          url: item.url,
          ready: false,
          vaultLabel: 'llm-wiki',
          destination: 'Inbox',
          intendedPaths: [],
          evidenceBoundary: 'No vault write was attempted.',
          blockers: [blocker],
          sourceHash: context.sourceHash,
          contractHash: '0'.repeat(64),
          expiresAt: context.expiresAt
        }),
        opaqueHandle: {
          kind: 'therss-llm-wiki-inbox-staged-v1',
          vaultRoot,
          notePath: null,
          auditPath: null,
          noteMarkdown: null,
          logHash: null,
          preparedAt
        } satisfies StagedInboxHandle
      }
    }
  }

  async confirm(prepared: PreparedLlmWikiInboxCapture): Promise<LlmWikiInboxReceipt> {
    const handle = handleFrom(prepared)
    const completedAt = this.#now().toISOString()
    const receiptId = this.#idFactory()
    if (
      !prepared.preview.ready ||
      !handle.notePath ||
      !handle.auditPath ||
      !handle.noteMarkdown ||
      !handle.logHash
    ) {
      return inboxReceipt(prepared.preview, {
        id: receiptId,
        status: 'blocked',
        summary: 'The prepared Inbox capture was incomplete; no vault write was attempted.',
        blockers: ['Create a new Inbox capture preview.'],
        startedAt: handle.preparedAt,
        completedAt
      })
    }

    let preflight: InboxPreflight
    try {
      preflight = await preflightInboxVault(handle.vaultRoot, this.#trustedRuntimeHash)
      if (preflight.contractHash !== prepared.preview.contractHash) {
        throw new Error('The live llm-wiki contract changed after preview')
      }
      if (hashText(preflight.logContent) !== handle.logHash) {
        throw new Error('The llm-wiki file changed after preview: log.md')
      }
    } catch (error) {
      return inboxReceipt(prepared.preview, {
        id: receiptId,
        status: 'blocked',
        summary: 'The live llm-wiki contract changed or could not be revalidated.',
        blockers: [error instanceof Error ? error.message : 'Vault preflight failed'],
        startedAt: handle.preparedAt,
        completedAt
      })
    }

    const ownerId = `therss-inbox-${this.#idFactory()}`.slice(0, 128)
    const lease = await this.#runRuntime(
      preflight.root,
      [
        'begin',
        LLM_WIKI_INBOX_AUTOMATION_ID,
        ownerId,
        '--ttl-seconds',
        '600',
        '--metadata',
        JSON.stringify({ item_id: prepared.preview.itemId, source: prepared.preview.source })
      ],
      this.#trustedRuntimeHash
    )
    if (lease.status !== 'acquired' && lease.status !== 'already-owned') {
      return inboxReceipt(prepared.preview, {
        id: receiptId,
        status: 'blocked',
        summary: 'The llm-wiki writer lease could not be acquired; no Inbox file was written.',
        blockers: ['Another automation may own an overlapping vault scope.'],
        startedAt: handle.preparedAt,
        completedAt
      })
    }

    const createdPaths: string[] = []
    const updatedPaths: string[] = []
    let finishStatus: 'completed' | 'partial' | 'blocked' = 'partial'
    let finishError: string | null = null
    try {
      const locked = await preflightInboxVault(preflight.root, this.#trustedRuntimeHash)
      if (locked.contractHash !== prepared.preview.contractHash) {
        finishStatus = 'blocked'
        throw new Error('The live llm-wiki contract changed while acquiring the writer lease')
      }
      if (hashText(locked.logContent) !== handle.logHash) {
        finishStatus = 'blocked'
        throw new Error('The llm-wiki file changed after preview: log.md')
      }
      await assertTargetAbsent(locked.root, handle.notePath)
      await assertTargetAbsent(locked.root, handle.auditPath)

      const noteTarget = join(locked.root, handle.notePath)
      await writeFile(noteTarget, handle.noteMarkdown, { encoding: 'utf8', flag: 'wx' })
      createdPaths.push(handle.notePath)

      const logEntry = `\n## [${romeTimestamp(completedAt)}] inbox-capture | ${sanitizeLine(prepared.preview.title, 200)}\n- Source: \`${prepared.preview.source}\` (${prepared.preview.kind})\n- Inbox note: [[${handle.notePath.replace(/\.md$/u, '')}]]\n- Evidence: metadata-only (unprocessed Inbox capture from TheRSS)\n`
      await atomicReplace(
        join(locked.root, 'log.md'),
        `${locked.logContent.trimEnd()}\n${logEntry}`,
        receiptId
      )
      updatedPaths.push('log.md')

      const auditPayload = JSON.stringify(
        {
          automation_id: LLM_WIKI_INBOX_AUTOMATION_ID,
          status: 'completed',
          item_id: prepared.preview.itemId,
          source: prepared.preview.source,
          kind: prepared.preview.kind,
          source_hash: prepared.preview.sourceHash,
          started_at: handle.preparedAt,
          completed_at: completedAt,
          created_paths: [...createdPaths, handle.auditPath],
          updated_paths: updatedPaths
        },
        null,
        2
      )
      await writeFile(join(locked.root, handle.auditPath), `${auditPayload}\n`, {
        encoding: 'utf8',
        flag: 'wx'
      })
      createdPaths.push(handle.auditPath)
      finishStatus = 'completed'

      return inboxReceipt(prepared.preview, {
        id: receiptId,
        status: 'completed',
        evidenceTier: 'metadata-only',
        summary: `Captured ${prepared.preview.kind} metadata into ${handle.notePath}.`,
        createdPaths,
        updatedPaths,
        notePath: handle.notePath,
        auditPath: handle.auditPath,
        startedAt: handle.preparedAt,
        completedAt
      })
    } catch (error) {
      finishError = error instanceof Error ? error.message : 'Inbox write failed'
      return inboxReceipt(prepared.preview, {
        id: receiptId,
        status: finishStatus,
        summary:
          finishStatus === 'blocked'
            ? 'The live llm-wiki contract changed while acquiring the writer lease.'
            : 'The Inbox capture did not complete cleanly; inspect the vault before retrying.',
        createdPaths,
        updatedPaths,
        notePath: createdPaths.includes(handle.notePath) ? handle.notePath : null,
        auditPath: createdPaths.includes(handle.auditPath) ? handle.auditPath : null,
        blockers: [finishError],
        startedAt: handle.preparedAt,
        completedAt
      })
    } finally {
      await this.#runRuntime(
        preflight.root,
        [
          'finish',
          LLM_WIKI_INBOX_AUTOMATION_ID,
          ownerId,
          '--status',
          finishStatus,
          ...(finishError ? ['--summary', finishError.slice(0, 300)] : [])
        ],
        this.#trustedRuntimeHash
      ).catch(() => undefined)
    }
  }
}

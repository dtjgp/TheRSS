import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiscoveryItem } from '../../shared/discovery'
import {
  LLM_WIKI_INBOX_AUTOMATION_ID,
  LLM_WIKI_INBOX_REQUIRED_SCOPES
} from '../../shared/llmWikiInbox'
import { hashPromotionSource } from './llmWikiPromotionService'
import { LlmWikiInboxAdapter, buildInboxNote } from './llmWikiInboxAdapter'

const roots: string[] = []
const runtimeSource = '#!/usr/bin/env python3\nprint("ok")\n'
const runtimeHash = createHash('sha256').update(runtimeSource).digest('hex')

const sampleRepo: DiscoveryItem = {
  id: 'github:dtjgp/edge-pruning',
  source: 'github',
  kind: 'repository',
  externalId: 'dtjgp/edge-pruning',
  title: 'Edge Pruning Bench',
  summary: 'Deterministic latency benchmark for structured pruning on edge NPUs.',
  url: 'https://github.com/dtjgp/edge-pruning',
  publishedAt: '2026-11-20T00:00:00.000Z',
  updatedAt: '2026-11-26T00:00:00.000Z',
  authors: ['dtjgp'],
  categories: [],
  topics: ['pruning', 'edge-ai'],
  language: 'Python',
  stars: 318,
  metrics: {}
}

async function put(root: string, relativePath: string, content: string): Promise<void> {
  await mkdir(dirname(join(root, relativePath)), { recursive: true })
  await writeFile(join(root, relativePath), content, 'utf8')
}

async function createVaultFixture(options: { registerScope?: boolean } = {}) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'therss-inbox-vault-')))
  roots.push(root)
  await put(root, 'AGENTS.md', '# Vault rules\n')
  await put(root, '_schema.md', '# Schema\n')
  await put(root, 'log.md', '# Log\n')
  await put(root, 'System/Scripts/automation_runtime.py', runtimeSource)
  await mkdir(join(root, 'Inbox'), { recursive: true })
  await mkdir(join(root, 'Automation_Conversations'), { recursive: true })
  await put(
    root,
    'System/Configs/Automation_Runtime_Scopes.json',
    JSON.stringify(
      {
        schema_version: 1,
        automations: {
          ...(options.registerScope === false
            ? {}
            : {
                [LLM_WIKI_INBOX_AUTOMATION_ID]: {
                  source: 'TheRSS desktop explicit-confirmation workflow',
                  lock_scopes: [...LLM_WIKI_INBOX_REQUIRED_SCOPES]
                }
              })
        }
      },
      null,
      2
    )
  )
  const runRuntime = vi.fn(async (_root: string, args: readonly string[]) =>
    args[0] === 'begin' ? { status: 'acquired' } : { status: 'completed' }
  )
  const adapter = new LlmWikiInboxAdapter({
    vaultRoot: root,
    trustedRuntimeHash: runtimeHash,
    now: () => new Date('2026-11-27T12:30:00.000Z'),
    idFactory: () => '11111111-1111-4111-8111-111111111111',
    runRuntime
  })
  return { root, runRuntime, adapter }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('LlmWikiInboxAdapter', () => {
  it('blocks preview cleanly when therss-inbox-capture is not registered in Automation_Runtime_Scopes.json', async () => {
    const { adapter } = await createVaultFixture({ registerScope: false })
    const prepared = await adapter.prepare(sampleRepo, {
      previewId: '00000000-0000-4000-8000-000000000001',
      expiresAt: '2026-11-27T13:00:00.000Z',
      sourceHash: hashPromotionSource(sampleRepo)
    })
    expect(prepared.preview.ready).toBe(false)
    expect(prepared.preview.intendedPaths).toEqual([])
    expect(prepared.preview.blockers[0]).toMatch(/therss-inbox-capture/)
    const blocked = await adapter.confirm(prepared)
    expect(blocked.status).toBe('blocked')
  })

  it('writes an unprocessed Inbox note, appends log.md, writes audit JSON, and finishes lease', async () => {
    const { root, runRuntime, adapter } = await createVaultFixture()
    const sourceHash = hashPromotionSource(sampleRepo)
    const prepared = await adapter.prepare(sampleRepo, {
      previewId: '00000000-0000-4000-8000-000000000002',
      expiresAt: '2026-11-27T13:00:00.000Z',
      sourceHash
    })
    expect(prepared.preview.ready).toBe(true)
    expect(prepared.preview.intendedPaths).toHaveLength(3)
    expect(prepared.preview.intendedPaths[0]).toMatch(/^Inbox\/TheRSS_2026-11-27_/)

    const receipt = await adapter.confirm(prepared)
    expect(receipt.status).toBe('completed')
    expect(receipt.evidenceTier).toBe('metadata-only')
    expect(receipt.notePath).toBe(prepared.preview.intendedPaths[0])
    expect(receipt.auditPath).toBe(prepared.preview.intendedPaths[2])
    expect(runRuntime.mock.calls.map((call) => call[1][0])).toEqual(['begin', 'finish'])

    const noteContent = await readFile(join(root, receipt.notePath!), 'utf8')
    expect(noteContent).toContain('type: inbox')
    expect(noteContent).toContain('status: unprocessed')
    expect(noteContent).toContain(`source_hash: '${sourceHash}'`)
    expect(noteContent).toContain('## Evidence boundary')

    const logContent = await readFile(join(root, 'log.md'), 'utf8')
    expect(logContent).toContain('inbox-capture | Edge Pruning Bench')

    const auditContent = JSON.parse(await readFile(join(root, receipt.auditPath!), 'utf8'))
    expect(auditContent.automation_id).toBe(LLM_WIKI_INBOX_AUTOMATION_ID)
    expect(auditContent.status).toBe('completed')

    // Re-preparing the exact same item blocks instead of overwriting the existing Inbox file.
    const duplicate = await adapter.prepare(sampleRepo, {
      previewId: '00000000-0000-4000-8000-000000000003',
      expiresAt: '2026-11-27T13:00:00.000Z',
      sourceHash
    })
    expect(duplicate.preview.ready).toBe(false)
    expect(duplicate.preview.blockers[0]).toMatch(/already exists/)
  })

  it('blocks confirmation when log.md mutates after preview or writer lease is denied', async () => {
    const { root, runRuntime, adapter } = await createVaultFixture()
    const sourceHash = hashPromotionSource(sampleRepo)
    const prepared = await adapter.prepare(sampleRepo, {
      previewId: '00000000-0000-4000-8000-000000000004',
      expiresAt: '2026-11-27T13:00:00.000Z',
      sourceHash
    })
    await put(root, 'log.md', '# Log\nExternal mutation\n')
    const drifted = await adapter.confirm(prepared)
    expect(drifted.status).toBe('blocked')
    expect(drifted.blockers[0]).toMatch(/changed after preview/)

    const prepared2 = await adapter.prepare(sampleRepo, {
      previewId: '00000000-0000-4000-8000-000000000005',
      expiresAt: '2026-11-27T13:00:00.000Z',
      sourceHash
    })
    runRuntime.mockResolvedValueOnce({ status: 'busy' })
    const busy = await adapter.confirm(prepared2)
    expect(busy.status).toBe('blocked')
    expect(busy.summary).toMatch(/lease could not be acquired/)
  })

  it('rejects active HTML/script payloads inside Inbox note content', () => {
    const malicious: DiscoveryItem = {
      ...sampleRepo,
      summary: 'Check <script>alert(1)</script> payload'
    }
    expect(() => buildInboxNote(malicious, 'a'.repeat(64), '2026-11-27')).toThrow()
  })
})

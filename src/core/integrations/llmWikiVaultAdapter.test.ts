import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiscoveryItem } from '../../shared/discovery'
import { LlmWikiVaultAdapter, llmWikiVaultAdapterInternals } from './llmWikiVaultAdapter'

const roots: string[] = []
const paper: DiscoveryItem = {
  id: 'arxiv:2608.00001',
  source: 'arxiv',
  kind: 'paper',
  externalId: '2608.00001',
  title: 'Structured pruning / edge: deployment?',
  summary: 'A resource-aware structured-pruning method.',
  url: 'https://arxiv.org/abs/2608.00001',
  publishedAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
  authors: ['Ada Researcher', 'Bo Engineer'],
  categories: ['cs.LG'],
  topics: ['structured pruning'],
  language: null,
  stars: null,
  metrics: {}
}

const requiredFileContents: Readonly<Record<string, string>> = {
  'AGENTS.md': '# Vault rules\n',
  '_schema.md': '# Schema\n',
  'System/SOPs/ArXiv_Paper_Record_Pipeline.md': '# ArXiv pipeline\n',
  'System/Reference/Operations/Vault_Write_Governance.md': '# Writer governance\n',
  'System/Scripts/automation_runtime.py': '# runtime\n',
  'Templates/Paper_Note_L1.md': '---\nlevel: L1\n---\n# L1 template\n',
  'Templates/Paper_Note_L2.md': '---\nlevel: L2\n---\n# L2 template\n',
  'Literature/Paper_Notes/Paper_Notes_Index.md': '# Paper notes\n',
  'Topics/Edge_AI.md':
    '---\ntype: topic\ndate: 2026-01-01\nupdated: 2026-01-01\ntags:\n  - type/topic\nrelated: []\n---\n# Edge AI\n',
  'Methods/Structured_Pruning.md':
    '---\ntype: method\ndate: 2026-01-01\nupdated: 2026-01-01\ntags:\n  - type/method\nrelated: []\n---\n# Structured Pruning\n',
  'index.md': '# Vault index\n',
  'log.md': '# Log\n'
}

async function makeVault(registerScope = true): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'therss-vault-adapter-test-'))
  roots.push(root)
  const runtimeConfig = JSON.stringify({
    schema_version: 1,
    terminal_statuses: ['completed', 'partial', 'blocked', 'no-change', 'no-source', 'skipped'],
    automations: registerScope
      ? {
          'therss-paper-promotion': {
            source: 'TheRSS',
            lock_scopes: [
              'Automation_Conversations',
              'Literature/Paper_Notes',
              'Topics',
              'Methods',
              'raw/papers',
              'raw/paper_records',
              'index.md',
              'log.md'
            ]
          }
        }
      : {
          'another-automation': {
            source: 'fixture',
            lock_scopes: ['Inbox']
          }
        }
  })
  const files = {
    ...requiredFileContents,
    'System/Configs/Automation_Runtime_Scopes.json': runtimeConfig
  }
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content)
  }
  for (const path of [
    'Automation_Conversations',
    'raw/papers',
    'raw/paper_records',
    'Literature/Paper_Notes/L1_Deep_Read/Model_Compression',
    'Literature/Paper_Notes/L2_Structured/Model_Compression'
  ]) {
    await mkdir(join(root, path), { recursive: true })
  }
  return root
}

function fixtureOptions(root: string) {
  const pdf = Buffer.from('%PDF-1.7\nfixture full text')
  const runRuntime = vi.fn(async (_root: string, args: readonly string[]) => ({
    status: args[0] === 'begin' ? 'acquired' : 'released'
  }))
  return {
    vaultRoot: root,
    tempRoot: tmpdir(),
    trustedRuntimeHash: createHash('sha256').update('# runtime\n').digest('hex'),
    now: () => new Date('2026-08-21T10:00:00.000Z'),
    idFactory: vi.fn(() => 'fixture-id'),
    codexAvailable: vi.fn(async () => true),
    fetchPdf: vi.fn(async () => pdf),
    inspectPdf: vi.fn(async () => ({
      pageCount: 12,
      byteSize: pdf.byteLength,
      sha256: createHash('sha256').update(pdf).digest('hex'),
      text: 'Verified full paper text. '.repeat(20)
    })),
    runCodex: vi.fn(async (_request: { prompt: string; stageDirectory: string }) => ({
      level: 'L2' as const,
      routingRationale: 'Relevant method reference, but not a foundational closest baseline.',
      domain: 'Model_Compression',
      shortIdentifier: 'StructuredPruningEdge',
      relatedPaths: ['Topics/Edge_AI.md'],
      noteMarkdown:
        '---\ntype: paper-note\nlevel: L2\ndate: 2026-08-21\nstatus: unread\nread_date:\nsource_access: full-text\ntags:\n  - type/paper-note\n  - level/l2\n  - status/unread\nrelated:\n  - "[[Topics/Edge_AI]]"\n---\n# Researcher 2026 - Structured Pruning\n\n' +
        '## TL;DR\nAuthor-reported results are not independently reproduced.\n\n'.repeat(3) +
        'Official source: https://arxiv.org/abs/2608.00001\nPDF: raw/papers/Researcher et al. - 2026 - Structured pruning edge deployment.pdf\n\n' +
        '## Provenance\narXiv: 2608.00001; verified local PDF; Codex llm-wiki-promotion-v1.\n'
    })),
    runRuntime,
    pdf
  }
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

describe('LlmWikiVaultAdapter', () => {
  it('sanitizes fallback paths, routes L1, and appends idempotent index entries', () => {
    expect(llmWikiVaultAdapterInternals.safeFilenamePart('\u0000/:*', 'Fallback', 20)).toBe(
      'Fallback'
    )
    expect(llmWikiVaultAdapterInternals.safeFilenamePart('value', 'Fallback', 0)).toBe('Fallback')
    const paths = llmWikiVaultAdapterInternals.buildPaths(
      { ...paper, authors: [] },
      {
        level: 'L1',
        routingRationale: 'Foundational fixture.',
        domain: 'Model_Compression',
        shortIdentifier: 'Foundation',
        relatedPaths: ['Topics/Edge_AI.md'],
        noteMarkdown: 'x'.repeat(120)
      },
      new Date('2026-08-21T10:00:00.000Z')
    )
    expect(paths.note).toBe(
      'Literature/Paper_Notes/L1_Deep_Read/Model_Compression/Unknown_2026_Foundation.md'
    )

    const appended = llmWikiVaultAdapterInternals.appendPromotionEntry(
      '# Index\n\n## TheRSS manual promotions',
      '## TheRSS manual promotions',
      '- [[Paper|Paper]]',
      '[[Paper'
    )
    expect(appended).toBe('# Index\n\n## TheRSS manual promotions\n- [[Paper|Paper]]\n')
    expect(
      llmWikiVaultAdapterInternals.appendPromotionEntry(
        appended,
        '## TheRSS manual promotions',
        '- [[Paper|Paper]]',
        '[[Paper'
      )
    ).toBe(appended)
  })

  it('merges canonical archive links into a sidecar without replacing user metadata or body text', () => {
    const withoutLink =
      '---\narxiv_id: "2608.00001"\npdf_link: "https://arxiv.org/pdf/2608.00001v1"\nmanual_field: keep-me\n---\n\nHuman notes.\npdf_link: keep-this-body-line\n'
    const inserted = llmWikiVaultAdapterInternals.mergeSidecarArchiveLinks(
      withoutLink,
      paper,
      'raw/papers/Legacy_Name.pdf'
    )
    expect(inserted).toContain('arxiv_link: "https://arxiv.org/abs/2608.00001"')
    expect(inserted).toContain('pdf_link: "https://arxiv.org/pdf/2608.00001"')
    expect(inserted).toContain('source_pdf: "[[raw/papers/Legacy_Name]]"')
    expect(inserted).toContain('manual_field: keep-me')
    expect(inserted).toContain('Human notes.')
    expect(inserted).toContain('pdf_link: keep-this-body-line')

    const withOldLink = withoutLink.replace(
      'manual_field: keep-me',
      'source_pdf: "[[raw/papers/Old_Name]]"\nmanual_field: keep-me'
    )
    const merged = llmWikiVaultAdapterInternals.mergeSidecarArchiveLinks(
      withOldLink,
      paper,
      'raw/papers/Legacy_Name.pdf'
    )
    expect(merged).toContain('source_pdf: "[[raw/papers/Legacy_Name]]"')
    expect(merged).not.toContain('Old_Name')
    expect(merged).toContain('manual_field: keep-me')
    expect(merged).toContain('Human notes.')

    expect(() =>
      llmWikiVaultAdapterInternals.mergeSidecarArchiveLinks(
        '---\narxiv_id: "2608.00001"',
        paper,
        'raw/papers/Legacy_Name.pdf'
      )
    ).toThrow('frontmatter is not terminated')
  })

  it('blocks before network or Codex when the live writer scope is missing', async () => {
    const root = await makeVault(false)
    const options = fixtureOptions(root)
    const adapter = new LlmWikiVaultAdapter(options)

    const prepared = await adapter.prepare(paper, {
      previewId: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-08-21T10:30:00.000Z'
    })

    expect(prepared.preview).toMatchObject({ ready: false, previewId: null })
    expect(prepared.preview.blockers.join(' ')).toContain('writer scope is not registered')
    expect(options.fetchPdf).not.toHaveBeenCalled()
    expect(options.runCodex).not.toHaveBeenCalled()
  })

  it('rejects a malformed runtime lock-scope contract', async () => {
    const root = await makeVault()
    const configPath = join(root, 'System/Configs/Automation_Runtime_Scopes.json')
    const config = JSON.parse(await readFile(configPath, 'utf8')) as {
      automations: Record<string, { lock_scopes: unknown[] }>
    }
    config.automations['therss-paper-promotion']!.lock_scopes.push(42)
    await writeFile(configPath, JSON.stringify(config))
    const options = fixtureOptions(root)
    const adapter = new LlmWikiVaultAdapter(options)

    const prepared = await adapter.prepare(paper, {
      previewId: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-08-21T10:30:00.000Z'
    })

    expect(prepared.preview.ready).toBe(false)
    expect(prepared.preview.blockers.join(' ')).toContain('writer scope is not registered')
    expect(options.fetchPdf).not.toHaveBeenCalled()
  })

  it('stages in temporary storage, previews canonical paths, then applies exact confirmed writes', async () => {
    const root = await makeVault()
    const options = fixtureOptions(root)
    const adapter = new LlmWikiVaultAdapter(options)
    const prepared = await adapter.prepare(paper, {
      previewId: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-08-21T10:30:00.000Z'
    })

    expect(prepared.preview).toMatchObject({ ready: true, level: 'L2', blockers: [] })
    expect(prepared.preview.intendedPaths[0]).toMatch(
      /^raw\/papers\/Researcher et al\. - 2026 - Structured pruning edge deployment\.pdf$/u
    )
    expect(prepared.preview.intendedPaths[2]).toBe(
      'Literature/Paper_Notes/L2_Structured/Model_Compression/Researcher_2026_StructuredPruningEdge.md'
    )
    expect(options.runCodex.mock.calls[0]![0].prompt).toContain('BEGIN UNTRUSTED VERIFIED PDF TEXT')
    expect(options.runCodex.mock.calls[0]![0].prompt).toContain(
      'official URL https://arxiv.org/abs/2608.00001'
    )
    expect(options.runCodex.mock.calls[0]![0].prompt).toContain('source_access: full-text')

    const receipt = await adapter.confirm(prepared)

    expect(receipt).toMatchObject({ status: 'completed', evidenceTier: 'full-text-verified' })
    expect(receipt.createdPaths).toContain(prepared.preview.intendedPaths[0])
    expect(receipt.updatedPaths).toEqual([
      'Topics/Edge_AI.md',
      'Literature/Paper_Notes/Paper_Notes_Index.md',
      'index.md',
      'log.md'
    ])
    expect(await readFile(join(root, receipt.sidecarPath!), 'utf8')).toContain(
      'arxiv_id: "2608.00001"'
    )
    expect(await readFile(join(root, receipt.notePath!), 'utf8')).toContain(
      'Author-reported results are not independently reproduced'
    )
    expect(await readFile(join(root, 'Topics/Edge_AI.md'), 'utf8')).toContain(
      '[[Literature/Paper_Notes/L2_Structured/Model_Compression/Researcher_2026_StructuredPruningEdge]]'
    )
    expect(await readFile(join(root, receipt.auditPath!), 'utf8')).toContain(
      '- **Status:** completed'
    )
    expect(options.runRuntime).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('therss-vault-adapter-test-'),
      expect.arrayContaining(['begin', 'therss-paper-promotion']),
      expect.stringMatching(/^[a-f0-9]{64}$/u)
    )
    expect(options.runRuntime).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('therss-vault-adapter-test-'),
      expect.arrayContaining(['finish', 'therss-paper-promotion', 'completed']),
      expect.stringMatching(/^[a-f0-9]{64}$/u)
    )

    const stageDirectory = (prepared.opaqueHandle as { stageDirectory: string }).stageDirectory
    await adapter.dispose(prepared)
    await expect(stat(stageDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('deterministically normalizes required frontmatter and provenance boilerplate', async () => {
    const root = await makeVault()
    const options = fixtureOptions(root)
    options.runCodex.mockResolvedValue({
      level: 'L2',
      routingRationale: 'Adjacent method reference.',
      domain: 'Model_Compression',
      shortIdentifier: 'NormalizedBoilerplate',
      relatedPaths: ['Topics/Edge_AI.md'],
      noteMarkdown:
        '---\ntype: draft\nlevel: L1\ndate: 1999-01-01\nstatus: read\nread_date: 1999-01-01\ntags: []\nrelated: []\n---\n# Generated analysis\n\n' +
        'Author-reported analysis remains bounded to the verified paper text. '.repeat(3) +
        '\n\n## Provenance\n- Official source: https://arxiv.org/abs/2608.00001evil\n'
    })
    const adapter = new LlmWikiVaultAdapter(options)

    const prepared = await adapter.prepare(paper, {
      previewId: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-08-21T10:30:00.000Z'
    })

    expect(prepared.preview).toMatchObject({ ready: true, level: 'L2', blockers: [] })
    const receipt = await adapter.confirm(prepared)
    const note = await readFile(join(root, receipt.notePath!), 'utf8')
    expect(note).toContain('\nsource_access: full-text\n')
    expect(note).toContain('\n  - type/paper-note\n  - level/l2\n  - status/unread\n')
    expect(note).toContain('\n  - "[[Topics/Edge_AI]]"\n')
    expect(note).toContain('\n- Official source: https://arxiv.org/abs/2608.00001\n')
    expect(note).toContain(
      '\n- Local PDF: raw/papers/Researcher et al. - 2026 - Structured pruning edge deployment.pdf\n'
    )
    expect(note).not.toContain('2608.00001evil')
  })

  it('downloads and records the exact discovered arXiv version', async () => {
    const root = await makeVault()
    const options = fixtureOptions(root)
    const adapter = new LlmWikiVaultAdapter(options)
    const versionedPaper = {
      ...paper,
      id: 'arxiv:2608.00001v2',
      externalId: '2608.00001v2',
      url: 'https://arxiv.org/abs/2608.00001v2'
    }

    const prepared = await adapter.prepare(versionedPaper, {
      previewId: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-08-21T10:30:00.000Z'
    })

    expect(options.fetchPdf).toHaveBeenCalledWith('https://arxiv.org/pdf/2608.00001v2')
    expect(prepared.preview).toMatchObject({ ready: true, blockers: [] })
    const receipt = await adapter.confirm(prepared)
    const sidecar = await readFile(join(root, receipt.sidecarPath!), 'utf8')
    const note = await readFile(join(root, receipt.notePath!), 'utf8')
    expect(sidecar).toContain('arxiv_id: "2608.00001"')
    expect(sidecar).toContain('arxiv_link: "https://arxiv.org/abs/2608.00001v2"')
    expect(sidecar).toContain('pdf_link: "https://arxiv.org/pdf/2608.00001v2"')
    expect(note).toContain('- Official source: https://arxiv.org/abs/2608.00001v2')
  })

  it('replaces quoted or duplicate model frontmatter with one canonical mapping', async () => {
    const root = await makeVault()
    const options = fixtureOptions(root)
    const generated = await options.runCodex({ prompt: '', stageDirectory: '' })
    options.runCodex.mockReset()
    options.runCodex.mockResolvedValue({
      ...generated,
      noteMarkdown: generated.noteMarkdown.replace(
        'status: unread',
        '"status": read\nstatus: unread\n\'source_access\': abstract-only'
      )
    })
    const adapter = new LlmWikiVaultAdapter(options)

    const prepared = await adapter.prepare(paper, {
      previewId: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-08-21T10:30:00.000Z'
    })

    expect(prepared.preview.ready).toBe(true)
    const receipt = await adapter.confirm(prepared)
    const note = await readFile(join(root, receipt.notePath!), 'utf8')
    expect(note).not.toContain('"status":')
    expect(note).not.toContain("'source_access':")
    expect(note.match(/^status:/gmu)).toHaveLength(1)
    expect(note.match(/^source_access:/gmu)).toHaveLength(1)
  })

  it('fails closed when a governed file changes after preview', async () => {
    const root = await makeVault()
    const options = fixtureOptions(root)
    const adapter = new LlmWikiVaultAdapter(options)
    const prepared = await adapter.prepare(paper, {
      previewId: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-08-21T10:30:00.000Z'
    })
    await writeFile(join(root, '_schema.md'), '# Schema changed concurrently\n')

    await expect(adapter.confirm(prepared)).resolves.toMatchObject({
      status: 'blocked',
      createdPaths: [],
      updatedPaths: []
    })
    expect(options.runRuntime).not.toHaveBeenCalled()
    await adapter.dispose(prepared)
  })

  it('rolls back canonical writes and leaves an honest partial audit if lease finalization fails', async () => {
    const root = await makeVault()
    const options = fixtureOptions(root)
    let finishCalls = 0
    options.runRuntime.mockImplementation(async (_root, args) => {
      if (args[0] === 'begin') return { status: 'acquired' }
      finishCalls += 1
      return { status: finishCalls === 1 ? 'rejected' : 'released' }
    })
    const adapter = new LlmWikiVaultAdapter(options)
    const prepared = await adapter.prepare(paper, {
      previewId: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-08-21T10:30:00.000Z'
    })

    const receipt = await adapter.confirm(prepared)

    expect(receipt).toMatchObject({
      status: 'partial',
      updatedPaths: [],
      blockers: ['A canonical write or post-write verifier failed.']
    })
    expect(receipt.createdPaths).toEqual([receipt.auditPath])
    await expect(stat(join(root, prepared.preview.intendedPaths[0]!))).rejects.toMatchObject({
      code: 'ENOENT'
    })
    expect(await readFile(join(root, receipt.auditPath!), 'utf8')).toContain(
      '- **Status:** partial'
    )
    expect(await readFile(join(root, 'index.md'), 'utf8')).toBe('# Vault index\n')
    await adapter.dispose(prepared)
  })

  it('preserves concurrent user edits instead of overwriting them during rollback', async () => {
    const root = await makeVault()
    const options = fixtureOptions(root)
    let notePath = ''
    let auditPath = ''
    let finishCalls = 0
    options.runRuntime.mockImplementation(async (_root, args) => {
      if (args[0] === 'begin') return { status: 'acquired' }
      finishCalls += 1
      if (finishCalls === 1) {
        await writeFile(join(root, 'index.md'), '# Concurrent user index edit\n')
        await writeFile(join(root, notePath), '# Concurrent user note edit\n')
        await writeFile(join(root, auditPath), '# Concurrent user audit edit\n')
        return { status: 'rejected' }
      }
      return { status: 'released' }
    })
    const adapter = new LlmWikiVaultAdapter(options)
    const prepared = await adapter.prepare(paper, {
      previewId: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-08-21T10:30:00.000Z'
    })
    notePath = prepared.preview.intendedPaths[2]!
    auditPath = prepared.preview.intendedPaths.at(-1)!

    const receipt = await adapter.confirm(prepared)

    expect(receipt).toMatchObject({ status: 'partial' })
    expect(receipt.updatedPaths).toContain('index.md')
    expect(receipt.createdPaths).toContain(notePath)
    expect(receipt.createdPaths).toContain(auditPath)
    expect(receipt.auditPath).toBeNull()
    expect(await readFile(join(root, 'index.md'), 'utf8')).toBe('# Concurrent user index edit\n')
    expect(await readFile(join(root, notePath), 'utf8')).toBe('# Concurrent user note edit\n')
    expect(await readFile(join(root, auditPath), 'utf8')).toBe('# Concurrent user audit edit\n')
    await adapter.dispose(prepared)
  })

  it('continues a sidecar-only record because it is not a PDF archive duplicate', async () => {
    const root = await makeVault()
    await writeFile(
      join(root, 'raw/paper_records/Legacy_Name.md'),
      '---\narxiv_id: "2608.00001"\narxiv_link: "https://arxiv.org/abs/2608.00001v1"\npdf_link: "https://arxiv.org/pdf/2608.00001v1"\nrelevance: 5\nmanual_field: keep-me\n---\n\nHuman notes must survive.\n'
    )
    const options = fixtureOptions(root)
    options.runCodex.mockImplementation(async () => ({
      level: 'L2',
      routingRationale: 'Fixture route.',
      domain: 'Model_Compression',
      shortIdentifier: 'SidecarContinuation',
      relatedPaths: ['Topics/Edge_AI.md'],
      noteMarkdown:
        '---\ntype: paper-note\nlevel: L2\ndate: 2026-08-21\nstatus: unread\nread_date:\nsource_access: full-text\ntags:\n  - type/paper-note\n  - level/l2\n  - status/unread\nrelated:\n  - "[[Topics/Edge_AI]]"\n---\n# Continuation\n\narXiv 2608.00001\nhttps://arxiv.org/abs/2608.00001\nraw/papers/Legacy_Name.pdf\n\n## Provenance\nVerified PDF.\n'
    }))
    const adapter = new LlmWikiVaultAdapter(options)
    const versionedPaper = {
      ...paper,
      id: 'arxiv:2608.00001v2',
      externalId: '2608.00001v2',
      url: 'https://arxiv.org/abs/2608.00001v2'
    }

    const prepared = await adapter.prepare(versionedPaper, {
      previewId: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-08-21T10:30:00.000Z'
    })

    expect(prepared.preview.ready).toBe(true)
    expect(prepared.preview.intendedPaths.slice(0, 2)).toEqual([
      'raw/papers/Legacy_Name.pdf',
      'raw/paper_records/Legacy_Name.md'
    ])
    expect(options.fetchPdf).toHaveBeenCalledWith('https://arxiv.org/pdf/2608.00001v2')
    const receipt = await adapter.confirm(prepared)
    expect(receipt.status).toBe('completed')
    expect(receipt.createdPaths).not.toContain('raw/paper_records/Legacy_Name.md')
    expect(receipt.updatedPaths).toContain('raw/paper_records/Legacy_Name.md')
    const mergedSidecar = await readFile(join(root, 'raw/paper_records/Legacy_Name.md'), 'utf8')
    expect(mergedSidecar).toContain('arxiv_link: "https://arxiv.org/abs/2608.00001v2"')
    expect(mergedSidecar).toContain('pdf_link: "https://arxiv.org/pdf/2608.00001v2"')
    expect(mergedSidecar).not.toContain('2608.00001v1')
    expect(mergedSidecar).toContain('source_pdf: "[[raw/papers/Legacy_Name]]"')
    expect(mergedSidecar).toContain('manual_field: keep-me')
    expect(mergedSidecar).toContain('Human notes must survive.')
    await adapter.dispose(prepared)
  })

  it('validates an L1 note and updates an existing Method related list', async () => {
    const root = await makeVault()
    await writeFile(
      join(root, 'Methods/Structured_Pruning.md'),
      '---\ntype: method\ndate: 2026-01-01\nupdated: 2026-01-01\ntags:\n  - type/method\nrelated:\n  - "[[Topics/Edge_AI]]"\n---\n# Structured Pruning\n'
    )
    const options = fixtureOptions(root)
    const runCodex = vi.fn(async () => ({
      level: 'L1' as const,
      routingRationale: 'Foundational fixture.',
      domain: 'Model_Compression',
      shortIdentifier: 'L1Fixture',
      relatedPaths: ['Methods/Structured_Pruning.md'],
      noteMarkdown:
        '---\ntype: paper-note\nlevel: L1\ndate: 2026-08-21\nupdated: 2026-08-21\nstatus: unread\nread_date:\nsource_access: full-text\ntags:\n  - type/paper-note\n  - level/l1\n  - status/unread\nrelated:\n  - "[[Methods/Structured_Pruning]]"\n---\n# L1 fixture\n\narXiv 2608.00001\nhttps://arxiv.org/abs/2608.00001\nraw/papers/Researcher et al. - 2026 - Structured pruning edge deployment.pdf\n\n## Provenance\nVerified full-text fixture.\n'
    }))
    const adapter = new LlmWikiVaultAdapter({ ...options, runCodex })
    const prepared = await adapter.prepare(paper, {
      previewId: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-08-21T10:30:00.000Z'
    })

    expect(prepared.preview).toMatchObject({ ready: true, level: 'L1' })
    const receipt = await adapter.confirm(prepared)
    expect(receipt.status).toBe('completed')
    expect(await readFile(join(root, 'Methods/Structured_Pruning.md'), 'utf8')).toContain(
      'Researcher_2026_L1Fixture'
    )
    const note = await readFile(join(root, receipt.notePath!), 'utf8')
    expect(note).toContain('  - type/paper-note\n  - level/l1\n')
    expect(note).not.toContain('  - status/unread\n')
    await adapter.dispose(prepared)
  })

  it('blocks without writing when the cooperative writer lease is rejected', async () => {
    const root = await makeVault()
    const options = fixtureOptions(root)
    options.runRuntime.mockResolvedValue({ status: 'rejected' })
    const adapter = new LlmWikiVaultAdapter(options)
    const prepared = await adapter.prepare(paper, {
      previewId: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-08-21T10:30:00.000Z'
    })

    await expect(adapter.confirm(prepared)).resolves.toMatchObject({
      status: 'blocked',
      createdPaths: [],
      updatedPaths: []
    })
    await expect(stat(join(root, prepared.preview.intendedPaths[0]!))).rejects.toMatchObject({
      code: 'ENOENT'
    })
    await adapter.dispose(prepared)
  })

  it('blocks a complete PDF and sidecar duplicate before network or Codex', async () => {
    const root = await makeVault()
    await writeFile(
      join(root, 'raw/paper_records/Legacy_Name.md'),
      '---\narxiv_id: "2608.00001"\n---\n'
    )
    await writeFile(join(root, 'raw/papers/Legacy_Name.pdf'), '%PDF-1.7\nexisting')
    const options = fixtureOptions(root)
    const adapter = new LlmWikiVaultAdapter(options)

    const prepared = await adapter.prepare(paper, {
      previewId: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-08-21T10:30:00.000Z'
    })

    expect(prepared.preview.ready).toBe(false)
    expect(prepared.preview.blockers.join(' ')).toContain('already archived')
    expect(options.fetchPdf).not.toHaveBeenCalled()
    expect(options.runCodex).not.toHaveBeenCalled()
  })

  it('rejects active or incomplete Codex note content before any vault write', async () => {
    const root = await makeVault()
    const options = fixtureOptions(root)
    options.runCodex.mockResolvedValue({
      level: 'L2',
      routingRationale: 'Fixture route.',
      domain: 'Model_Compression',
      shortIdentifier: 'UnsafeFixture',
      relatedPaths: ['Topics/Edge_AI.md'],
      noteMarkdown:
        '---\ntype: paper-note\nlevel: L2\ndate: 2026-08-21\nstatus: unread\nread_date:\nsource_access: full-text\ntags:\n  - type/paper-note\n  - level/l2\n  - status/unread\nrelated:\n  - "[[Topics/Edge_AI]]"\n---\n' +
        '# Unsafe fixture\n\narXiv 2608.00001\nhttps://arxiv.org/abs/2608.00001\nraw/papers/Researcher et al. - 2026 - Structured pruning edge deployment.pdf\n\n## Provenance\nVerified PDF.\n\n```dataviewjs\nrun()\n```\n'
    })
    const adapter = new LlmWikiVaultAdapter(options)

    const prepared = await adapter.prepare(paper, {
      previewId: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-08-21T10:30:00.000Z'
    })

    expect(prepared.preview).toMatchObject({ ready: false, intendedPaths: [] })
    expect(prepared.preview.blockers.join(' ')).toContain('active or unresolved note content')
    expect(options.runRuntime).not.toHaveBeenCalled()
  })

  it('normalizes controlled dates and rejects missing live-template sections before writing', async () => {
    const invalidDateRoot = await makeVault()
    const invalidDateOptions = fixtureOptions(invalidDateRoot)
    const validAnalysis = await invalidDateOptions.runCodex({ prompt: '', stageDirectory: '' })
    invalidDateOptions.runCodex.mockResolvedValue({
      ...validAnalysis,
      noteMarkdown: validAnalysis.noteMarkdown.replace('date: 2026-08-21', 'date: invalid')
    })
    const invalidDateAdapter = new LlmWikiVaultAdapter(invalidDateOptions)

    const invalidDate = await invalidDateAdapter.prepare(paper, {
      previewId: '11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-08-21T10:30:00.000Z'
    })
    expect(invalidDate.preview.ready).toBe(true)
    const invalidDateReceipt = await invalidDateAdapter.confirm(invalidDate)
    expect(await readFile(join(invalidDateRoot, invalidDateReceipt.notePath!), 'utf8')).toContain(
      '\ndate: 2026-08-21\n'
    )

    const missingSectionRoot = await makeVault()
    await writeFile(
      join(missingSectionRoot, 'Templates/Paper_Note_L2.md'),
      '---\nlevel: L2\n---\n# L2 template\n\n## Required contract section\n'
    )
    const missingSectionOptions = fixtureOptions(missingSectionRoot)
    const missingSectionAdapter = new LlmWikiVaultAdapter(missingSectionOptions)
    const missingSection = await missingSectionAdapter.prepare(paper, {
      previewId: '22222222-2222-4222-8222-222222222222',
      expiresAt: '2026-08-21T10:30:00.000Z'
    })
    expect(missingSection.preview.blockers.join(' ')).toContain('incomplete llm-wiki paper note')
  })
})

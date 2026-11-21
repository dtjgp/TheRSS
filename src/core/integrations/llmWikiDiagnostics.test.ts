import { lstat, mkdir, mkdtemp, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  llmWikiVaultDiagnosticsSchema,
  type LlmWikiVaultDiagnostics
} from '../../shared/llmWikiSettings'
import { LlmWikiDaily } from './llmWikiDaily'
import {
  defaultLlmWikiVaultPath,
  diagnoseLlmWikiVault,
  resolveLlmWikiVaultLocation,
  resolveOperationalLlmWikiVaultRoot
} from './llmWikiDiagnostics'
import { LlmWikiLibrary } from './llmWikiLibrary'

const roots: string[] = []
const now = () => new Date('2026-11-21T12:00:00.000Z')

async function vault(
  options: { files?: readonly string[]; directories?: readonly string[] } = {}
): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'therss-diagnostics-')))
  roots.push(root)
  for (const directory of options.directories ?? ['raw/paper_records', 'Literature/Paper_Notes'])
    await mkdir(join(root, directory), { recursive: true })
  for (const file of options.files ?? ['AGENTS.md', '_schema.md'])
    await writeFile(join(root, file), '# fixture')
  return root
}

async function tree(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  return entries.map((entry) => `${entry.parentPath}/${entry.name}`).sort()
}

function check(diagnostics: LlmWikiVaultDiagnostics, id: string) {
  return diagnostics.checks.find((candidate) => candidate.id === id)
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('llm-wiki vault location', () => {
  it('uses the default Obsidian folder under the home directory', () => {
    expect(defaultLlmWikiVaultPath()).toBe(join(homedir(), 'Obsidian', 'llm-wiki'))
  })

  it('applies environment, then saved custom, then default precedence', () => {
    const defaultPath = '/Users/alice/Obsidian/llm-wiki'
    expect(
      resolveLlmWikiVaultLocation({
        customPath: '/vaults/custom',
        envPath: ' /vaults/env ',
        defaultPath
      })
    ).toEqual({
      resolvedPath: '/vaults/env',
      origin: 'env',
      customPath: '/vaults/custom',
      envOverridePath: '/vaults/env',
      defaultPath
    })
    expect(
      resolveLlmWikiVaultLocation({ customPath: '/vaults/custom/', envPath: '   ', defaultPath })
    ).toMatchObject({ resolvedPath: '/vaults/custom', origin: 'custom', envOverridePath: null })
    expect(
      resolveLlmWikiVaultLocation({ customPath: null, envPath: undefined, defaultPath })
    ).toMatchObject({ resolvedPath: defaultPath, origin: 'default', customPath: null })
  })

  it('rejects an invalid saved custom path instead of guessing a folder', () => {
    expect(() =>
      resolveLlmWikiVaultLocation({
        customPath: 'relative/vault',
        envPath: undefined,
        defaultPath: '/vaults/default'
      })
    ).toThrow()
  })
})

describe('llm-wiki vault diagnostics', () => {
  it('reports a complete custom vault as ready without changing it', async () => {
    const root = await vault()
    const before = await tree(root)
    const diagnostics = await diagnoseLlmWikiVault({
      customPath: root,
      envPath: undefined,
      defaultPath: '/vaults/default',
      now
    })

    expect(llmWikiVaultDiagnosticsSchema.parse(diagnostics)).toEqual(diagnostics)
    expect(diagnostics).toMatchObject({
      resolvedPath: root,
      origin: 'custom',
      status: 'ready',
      checkedAt: '2026-11-21T12:00:00.000Z'
    })
    expect(diagnostics.checks.map(({ id, status }) => [id, status])).toEqual([
      ['vault-root', 'ok'],
      ['required-files', 'ok'],
      ['paper-directories', 'ok']
    ])
    expect(diagnostics.checks.every((item) => item.remediation === null)).toBe(true)
    expect(await tree(root)).toEqual(before)
  })

  it('reports a missing vault folder as unavailable with a remediation and no writes', async () => {
    const parent = await vault()
    const missing = join(parent, 'missing-vault')
    const diagnostics = await diagnoseLlmWikiVault({
      customPath: missing,
      envPath: undefined,
      defaultPath: '/vaults/default',
      now
    })

    expect(diagnostics.status).toBe('unavailable')
    expect(diagnostics.checks.map((item) => item.id)).toEqual(['vault-root'])
    expect(check(diagnostics, 'vault-root')).toMatchObject({
      status: 'error',
      detail: expect.stringContaining('does not exist'),
      remediation: expect.stringContaining('Choose folder')
    })
    expect(await tree(parent)).not.toContain(missing)
  })

  it('rejects a symlinked or non-directory vault root', async () => {
    const root = await vault()
    const link = `${root}-link`
    roots.push(link)
    await symlink(root, link)
    const linked = await diagnoseLlmWikiVault({ customPath: link, envPath: undefined, now })
    expect(linked.status).toBe('unavailable')
    expect(check(linked, 'vault-root')?.detail).toContain('symbolic link')

    const file = join(root, 'AGENTS.md')
    const notDirectory = await diagnoseLlmWikiVault({ customPath: file, envPath: undefined, now })
    expect(notDirectory.status).toBe('unavailable')
    expect(check(notDirectory, 'vault-root')?.detail).toContain('not a folder')
  })

  it('reports missing or symlinked rules files and paper folders as incomplete', async () => {
    const root = await vault({ files: ['_schema.md'], directories: ['raw'] })
    await writeFile(join(root, 'real-agents.md'), '# outside')
    await symlink(join(root, 'real-agents.md'), join(root, 'AGENTS.md'))
    await mkdir(join(root, 'elsewhere'))
    await symlink(join(root, 'elsewhere'), join(root, 'raw', 'paper_records'))
    const diagnostics = await diagnoseLlmWikiVault({ customPath: root, envPath: undefined, now })

    expect(diagnostics.status).toBe('incomplete')
    expect(check(diagnostics, 'vault-root')?.status).toBe('ok')
    expect(check(diagnostics, 'required-files')).toMatchObject({
      status: 'error',
      detail: expect.stringContaining('AGENTS.md'),
      remediation: expect.any(String)
    })
    expect(check(diagnostics, 'required-files')?.detail).not.toContain('_schema.md')
    const folders = check(diagnostics, 'paper-directories')
    expect(folders).toMatchObject({ status: 'error', remediation: expect.any(String) })
    expect(folders?.detail).toContain('raw/paper_records')
    expect(folders?.detail).toContain('Literature/Paper_Notes')
  })

  it('warns when the environment variable overrides a saved folder', async () => {
    const root = await vault()
    const diagnostics = await diagnoseLlmWikiVault({
      customPath: '/vaults/saved',
      envPath: root,
      defaultPath: '/vaults/default',
      now
    })

    expect(diagnostics).toMatchObject({
      origin: 'env',
      resolvedPath: root,
      envOverridePath: root,
      customPath: '/vaults/saved',
      status: 'ready'
    })
    expect(check(diagnostics, 'env-override')).toMatchObject({
      status: 'warning',
      detail: expect.stringContaining('THERSS_LLM_WIKI_PATH'),
      remediation: expect.stringContaining('THERSS_LLM_WIKI_PATH')
    })
    const withoutSaved = await diagnoseLlmWikiVault({ customPath: null, envPath: root, now })
    expect(check(withoutSaved, 'env-override')).toBeUndefined()
  })

  it('does not inspect an unsafe, tab-padded, or overlong environment path', async () => {
    const existing = await vault()
    const cases = [
      'relative/../vault',
      `\t${existing}`,
      `${existing}\t`,
      `${existing}/${'a'.repeat(1_005)}`,
      `${existing} /.`,
      `${existing} /`
    ]
    const lstatSpy = vi.fn((path: string) => lstat(path))
    for (const envPath of cases) {
      const diagnostics = await diagnoseLlmWikiVault({
        customPath: null,
        envPath,
        now,
        fs: { lstat: lstatSpy, realpath }
      })
      expect(diagnostics).toMatchObject({ origin: 'env', status: 'unavailable' })
      expect(check(diagnostics, 'vault-root')).toMatchObject({
        status: 'error',
        detail: expect.stringContaining('absolute'),
        remediation: expect.stringContaining('THERSS_LLM_WIKI_PATH')
      })
      expect(() =>
        resolveOperationalLlmWikiVaultRoot({
          customPath: existing,
          envPath,
          defaultPath: '/vaults/default'
        })
      ).toThrow('THERSS_LLM_WIKI_PATH')
    }
    expect(lstatSpy).not.toHaveBeenCalled()
    expect(
      resolveOperationalLlmWikiVaultRoot({
        customPath: existing,
        envPath: '   ',
        defaultPath: '/vaults/default'
      })
    ).toBe(existing)
    expect(
      resolveOperationalLlmWikiVaultRoot({
        customPath: null,
        envPath: existing,
        defaultPath: '/vaults/default'
      })
    ).toBe(existing)
  })

  it('rejects an ancestor symlink in the configured vault path without inspecting inside', async () => {
    const parent = await realpath(await mkdtemp(join(tmpdir(), 'therss-diag-parent-')))
    roots.push(parent)
    const realBase = join(parent, 'real')
    const realVault = join(realBase, 'vault')
    await mkdir(join(realVault, 'raw/paper_records'), { recursive: true })
    await mkdir(join(realVault, 'Literature/Paper_Notes'), { recursive: true })
    await mkdir(join(realVault, 'Literature/Digests/ArXiv_Daily'), { recursive: true })
    await writeFile(join(realVault, 'AGENTS.md'), '# fixture')
    await writeFile(join(realVault, '_schema.md'), '# fixture')
    const alias = join(parent, 'alias')
    await symlink(realBase, alias)

    const diagnostics = await diagnoseLlmWikiVault({
      customPath: join(alias, 'vault'),
      envPath: undefined,
      now
    })
    expect(diagnostics.status).toBe('unavailable')
    expect(diagnostics.checks.map((item) => item.id)).toEqual(['vault-root'])
    expect(check(diagnostics, 'vault-root')?.detail).toContain('symbolic link')

    // Dot and repeated-separator spellings of the real regular directory normalize cleanly and pass.
    const dotted = `${realBase}/./vault//.`
    const repeated = `${realBase}///vault//`
    for (const variant of [dotted, repeated]) {
      const ok = await diagnoseLlmWikiVault({ customPath: variant, envPath: undefined, now })
      expect(ok.status).toBe('ready')
      expect(ok.resolvedPath).toBe(realVault)
    }

    // Operational readers pass on the real vault, and reject the same vault behind a symlink ancestor.
    const realDaily = new LlmWikiDaily({ vaultRoot: realVault, openExternal: vi.fn() })
    expect((await realDaily.snapshot()).status).toBe('missing')
    const aliasedRoot = join(alias, 'vault')
    const library = new LlmWikiLibrary({ vaultRoot: aliasedRoot, openExternal: vi.fn() })
    expect((await library.status({ arxivId: '2610.00001' })).status).toBe('unavailable')
    const daily = new LlmWikiDaily({ vaultRoot: aliasedRoot, openExternal: vi.fn() })
    expect((await daily.snapshot()).status).toBe('unavailable')
  })

  it('returns structured unavailable when realpath fails after lstat succeeds', async () => {
    const root = await vault()
    const diagnostics = await diagnoseLlmWikiVault({
      customPath: root,
      envPath: undefined,
      now,
      fs: {
        lstat: (path: string) => lstat(path),
        realpath: async () => {
          throw Object.assign(new Error('vanished'), { code: 'ENOENT' })
        }
      }
    })
    expect(diagnostics.status).toBe('unavailable')
    expect(check(diagnostics, 'vault-root')?.detail).toContain('does not exist')
  })
})

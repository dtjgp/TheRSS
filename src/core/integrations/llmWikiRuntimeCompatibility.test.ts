import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { auditRecord } from './llmWikiVaultSupport'
import { TRUSTED_AUTOMATION_RUNTIME_SHA256 } from './llmWikiVaultTypes'

const script = resolve('tests/fixtures/llm-wiki/automation_runtime.py')
const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'therss-runtime-compat-'))
  roots.push(root)
  const config = join(root, 'config.json'),
    state = join(root, 'state.json')
  await writeFile(
    config,
    JSON.stringify({
      schema_version: 1,
      terminal_statuses: ['completed', 'partial', 'blocked'],
      automations: { 'therss-paper-promotion': { lock_scopes: ['raw/papers'] } }
    })
  )
  const run = (...args: string[]) => {
    try {
      return JSON.parse(
        execFileSync('python3', [script, '--config', config, '--state', state, ...args], {
          cwd: root,
          encoding: 'utf8'
        })
      )
    } catch (error) {
      if (error && typeof error === 'object' && 'stdout' in error)
        return JSON.parse(String(error.stdout))
      throw error
    }
  }
  return { root, run }
}

describe('reviewed llm-wiki runtime compatibility', () => {
  it('pins the reviewed strict-audit runtime bytes', async () => {
    expect(
      createHash('sha256')
        .update(await readFile(script))
        .digest('hex')
    ).toBe(TRUSTED_AUTOMATION_RUNTIME_SHA256)
  })
  it.each(['completed', 'partial', 'blocked'] as const)(
    'releases an isolated lease using the application %s audit',
    async (status) => {
      const { root, run } = await fixture()
      expect(run('begin', 'therss-paper-promotion', 'fixture-owner').status).toBe('acquired')
      const audit = join(root, 'audit.md')
      await writeFile(
        audit,
        auditRecord({
          status,
          arxivId: '2608.00001',
          startedAt: '2026-10-28T12:00:00Z',
          completedAt: '2026-10-28T12:01:00Z',
          actions: ['Fixture verification.'],
          createdPaths: [],
          updatedPaths: [],
          blockers: [],
          finalResponse: 'Fixture only.'
        })
      )
      expect(
        run('finish', 'therss-paper-promotion', 'fixture-owner', status, '--audit-record', audit)
          .status
      ).toBe('released')
      expect(run('status').leases).toEqual([])
    }
  )
  it('retains ownership when the audit is missing or its outcome does not match', async () => {
    const { root, run } = await fixture()
    run('begin', 'therss-paper-promotion', 'fixture-owner')
    expect(run('finish', 'therss-paper-promotion', 'fixture-owner', 'completed').error).toContain(
      'missing_audit_record'
    )
    const audit = join(root, 'audit.md')
    await writeFile(audit, '---\nstatus: partial\n---\n- **Status:** partial\n')
    expect(
      run('finish', 'therss-paper-promotion', 'fixture-owner', 'completed', '--audit-record', audit)
        .error
    ).toContain('audit_terminal_status_mismatch')
    expect(run('begin', 'therss-paper-promotion', 'other-owner').error).toContain('scope_conflict')
    expect(
      run('finish', 'therss-paper-promotion', 'fixture-owner', 'partial', '--audit-record', audit)
        .status
    ).toBe('released')
  })
})

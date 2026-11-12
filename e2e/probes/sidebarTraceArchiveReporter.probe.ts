import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import type { TestCase, TestResult } from '@playwright/test/reporter'
import SidebarTraceArchiveReporter from '../support/sidebarTraceArchiveReporter'

// Node-only regression for the trace archive reporter. It starts no Electron app, browser or GUI.
// Its files live in a unique directory under test-results/ and are removed at the end.

const RECORDS = 'test-results/sidebar-diagnostics'
const sha256 = (content: Buffer) => createHash('sha256').update(content).digest('hex')

async function scratchRoot(): Promise<string> {
  const root = resolve('test-results/sidebar-trace-reporter-regression', randomUUID())
  await mkdir(root, { recursive: true })
  return root
}

function failedResult(correlationId: string, directory: string, trace: string): TestResult {
  const body = JSON.stringify({ correlationId, trace: { archiveDirectory: directory } })
  return {
    status: 'failed',
    attachments: [
      { name: 'sidebar-diagnostics', contentType: 'application/json', body: Buffer.from(body) },
      { name: 'trace', contentType: 'application/zip', path: trace }
    ]
  } as unknown as TestResult
}

test('the archive reporter rejects a mismatched record and still archives the matched one', async () => {
  const root = await scratchRoot()
  const previous = process.cwd()
  try {
    process.chdir(root)
    const directory = join(RECORDS, 'record')
    await mkdir(directory, { recursive: true })
    const record = Buffer.from(JSON.stringify({ correlationId: 'right-id' }))
    await writeFile(join(directory, 'diagnostics.json'), record)
    await mkdir('out', { recursive: true })
    const trace = resolve('out/trace.zip')
    await writeFile(trace, 'trace bytes')
    const reporter = new SidebarTraceArchiveReporter()
    const testCase = { title: 'fixture' } as unknown as TestCase

    const mismatched = failedResult('wrong-id', directory, trace)
    const mismatchedBefore = structuredClone(mismatched)
    expect(() => reporter.onTestEnd(testCase, mismatched)).not.toThrow()
    expect(await readdir(directory)).toEqual(['diagnostics.json'])
    expect(await readFile(join(directory, 'diagnostics.json'))).toEqual(record)
    expect(mismatched).toEqual(mismatchedBefore)

    const matched = failedResult('right-id', directory, trace)
    const matchedBefore = structuredClone(matched)
    expect(() => reporter.onTestEnd(testCase, matched)).not.toThrow()
    expect((await readdir(directory)).sort()).toEqual([
      'diagnostics.json',
      'trace-archive.json',
      'trace.zip'
    ])
    const status = JSON.parse(await readFile(join(directory, 'trace-archive.json'), 'utf8'))
    expect(status).toMatchObject({
      correlationId: 'right-id',
      recordMatches: true,
      state: 'copied',
      sha256: sha256(await readFile(trace))
    })
    expect(await readFile(join(directory, 'trace.zip'))).toEqual(await readFile(trace))
    expect(await readFile(join(directory, 'diagnostics.json'))).toEqual(record)
    expect(matched).toEqual(matchedBefore)
  } finally {
    process.chdir(previous)
    await rm(root, { recursive: true, force: true })
  }
})

const INNER_SPEC = `import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
const directory = 'test-results/sidebar-diagnostics/record'
const attach = (correlationId) =>
  test.info().attach('sidebar-diagnostics', {
    body: JSON.stringify({ correlationId, trace: { archiveDirectory: directory } }),
    contentType: 'application/json'
  })
test('mismatched record', async () => {
  mkdirSync(directory, { recursive: true })
  writeFileSync(directory + '/diagnostics.json', JSON.stringify({ correlationId: 'right-id' }))
  await attach('wrong-id')
  expect('mismatched', 'fails on purpose').toBe('failure')
})
test('matched record', async () => {
  expect(existsSync(directory + '/diagnostics.json')).toBe(true)
  await attach('right-id')
  expect('matched', 'fails on purpose').toBe('failure')
})
test('no record', () => {
  expect(1).toBe(1)
})
`

function innerConfig(withArchive: boolean): string {
  const archive = resolve('e2e/support/sidebarTraceArchiveReporter.ts')
  const reporters = [`['json', { outputFile: 'report.json' }]`]
  if (withArchive) reporters.push(`[${JSON.stringify(archive)}]`)
  return `export default {
  testDir: '.',
  testMatch: 'inner.spec.mjs',
  outputDir: 'test-results/inner',
  workers: 1,
  retries: 0,
  reporter: [${reporters.join(', ')}],
  use: { trace: 'retain-on-failure' }
}
`
}

interface InnerRun {
  readonly exit: number | null
  readonly stderr: string
  readonly statuses: string[]
  readonly matchedTrace: string | undefined
}

async function runInner(root: string, withArchive: boolean): Promise<InnerRun> {
  await writeFile(join(root, 'inner.spec.mjs'), INNER_SPEC)
  await writeFile(join(root, 'inner.config.mjs'), innerConfig(withArchive))
  // A clean environment, so the nested runner does not inherit this worker's settings.
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^(TEST_|PW_|PLAYWRIGHT_)/u.test(key) && key !== 'NODE_OPTIONS'
    )
  )
  const run = spawnSync(
    process.execPath,
    [resolve('node_modules/@playwright/test/cli.js'), 'test', '-c', 'inner.config.mjs'],
    { cwd: root, env: environment, encoding: 'utf8', timeout: 60_000 }
  )
  const report = JSON.parse(await readFile(join(root, 'report.json'), 'utf8')) as {
    suites: Array<{
      specs: Array<{
        title: string
        tests: Array<{
          results: Array<{ status: string; attachments: Array<{ name: string; path?: string }> }>
        }>
      }>
    }>
  }
  const specs = report.suites.flatMap((suite) => suite.specs)
  const results = specs.map((spec) => spec.tests[0]?.results[0])
  const matched = specs.findIndex((spec) => spec.title === 'matched record')
  return {
    exit: run.status,
    stderr: run.stderr,
    statuses: results.map((result) => result?.status ?? 'missing'),
    matchedTrace: results[matched]?.attachments.find((entry) => entry.name === 'trace')?.path
  }
}

test('the archive reporter changes neither results nor the exit code of a real run', async () => {
  const control = await scratchRoot()
  const archived = await scratchRoot()
  try {
    const without = await runInner(control, false)
    const withArchive = await runInner(archived, true)
    expect(without.statuses).toEqual(['failed', 'failed', 'passed'])
    expect(withArchive.statuses).toEqual(without.statuses)
    expect(without.exit).toBe(1)
    expect(withArchive.exit).toBe(without.exit)

    const directory = join(archived, RECORDS, 'record')
    const status = JSON.parse(await readFile(join(directory, 'trace-archive.json'), 'utf8'))
    expect(status).toMatchObject({
      correlationId: 'right-id',
      recordMatches: true,
      state: 'copied'
    })
    // The archived trace is the matched test's own trace, not the mismatched test's.
    expect(withArchive.matchedTrace).toBeDefined()
    const source = await readFile(String(withArchive.matchedTrace))
    const copy = await readFile(join(directory, 'trace.zip'))
    expect(sha256(copy)).toBe(sha256(source))
    expect(status.sha256).toBe(sha256(source))
    expect(await readdir(join(control, RECORDS, 'record'))).toEqual(['diagnostics.json'])
    expect(withArchive.stderr).toContain(
      'sidebar trace archive: rejected wrong-id: record ID differs'
    )
  } finally {
    await rm(control, { recursive: true, force: true })
    await rm(archived, { recursive: true, force: true })
  }
})

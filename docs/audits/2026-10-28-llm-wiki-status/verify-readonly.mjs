/** Opt-in actual-vault navigation rehearsal. No live source/model calls or vault writes. */
import { build } from 'esbuild'
import electronPath from 'electron'
import { _electron as electron } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import console from 'node:console'

if (!process.argv.includes('--live')) {
  console.log(
    'Use --live to launch the built native app with a disposable database and the actual read-only llm-wiki. Use q to close it after UI verification.'
  )
  process.exit(0)
}
const project = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const output = join(project, 'test-results/llm-wiki-readonly')
await mkdir(output, { recursive: true })
const profile = await mkdtemp(join(tmpdir(), 'therss-wiki-readonly-'))
const matrix = process.argv.includes('--matrix')
const seed = join(output, 'seed.cjs')
await build({
  stdin: {
    resolveDir: project,
    contents: `
      import Database from 'better-sqlite3';
      import { join } from 'node:path';
      import { ResearchRepository } from './src/core/storage/researchRepository';
      const database = new Database(join(process.argv[2], 'therss.sqlite'));
      const repository = new ResearchRepository(database);
      const item = { id:'arxiv:2610.11302', source:'arxiv', kind:'paper', externalId:'2610.11302', title:'iCATS — read-only llm-wiki verification', summary:'Validation sample: opens an existing local paper note. No new source search or analysis was run.', url:'https://arxiv.org/abs/2610.11302', publishedAt:'2026-10-08T00:00:00Z', updatedAt:'2026-10-08T00:00:00Z', authors:[], categories:[], topics:[], language:null, stars:null, metrics:{} };
      const items = [item, ...(${matrix} ? [
        {...item, id:'arxiv:2602.03060', externalId:'2602.03060', title:'Record only — read-only llm-wiki verification', url:'https://arxiv.org/abs/2602.03060'},
        {...item, id:'arxiv:9912.99999', externalId:'9912.99999', title:'Absent record — verification sample (synthetic ID)', url:'https://arxiv.org/abs/9912.99999'},
        {...item, id:'github:dtjgp/TheRSS', source:'github', kind:'repository', externalId:'dtjgp/TheRSS', title:'Non-paper — read-only llm-wiki verification', url:'https://github.com/dtjgp/TheRSS'}
      ] : [])];
      repository.upsertRankedItems(items.map(item => ({item,score:0,excluded:false,reasons:[]})));
      for (const item of items) repository.setTriageState(item.id,'saved');
      database.close();
    `,
    loader: 'ts'
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: seed,
  external: ['better-sqlite3']
})
execFileSync(electronPath, [seed, profile], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  timeout: 30_000,
  stdio: 'pipe'
})
const env = {
  ...process.env,
  THERSS_UI: 'appkit',
  THERSS_LLM_WIKI_PATH: '/Users/dtjgp/Obsidian/llm-wiki'
}
delete env.THERSS_E2E_FIXTURES
delete env.ELECTRON_RUN_AS_NODE
const isolatedBundle = process.argv.includes('--isolated-bundle')
if (isolatedBundle && !process.argv.includes('--packaged'))
  throw new Error('--isolated-bundle requires --packaged')
let executablePath = join(project, 'release/mac-arm64/TheRSS.app/Contents/MacOS/TheRSS')
let verificationBundle = null
if (isolatedBundle) {
  verificationBundle = join(profile, 'TheRSS Verification.app')
  await cp(join(project, 'release/mac-arm64/TheRSS.app'), verificationBundle, {
    recursive: true,
    verbatimSymlinks: true
  })
  const plist = join(verificationBundle, 'Contents/Info.plist')
  // Keep the product name: Electron derives its helper-app names from it.
  execFileSync(
    '/usr/libexec/PlistBuddy',
    ['-c', 'Set :CFBundleIdentifier dev.dtjgp.therss.verification', plist],
    { stdio: 'pipe' }
  )
  // Seal only the disposable copy after changing its identity. Preserve Electron's
  // existing runtime/entitlement metadata; no signing identity or system setting changes.
  execFileSync(
    '/usr/bin/codesign',
    [
      '--force',
      '--deep',
      '--sign',
      '-',
      '--preserve-metadata=entitlements,flags,runtime',
      verificationBundle
    ],
    { stdio: 'pipe' }
  )
  executablePath = join(verificationBundle, 'Contents/MacOS/TheRSS')
}
const application = await electron.launch({
  ...(process.argv.includes('--packaged') ? { executablePath } : {}),
  args: [`--user-data-dir=${profile}`, ...(process.argv.includes('--packaged') ? [] : [project])],
  env,
  timeout: 30_000
})
const page = await application.firstWindow()
const receipt = {
  mode: 'actual read-only vault; production service/API/UI; disposable app database',
  profile,
  verificationBundle,
  matrix,
  pid: application.process().pid,
  liveSourceCalls: false,
  modelCalls: false,
  vaultWrites: false
}
await writeFile(join(output, 'launch.json'), JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify({ ready: true, ...receipt }))
if (process.argv.includes('--open-existing')) {
  // Exercise the production preload/IPC/service boundary. The fixture native smoke
  // separately exercises the button's action; this mode never enables fixture services.
  const opened = await page.evaluate(async () => {
    const request = { arxivId: '2610.11302', refresh: true }
    const status = await globalThis.therss.getLlmWikiStatus(request)
    if (status.status !== 'recorded' || !status.notePath) throw new Error('Expected existing note')
    return { status, result: await globalThis.therss.openLlmWikiNote(request.arxivId) }
  })
  await writeFile(join(output, 'opened-existing.json'), JSON.stringify(opened, null, 2) + '\n')
  console.log(JSON.stringify(opened))
}
console.log('Awaiting native/Obsidian UI verification. Type q to close only this rehearsal app.')
await new Promise((done) => {
  process.stdin.resume()
  process.stdin.on('data', (data) => {
    if (String(data).includes('q')) done()
  })
})
await application.close()
process.stdin.pause()
if (verificationBundle) await rm(verificationBundle, { recursive: true, force: true })

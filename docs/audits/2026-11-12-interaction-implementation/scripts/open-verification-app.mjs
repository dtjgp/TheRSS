/* global setTimeout -- used inside Electron main-process evaluate callbacks */
/**
 * Prepares and leaves open an isolated native TheRSS for manual (physical mouse/keyboard)
 * verification of the 2026-11-12 slices. Synthetic data only; no live source, model, real vault,
 * installed app or daily database. Run from the project root after `npm run build`:
 *   node docs/audits/2026-11-12-interaction-implementation/scripts/open-verification-app.mjs [daily-status]
 * daily-status: no-source (default) | completed-empty | partial | missing | unavailable.
 * Close the app normally (Command-Q) when done; delete the printed profile and vault afterwards.
 */
import { execFileSync, spawn } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const project = process.cwd()
const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(project, 'package.json'))
const { _electron: electron } = require('@playwright/test')
const status = process.argv[2] ?? 'no-source'
const profile = await mkdtemp(join(tmpdir(), 'therss-cua-profile-'))
const vault = await mkdtemp(join(tmpdir(), 'therss-cua-vault-'))
const electronApp = resolve(project, 'node_modules/electron/dist/Electron.app')
const binary = join(electronApp, 'Contents/MacOS/Electron')
const find = (node, id) =>
  !node
    ? null
    : node.id === id
      ? node
      : (node.children || []).map((child) => find(child, id)).find(Boolean) || null

// 1. One fixture Discover run creates a valid persisted session without network calls.
{
  const application = await electron.launch({
    args: [`--user-data-dir=${profile}`, project],
    env: {
      ...process.env,
      THERSS_UI: 'appkit',
      THERSS_E2E_FIXTURES: '1',
      THERSS_E2E_LOCALE: 'en-US',
      THERSS_LLM_WIKI_PATH: vault
    },
    timeout: 30000
  })
  try {
    await (await application.firstWindow()).waitForLoadState()
    await application.evaluate(({ app, BrowserWindow, shell }) => {
      const { createRequire: load } = process.getBuiltinModule('node:module')
      globalThis.__bridge = load(app.getAppPath() + '/package.json')(
        app.getAppPath() + '/out/native-appkit/therss-ui.node'
      )
      globalThis.__window = BrowserWindow.getAllWindows()[0]
      shell.openExternal = async () => {}
    })
    const inspect = () =>
      application.evaluate(() =>
        JSON.parse(globalThis.__bridge.inspect(globalThis.__window.getNativeWindowHandle()))
      )
    const act = (id, action, value) =>
      application.evaluate(
        (_, data) =>
          globalThis.__bridge.interactFixture(
            globalThis.__window.getNativeWindowHandle(),
            JSON.stringify(data)
          ),
        { id, action, ...(value === undefined ? {} : { value }) }
      )
    const wait = async (id, predicate) => {
      for (let count = 0; count < 300; count++) {
        const state = await inspect().catch(() => null)
        if (state && predicate(find(state.root, id))) return
        await new Promise((done) => setTimeout(done, 100))
      }
      throw new Error(`Setup did not reach ${id}`)
    }
    await wait('discover-query', (node) => node?.enabled === true)
    await act('discover-query', 'fill', 'Synthetic structured pruning check')
    await act('discover-runner', 'choose', 'codex')
    await wait('discover-search', (node) => node?.enabled !== false)
    await act('discover-search', 'click')
    await wait('discover-results', (node) => node?.rows?.length > 0)
  } finally {
    await application.close().catch(() => {})
  }
}

// 2. Synthetic rows: 5 older Saved items, 30 newer session rows and 30 newer analyses.
const seed = `
const Database = require(${JSON.stringify(require.resolve('better-sqlite3'))})
const db = new Database(${JSON.stringify(join(profile, 'therss.sqlite'))})
const session = db.prepare('SELECT id FROM discover_session ORDER BY created_at DESC LIMIT 1').get()
const at = (minutes) => new Date(Date.UTC(2026, 10, 1) + minutes * 60000).toISOString()
const item = db.prepare(\`INSERT INTO discovery_item(
  id, source, item_kind, external_id, title, summary, url, published_at, updated_at,
  authors_json, categories_json, topics_json, language, stars, score, excluded,
  reasons_json, in_daily_inbox, triage_state, triage_updated_at, first_seen_at, last_seen_at
) VALUES (?, 'arxiv', 'paper', ?, ?, ?, ?, ?, ?, '[]', '[]', '[]', NULL, NULL, 50, 0, '[]', 0, ?, ?, ?, ?)\`)
for (let i = 0; i < 5; i++) {
  const id = 'arxiv:2610.9000' + i
  const title = i === 0
    ? 'Synthetic saved record: a deliberately long title about structured pruning, semantic communication and resource-efficient edge intelligence that must wrap without clipping'
    : 'Synthetic saved record ' + i + ' on structured pruning'
  item.run(id, '2610.9000' + i, title, 'Synthetic saved summary for the local search scope check.', 'https://arxiv.org/abs/2610.9000' + i, at(i), at(i), 'saved', at(i), at(i), at(i))
}
const result = db.prepare(\`INSERT INTO discover_result(
  session_id, item_id, source, item_kind, external_id, title, summary, url,
  published_at, updated_at, authors_json, categories_json, topics_json,
  language, stars, score, reasons_json, result_rank
) VALUES (?, ?, 'arxiv', 'paper', ?, ?, ?, ?, ?, ?, '[]', '[]', '[]', NULL, NULL, 10, '[]', ?)\`)
for (let i = 0; i < 30; i++) {
  const id = 'arxiv:2610.8' + String(i).padStart(3, '0')
  result.run(session.id, id, id.slice(6), 'Synthetic session record ' + i + ' on structured pruning', 'Synthetic session summary.', 'https://arxiv.org/abs/' + id.slice(6), at(500), at(500), 100 + i)
}
const analysis = db.prepare(\`INSERT INTO analysis_artifact(
  id, item_id, provider_id, provider_name, model, prompt_version, source_hash, content,
  input_tokens, output_tokens, created_at
) VALUES (?, ?, 'local-agent:codex', 'Synthetic agent', 'synthetic-model', 'discovery-analysis-v1', ?, 'Synthetic derived notes on structured pruning.', NULL, NULL, ?)\`)
for (let i = 0; i < 30; i++) {
  const id = 'arxiv:2610.7' + String(i).padStart(3, '0')
  item.run(id, id.slice(6), 'Synthetic analysed record ' + i + ' on structured pruning', 'Synthetic summary.', 'https://arxiv.org/abs/' + id.slice(6), at(600), at(600), 'new', at(600), at(600), at(600))
  analysis.run('synthetic-analysis-' + i, id, 'a'.repeat(64), at(700 + i))
}
db.close()
`
execFileSync(join(project, 'node_modules/.bin/electron'), ['-e', seed], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  stdio: 'inherit'
})

// 3. Synthetic vault with today's digest for the read-only Daily reader.
const today = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date())
const digestFile = join(vault, `Literature/Digests/ArXiv_Daily/ArXiv_Daily_${today}.md`)
await mkdir(dirname(digestFile), { recursive: true })
await writeFile(join(vault, 'AGENTS.md'), '# Synthetic vault for TheRSS verification\n')
await writeFile(join(vault, '_schema.md'), '# Synthetic schema\n')
const digest = (runStatus, scanned) =>
  `---\ntype: feed\nsource: arxiv\ndate: '${today}'\nrun_status: ${runStatus}\n${scanned}selected: 0\n---\n\n# Synthetic ArXiv Daily\n\n## Selected papers\n\n## Ledger\n\nSynthetic.\n`
const digests = {
  'no-source': digest('no-source', ''),
  'completed-empty': digest('completed', 'scanned: 412\n'),
  partial: digest('partial', 'scanned: 412\n'),
  unavailable: 'not a digest',
  missing: null
}
if (!(status in digests)) throw new Error(`Unknown daily status: ${status}`)
if (digests[status] !== null) await writeFile(digestFile, digests[status])

// 4. The persistent app: real services (no fixture mode), real scope SQL, real Daily reader on
// the synthetic vault, a non-fixture native host for physical input, and no external opening.
const openLog = join(profile, 'intercepted-open-external.jsonl')
const appLog = join(profile, 'app-stdio.log')
const { openSync } = await import('node:fs')
const stdio = openSync(appLog, 'a')
const environment = { ...process.env, THERSS_UI: 'appkit', THERSS_LLM_WIKI_PATH: vault }
delete environment.THERSS_E2E_FIXTURES
delete environment.ELECTRON_RUN_AS_NODE
environment.THERSS_OPEN_EXTERNAL_LOG = openLog
const child = spawn(
  binary,
  ['-r', join(here, 'intercept-open-external.cjs'), `--user-data-dir=${profile}`, project],
  { env: environment, detached: true, stdio: ['ignore', stdio, stdio] }
)
child.unref()
const summary = {
  pid: child.pid,
  electronApp,
  binary,
  project,
  profile,
  database: join(profile, 'therss.sqlite'),
  vault,
  digestFile,
  dailyStatus: status,
  openExternalLog: openLog,
  appLog
}
await writeFile(join(profile, 'verification-app.json'), `${JSON.stringify(summary, null, 2)}\n`)
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)

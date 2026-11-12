/**
 * Prepares and opens an isolated native TheRSS for manual review of My sources. The default
 * preference uses the real SQLite store; Discover planning and source retrieval are the built-in
 * fixtures, so Search makes no network or model call. Every external open is intercepted and
 * logged. Run from the project root after `npm run build`:
 *   node docs/audits/2026-11-12-my-sources/scripts/open-my-sources-app.mjs [--fresh | --profile=<dir>]
 * Default: an "upgraded" profile whose latest session searched arXiv, GitHub and 北京智源人工智能研究院,
 * so the first default comes from that session (3/22). `--fresh`: a new profile (22/22).
 * `--profile=<dir>`: reopen an existing review profile unchanged (checks a restart).
 * The app stays open until it is quit (Command-Q) or the printed PID is stopped.
 * Delete the printed profile afterwards.
 */
import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, openSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const project = process.cwd()
const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(project, 'package.json'))
const { _electron: electron } = require('@playwright/test')
const fresh = process.argv.includes('--fresh')
const reopen = process.argv.find((argument) => argument.startsWith('--profile='))?.slice(10)
const profile = reopen
  ? resolve(reopen)
  : await promisify(mkdtemp)(join(tmpdir(), 'therss-my-sources-review-'))
const electronApp = resolve(project, 'node_modules/electron/dist/Electron.app')
const intercept = resolve(
  here,
  '../../2026-11-12-interaction-implementation/scripts/intercept-open-external.cjs'
)
const environment = {
  ...process.env,
  THERSS_UI: 'appkit',
  THERSS_E2E_FIXTURES: '1',
  THERSS_E2E_LOCALE: 'en-US',
  THERSS_LLM_WIKI_PATH: join(profile, 'no-vault')
}
delete environment.ELECTRON_RUN_AS_NODE

if (!fresh && !reopen) {
  // One fixture search with three applied sources, then remove the preference table as an older
  // build would have it, so the next launch initializes the default from that session.
  const application = await electron.launch({
    args: [`--user-data-dir=${profile}`, project],
    env: environment,
    timeout: 30000
  })
  try {
    await (await application.firstWindow()).waitForLoadState()
    await application.evaluate(({ app, BrowserWindow }) => {
      const { createRequire: load } = process.getBuiltinModule('node:module')
      globalThis.__bridge = load(app.getAppPath() + '/package.json')(
        app.getAppPath() + '/out/native-appkit/therss-ui.node'
      )
      globalThis.__window = BrowserWindow.getAllWindows()[0]
    })
    const act = (id, action, value) =>
      application.evaluate(
        (_, data) =>
          globalThis.__bridge.interactFixture(
            globalThis.__window.getNativeWindowHandle(),
            JSON.stringify(data)
          ),
        { id, action, ...(value === undefined ? {} : { value }) }
      )
    const present = async (id) => {
      for (let count = 0; count < 150; count++) {
        // The native interface attaches shortly after the window loads.
        const found = await application
          .evaluate(
            (_, wanted) =>
              JSON.stringify(
                JSON.parse(globalThis.__bridge.inspect(globalThis.__window.getNativeWindowHandle()))
              ).includes(`"id":"${wanted}"`),
            id
          )
          .catch(() => false)
        if (found) return
        await delay(100)
      }
      throw new Error(`Setup did not reach ${id}`)
    }
    await present('discover-source-picker')
    await delay(500)
    await act('discover-source-picker', 'click')
    await present('discover-source-clear-shown')
    await act('discover-source-clear-shown', 'click')
    for (const source of ['arxiv', 'github', 'folo:302'])
      await act(`discover-source-${source}`, 'click')
    await act('discover-source-apply', 'click')
    await act('discover-query', 'fill', 'Synthetic structured pruning check')
    await act('discover-runner', 'choose', 'codex')
    await act('discover-search', 'click')
    await present('discover-results')
  } finally {
    await application.close().catch(() => {})
  }
  const script = `const D=require(${JSON.stringify(require.resolve('better-sqlite3'))});const db=new D(${JSON.stringify(join(profile, 'therss.sqlite'))});db.exec('DROP TABLE discover_source_preference');db.close()`
  execFileSync(join(project, 'node_modules/.bin/electron'), ['-e', script], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  })
}

const openLog = join(profile, 'intercepted-open-external.jsonl')
const appLog = join(profile, 'app-stdio.log')
const output = openSync(appLog, 'a')
const child = spawn(
  join(electronApp, 'Contents/MacOS/Electron'),
  ['-r', intercept, `--user-data-dir=${profile}`, project],
  {
    env: { ...environment, THERSS_OPEN_EXTERNAL_LOG: openLog },
    detached: true,
    stdio: ['ignore', output, output]
  }
)
child.unref()
const summary = {
  pid: child.pid,
  electronApp,
  project,
  profile,
  database: join(profile, 'therss.sqlite'),
  scenario: reopen
    ? 'reopened existing profile'
    : fresh
      ? 'fresh profile (22/22)'
      : 'upgraded profile; latest session 3 sources',
  reopen: `node docs/audits/2026-11-12-my-sources/scripts/open-my-sources-app.mjs --profile=${profile}`,
  services: 'fixture planner and source fetchers; real SQLite preference store',
  openExternalLog: openLog,
  appLog
}
writeFileSync(join(profile, 'review-app.json'), `${JSON.stringify(summary, null, 2)}\n`)
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)

/* global setTimeout -- used inside Electron main-process evaluate callbacks */
/**
 * Isolated native render check for the 2026-11-12 interaction slices (I1, I2, I4).
 * Synthetic data only: a temporary user-data profile, a temporary synthetic llm-wiki vault and
 * SQLite rows marked "Synthetic". No live source, model, real vault or daily database is used.
 *
 * Usage (from the project root, after `npm run build`):
 *   node docs/audits/2026-11-12-interaction-implementation/scripts/interaction-render.mjs <output directory>
 */
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

const project = process.cwd()
const require = createRequire(join(project, 'package.json'))
const { _electron: electron } = require('@playwright/test')
const output = resolve(process.argv[2] ?? join(project, 'test-results/interaction-2026-11-12'))
await mkdir(output, { recursive: true })
const profile = await mkdtemp(join(tmpdir(), 'therss-interaction-profile-'))
const vault = await mkdtemp(join(tmpdir(), 'therss-interaction-vault-'))
const records = []
const failures = []
const check = (name, ok, detail = '') => {
  records.push({ name, ok, detail })
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}\n`)
  if (!ok) failures.push(name)
}

const find = (node, id) =>
  !node
    ? null
    : node.id === id
      ? node
      : (node.children || []).map((child) => find(child, id)).find(Boolean) || null

function driver(application) {
  const inspect = () =>
    application.evaluate(() =>
      JSON.parse(
        globalThis.__nativeBridge.inspect(globalThis.__nativeWindow.getNativeWindowHandle())
      )
    )
  const act = (id, action, value, extra = {}) =>
    application.evaluate(
      (_, data) =>
        globalThis.__nativeBridge.interactFixture(
          globalThis.__nativeWindow.getNativeWindowHandle(),
          JSON.stringify(data)
        ),
      { id, action, ...(value !== undefined ? { value } : {}), ...extra }
    )
  const lookup = (state, id) =>
    find(state.root, id) ||
    find(state.modal, id) ||
    find(state.popover?.root, id) ||
    state.toolbar?.items?.find((item) => item.id === id) ||
    null
  async function wait(id, predicate = (node) => !!node, label = id) {
    for (let count = 0; count < 150; count++) {
      const last = await inspect().catch(() => null)
      if (last && predicate(lookup(last, id))) return last
      await delay(100)
    }
    throw new Error(`Did not reach expected state: ${label}`)
  }
  const click = async (id) => {
    await wait(id, (node) => !!node && node.enabled !== false)
    await act(id, 'click')
  }
  const menu = async (label) => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const clicked = await application.evaluate(({ Menu }, wanted) => {
        const visit = (items) =>
          items.some((item) =>
            item.label === wanted
              ? (item.click(), true)
              : !!item.submenu && visit(item.submenu.items)
          )
        const menu = Menu.getApplicationMenu()
        return !!menu && visit(menu.items)
      }, label)
      if (clicked) return
      await delay(100)
    }
    throw new Error('Missing menu item: ' + label)
  }
  const setSize = (width, height) =>
    application.evaluate(
      (_, size) => globalThis.__nativeWindow.setBounds({ width: size[0], height: size[1] }),
      [width, height]
    )
  const setTheme = (value) =>
    application.evaluate(({ nativeTheme }, theme) => {
      nativeTheme.themeSource = theme
    }, value)
  async function capture(name) {
    await application.evaluate(() => {
      globalThis.__nativeWindow.showInactive()
      globalThis.__nativeWindow.moveTop()
    })
    await delay(400)
    const state = await inspect()
    await writeFile(join(output, `${name}.json`), JSON.stringify(state, null, 2))
    let ok = false
    for (let attempt = 0; attempt < 4 && !ok; attempt++) {
      if (attempt) await delay(500)
      try {
        execFileSync(
          '/usr/sbin/screencapture',
          ['-x', `-l${state.windowNumber}`, join(output, `${name}.png`)],
          { stdio: 'pipe' }
        )
        ok = true
      } catch {
        ok = false
      }
    }
    check(`capture ${name}`, ok)
    return state
  }
  return { inspect, act, wait, click, menu, setSize, setTheme, capture, lookup }
}

async function launch(env) {
  const application = await electron.launch({
    args: [`--user-data-dir=${profile}`, project],
    env: { ...process.env, THERSS_UI: 'appkit', ...env },
    timeout: 30000
  })
  const stderr = []
  application.process().stderr.on('data', (data) => stderr.push(String(data)))
  await (await application.firstWindow()).waitForLoadState()
  await application.evaluate(({ app, BrowserWindow, shell, nativeTheme }) => {
    nativeTheme.themeSource = 'light'
    const { createRequire } = process.getBuiltinModule('node:module')
    globalThis.__nativeBridge = createRequire(app.getAppPath() + '/package.json')(
      app.getAppPath() + '/out/native-appkit/therss-ui.node'
    )
    globalThis.__nativeWindow = BrowserWindow.getAllWindows()[0]
    // No URL leaves the isolated app.
    shell.openExternal = async (url) => {
      globalThis.__opened = [...(globalThis.__opened ?? []), url]
    }
  })
  return { application, stderr }
}

// Phase A: a fixture Discover run creates one valid persisted session without network calls.
{
  const { application } = await launch({
    THERSS_E2E_FIXTURES: '1',
    THERSS_E2E_LOCALE: 'en-US',
    THERSS_LLM_WIKI_PATH: vault
  })
  const d = driver(application)
  try {
    await d.wait('discover-query')
    await d.act('discover-query', 'fill', 'Synthetic structured pruning check')
    await d.act('discover-runner', 'choose', 'codex')
    await d.click('discover-search')
    await d.wait('discover-results', (node) => node?.rows.length > 0, 'fixture discover results')
  } finally {
    await application.close().catch(() => {})
  }
}

// Phase B: synthetic rows. 5 older Saved items, 30 newer session rows, 30 newer analyses.
const seed = `
const Database = require(${JSON.stringify(require.resolve('better-sqlite3'))})
const db = new Database(${JSON.stringify(join(profile, 'therss.sqlite'))})
const session = db.prepare('SELECT id, created_at FROM discover_session ORDER BY created_at DESC LIMIT 1').get()
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

// Synthetic vault: only the files the read-only Daily reader requires.
const today = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date())
const digestFile = join(vault, `Literature/Digests/ArXiv_Daily/ArXiv_Daily_${today}.md`)
await mkdir(dirname(digestFile), { recursive: true })
await writeFile(join(vault, 'AGENTS.md'), '# Synthetic vault for TheRSS render check\n')
await writeFile(join(vault, '_schema.md'), '# Synthetic schema\n')
const digest = (status, scanned = 'scanned: 412\n') =>
  `---\ntype: feed\nsource: arxiv\ndate: '${today}'\nrun_status: ${status}\n${scanned}selected: 0\n---\n\n# Synthetic ArXiv Daily\n\n## Selected papers\n\n## Ledger\n\nSynthetic.\n`

// Phase C: the real read-only Daily reader against the synthetic vault; main services are not
// in fixture mode. Only the native host is recreated with its fixture-control flag so the driver
// can press controls; the application services keep the real llm-wiki reader.
const { application, stderr } = await launch({ THERSS_LLM_WIKI_PATH: vault })
process.on('exit', () => {
  try {
    application.process().kill()
  } catch {
    // Already closed.
  }
})
// Keep the Settings window open so closing the workspace window leaves the app running, as the
// native smoke does; activation then creates a workspace window with the new host flag.
await application.evaluate(() => {
  process.env.THERSS_E2E_FIXTURES = '1'
})
{
  const probe = driver(application)
  await probe.menu('Settings…')
}
try {
  await application.evaluate(async ({ app, BrowserWindow }) => {
    const first = globalThis.__nativeWindow
    let settings = null
    for (let attempt = 0; attempt < 100 && !settings; attempt++) {
      settings = BrowserWindow.getAllWindows().find((window) => window !== first) ?? null
      if (!settings) await new Promise((done) => setTimeout(done, 100))
    }
    if (!settings) throw new Error('Settings window did not open')
    await new Promise((done) => {
      first.once('closed', done)
      first.close()
    })
    app.emit('activate')
    for (let attempt = 0; attempt < 300; attempt++) {
      const next = BrowserWindow.getAllWindows().find(
        (window) => window !== first && window !== settings && !window.isDestroyed()
      )
      let ready = false
      if (next) {
        try {
          const state = JSON.parse(globalThis.__nativeBridge.inspect(next.getNativeWindowHandle()))
          ready = JSON.stringify(state.root ?? {}).includes('"discover-query"')
        } catch {
          ready = false
        }
      }
      if (ready) {
        globalThis.__nativeWindow = next
        await new Promise((done) => {
          settings.once('closed', done)
          settings.close()
        })
        return
      }
      await new Promise((done) => setTimeout(done, 100))
    }
    throw new Error('Main window was not recreated: ' + BrowserWindow.getAllWindows().length)
  })
} catch (error) {
  process.stdout.write(stderr.join('').slice(-3000) + '\n')
  throw error
}
const d = driver(application)
const text = (state, id) => d.lookup(state, id)?.text ?? d.lookup(state, id)?.title ?? ''
try {
  await d.wait('discover-query')
  for (const [width, height, size] of [
    [1360, 880, 'wide'],
    [820, 600, 'narrow']
  ]) {
    await d.setSize(width, height)
    // I4/I1: local search, scope, truncation, empty scope.
    await d.menu('Find Local Research')
    await d.wait('local-search-query', (node) => node?.editing === true)
    await d.act('local-search-query', 'fill', 'pruning')
    let state = await d.wait('local-search-results', (node) => node?.rows?.length > 0)
    const allRows = d.lookup(state, 'local-search-results').rows
    check(
      `${size}: all scope hides older Saved rows and reports truncation`,
      allRows.length === 50 &&
        !allRows.some((row) => row.id.startsWith('saved:')) &&
        /Not every match is shown/u.test(text(state, 'local-search-truncated')),
      `${allRows.length} rows; notice=${!!d.lookup(state, 'local-search-truncated')}`
    )
    check(
      `${size}: I1 instruction`,
      /Click a result or press Return to open it in TheRSS/u.test(
        text(state, 'local-search-instructions')
      )
    )
    await d.capture(`${size}-local-search-all-truncated`)
    await d.act('local-search-scope', 'choose', 'saved')
    state = await d.wait(
      'local-search-results',
      (node) => node?.rows?.length === 5 && node.rows.every((row) => row.id.startsWith('saved:')),
      'saved scope rows'
    )
    check(
      `${size}: saved scope returns the 5 older Saved rows without a truncation notice`,
      !d.lookup(state, 'local-search-truncated') &&
        d.lookup(state, 'local-search-query')?.value === 'pruning'
    )
    await d.capture(`${size}-local-search-saved`)
    await d.act('local-search-scope', 'choose', 'analysis')
    state = await d.wait('local-search-results', (node) =>
      node?.rows?.every((row) => row.id.startsWith('analysis:'))
    )
    check(
      `${size}: analysis scope returns 30 analyses`,
      d.lookup(state, 'local-search-results').rows.length === 30
    )
    await d.act('local-search-query', 'fill', 'zzqx-no-match')
    state = await d.wait('local-search-empty-title', (node) =>
      /^No /u.test(node?.text ?? node?.title ?? '')
    )
    check(
      `${size}: scoped empty state names the scope`,
      text(state, 'local-search-empty-title') === 'No analyses match “zzqx-no-match”',
      text(state, 'local-search-empty-title')
    )
    await d.capture(`${size}-local-search-scoped-empty`)
    await d.act('local-search-query', 'fill', 'pruning')
    await d.act('local-search-scope', 'choose', 'saved')
    state = await d.wait('local-search-results', (node) => node?.rows?.length === 5)
    const second = d.lookup(state, 'local-search-results').rows[1].id
    await d.act('local-search-results', 'select', second, { activate: true })
    state = await d.wait('return-local-search', (node) => !!node, 'opened saved record')
    await d.capture(`${size}-local-search-opened-record`)
    await d.act('return-local-search', 'click')
    state = await d.wait('local-search-scope', (node) => node?.selected === 'saved')
    check(
      `${size}: Back to search results keeps query, saved scope and selected row`,
      d.lookup(state, 'local-search-query')?.value === 'pruning' &&
        d.lookup(state, 'local-search-results')?.selected === second
    )
    await d.act('local-search-query', 'key', 'escape')
    await delay(300)

    // I2: the real read-only Daily reader with each synthetic scan outcome.
    for (const [status, file] of [
      ['no-results', digest('completed')],
      ['no-source', digest('no-source', '')],
      ['partial', digest('partial')],
      ['missing', null],
      ['unavailable', 'not a digest']
    ]) {
      await rm(digestFile, { force: true })
      if (file !== null) await writeFile(digestFile, file)
      state = await d.inspect()
      if (!d.lookup(state, 'daily-papers-refresh')) {
        await d.click('discover-daily-papers')
      } else {
        await d.click('daily-papers-refresh')
      }
      state = await d.wait(
        'daily-papers-empty-title',
        (node) => !!node,
        `daily empty state ${status}`
      )
      const title = text(state, 'daily-papers-empty-title')
      const message = text(state, 'daily-papers-empty-message')
      check(
        `${size}: daily ${status} explains reason and Refresh boundary`,
        message.endsWith('Refresh rereads the local scan result. It does not run the scan.') &&
          (status !== 'no-source' || !/no relevant papers (today|were found)/iu.test(message)),
        title
      )
      check(
        `${size}: daily ${status} keeps Refresh, Back and digest actions`,
        !!d.lookup(state, 'daily-papers-refresh') &&
          !!d.lookup(state, 'daily-papers-back') &&
          !!d.lookup(state, 'daily-papers-open-digest') ===
            ['no-results', 'no-source', 'partial'].includes(status)
      )
      await d.capture(`${size}-daily-${status}`)
    }
    await d.click('daily-papers-back')
    await delay(300)
  }
  // Dark appearance, narrow, for the new controls.
  await d.setTheme('dark')
  await d.menu('Find Local Research')
  await d.wait('local-search-query', (node) => node?.editing === true)
  await d.act('local-search-query', 'fill', 'pruning')
  await d.wait('local-search-results', (node) => node?.rows?.length > 0)
  await d.capture('narrow-dark-local-search-all-truncated')
  await d.act('local-search-query', 'key', 'escape')
  await rm(digestFile, { force: true })
  await writeFile(digestFile, digest('no-source', ''))
  await d.click('discover-daily-papers')
  await d.wait('daily-papers-empty-title')
  await d.capture('narrow-dark-daily-no-source')
  const opened = await application.evaluate(() => globalThis.__opened ?? [])
  check('no external URL was opened', opened.length === 0, JSON.stringify(opened))
} catch (error) {
  check('render driver completed', false, String(error?.stack ?? error))
} finally {
  await writeFile(
    join(output, 'render-check.json'),
    JSON.stringify({ profile, vault, records, failures, stderr: stderr.join('') }, null, 2)
  )
  await application.close().catch(() => {})
}
process.stdout.write(
  `Render check: ${records.length - failures.length}/${records.length} passed. Evidence: ${output}\n`
)
process.exit(failures.length ? 1 : 0)

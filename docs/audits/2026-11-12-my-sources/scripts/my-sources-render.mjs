/**
 * Isolated native check of My sources (fixture search/planner, real SQLite preference store).
 * A temporary profile only; no live source, model, real vault or daily database.
 * Run from the project root after `npm run build`:
 *   node docs/audits/2026-11-12-my-sources/scripts/my-sources-render.mjs <output directory>
 * Records: behavior assertions and screenshot captures are counted separately.
 */
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

const project = process.cwd()
const require = createRequire(join(project, 'package.json'))
const { _electron: electron } = require('@playwright/test')
const output = resolve(process.argv[2] ?? join(project, 'test-results/my-sources'))
await mkdir(output, { recursive: true })
const profile = await mkdtemp(join(tmpdir(), 'therss-my-sources-profile-'))
const database = join(profile, 'therss.sqlite')
const records = []
const check = (name, ok, detail = '') => {
  records.push({ kind: 'assertion', name, ok: !!ok, detail })
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}\n`)
}
const find = (node, id) =>
  !node
    ? null
    : node.id === id
      ? node
      : (node.children || []).map((child) => find(child, id)).find(Boolean) || null

/** Reads the database with the app closed (Electron as Node, for the Electron ABI build). */
function sql(query) {
  const script = `const D=require(${JSON.stringify(require.resolve('better-sqlite3'))});const db=new D(${JSON.stringify(database)});const out=${JSON.stringify(query)}.startsWith('SELECT')?db.prepare(${JSON.stringify(query)}).all():db.exec(${JSON.stringify(query)});process.stdout.write(JSON.stringify(out??null));db.close()`
  return JSON.parse(
    execFileSync(join(project, 'node_modules/.bin/electron'), ['-e', script], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    }).toString() || 'null'
  )
}

async function launch() {
  const application = await electron.launch({
    args: [`--user-data-dir=${profile}`, project],
    env: {
      ...process.env,
      THERSS_UI: 'appkit',
      THERSS_E2E_FIXTURES: '1',
      THERSS_E2E_LOCALE: 'en-US',
      THERSS_LLM_WIKI_PATH: join(profile, 'no-vault')
    },
    timeout: 30000
  })
  await (await application.firstWindow()).waitForLoadState()
  await application.evaluate(({ app, BrowserWindow, shell, nativeTheme }) => {
    nativeTheme.themeSource = 'light'
    const { createRequire: load } = process.getBuiltinModule('node:module')
    globalThis.__bridge = load(app.getAppPath() + '/package.json')(
      app.getAppPath() + '/out/native-appkit/therss-ui.node'
    )
    globalThis.__window = BrowserWindow.getAllWindows()[0]
    shell.openExternal = async (url) => {
      globalThis.__opened = [...(globalThis.__opened ?? []), url]
    }
  })
  const inspect = () =>
    application.evaluate(() =>
      JSON.parse(globalThis.__bridge.inspect(globalThis.__window.getNativeWindowHandle()))
    )
  const lookup = (state, id) =>
    find(state.root, id) ||
    find(state.modal, id) ||
    find(state.popover?.root, id) ||
    state.toolbar?.items?.find((item) => item.id === id) ||
    null
  const act = (id, action, value, extra = {}) =>
    application.evaluate(
      (_, data) =>
        globalThis.__bridge.interactFixture(
          globalThis.__window.getNativeWindowHandle(),
          JSON.stringify(data)
        ),
      { id, action, ...(value === undefined ? {} : { value }), ...extra }
    )
  const wait = async (id, predicate = (node) => !!node, label = id) => {
    for (let count = 0; count < 150; count++) {
      const state = await inspect().catch(() => null)
      if (state && predicate(lookup(state, id), state)) return state
      await delay(100)
    }
    throw new Error(`Did not reach expected state: ${label}`)
  }
  const click = async (id) => {
    await wait(id, (node) => !!node && node.enabled !== false)
    await act(id, 'click')
  }
  const go = async (route) => {
    await wait('native-navigation', (node) => !!node && node.enabled !== false)
    await act('native-navigation', 'select', route)
    await delay(250)
  }
  const setSize = (width, height) =>
    application.evaluate(
      (_, size) => globalThis.__window.setBounds({ width: size[0], height: size[1] }),
      [width, height]
    )
  const setTheme = (value) =>
    application.evaluate(({ nativeTheme }, theme) => {
      nativeTheme.themeSource = theme
    }, value)
  /** Captures the window region, which includes an attached sheet or popover. */
  const capture = async (name) => {
    await application.evaluate(() => {
      globalThis.__window.showInactive()
      globalThis.__window.moveTop()
    })
    await delay(450)
    const state = await inspect()
    const bounds = await application.evaluate(() => globalThis.__window.getBounds())
    await writeFile(join(output, `${name}.json`), JSON.stringify(state, null, 2))
    let ok = false
    for (let attempt = 0; attempt < 4 && !ok; attempt++) {
      if (attempt) await delay(500)
      try {
        execFileSync(
          '/usr/sbin/screencapture',
          [
            '-x',
            `-R${bounds.x},${bounds.y},${bounds.width},${bounds.height}`,
            join(output, `${name}.png`)
          ],
          { stdio: 'pipe' }
        )
        ok = true
      } catch {
        ok = false
      }
    }
    records.push({ kind: 'capture', name, ok })
    process.stdout.write(`${ok ? 'SHOT' : 'MISS'} ${name}\n`)
    return state
  }
  return { application, inspect, lookup, act, wait, click, go, setSize, setTheme, capture }
}

const text = (state, d, id) => d.lookup(state, id)?.text ?? d.lookup(state, id)?.title ?? ''
let opened = []
try {
  // Launch 1: a new database starts with all 22; one fixture search with 3 applied sources.
  {
    const d = await launch()
    try {
      let state = await d.wait('discover-source-picker', (node) =>
        /22\/22/u.test(node?.title ?? '')
      )
      check(
        'fresh database: all 22 sources by default',
        true,
        text(state, d, 'discover-source-picker')
      )
      await d.click('discover-source-picker')
      await d.wait('discover-source-clear-shown')
      await d.click('discover-source-clear-shown')
      for (const source of ['arxiv', 'github', 'folo:302'])
        await d.act(`discover-source-${source}`, 'click')
      await d.click('discover-source-apply')
      state = await d.wait('discover-source-picker', (node) => /3\/22/u.test(node?.title ?? ''))
      check(
        'apply changes only this search',
        text(state, d, 'discover-source-mode').startsWith('Custom for this search'),
        text(state, d, 'discover-source-mode')
      )
      await d.act('discover-query', 'fill', 'Synthetic structured pruning check')
      await d.act('discover-runner', 'choose', 'codex')
      await d.click('discover-search')
      await d.wait('discover-results', (node) => node?.rows?.length > 0, 'fixture search results')
      state = await d.inspect()
      check(
        'a finished search keeps the custom draft',
        /3\/22/u.test(text(state, d, 'discover-source-picker'))
      )
      await d.capture('1-wide-light-discover-custom-after-search')
    } finally {
      opened = opened.concat(
        await d.application.evaluate(() => globalThis.__opened ?? []).catch(() => [])
      )
      await d.application.close().catch(() => {})
    }
  }
  const searched = sql(
    "SELECT source FROM discover_source_run WHERE status <> 'not_searched' ORDER BY source"
  ).map(({ source }) => source)
  check(
    'the search requested only the 3 applied sources',
    JSON.stringify(searched) === JSON.stringify(['arxiv', 'folo:302', 'github']),
    JSON.stringify(searched)
  )
  check(
    'applying for one search did not change the stored default',
    JSON.parse(sql('SELECT sources_json FROM discover_source_preference')[0].sources_json)
      .length === 22
  )

  // Simulate an upgrade from a build without the table: initialization from the latest session.
  sql('DROP TABLE discover_source_preference')
  {
    const d = await launch()
    try {
      let state = await d.wait(
        'discover-source-picker',
        (node) => /3\/22/u.test(node?.title ?? ''),
        'default from latest session'
      )
      check(
        'upgrade: default initialized from the latest searched session',
        text(state, d, 'discover-source-mode') === 'Using your default sources'
      )
      await d.go('sources')
      state = await d.wait('sources-my-sources', (node) => /3\/22/u.test(node?.title ?? ''))
      await d.capture('2-wide-light-sources-entry')
      await d.click('sources-my-sources')
      state = await d.wait(
        'my-sources-query',
        (node, s) => !!node && s.firstResponderId === 'my-sources-query',
        'sheet focus'
      )
      check('sheet opens with focus in the finder', state.firstResponderId === 'my-sources-query')
      await d.capture('3-wide-light-my-sources-sheet')
      await d.act('my-sources-query', 'fill', 'policy')
      await d.click('my-sources-select-shown')
      state = await d.wait('my-sources-group-business-title', (node) =>
        /3\/3/u.test(node?.text ?? '')
      )
      await d.act('my-sources-query', 'fill', '')
      state = await d.wait('my-sources-count', (node) => node?.text === '6 of 22 selected')
      check(
        'Select shown changed only the shown group and kept hidden choices',
        d.lookup(state, 'my-sources-arxiv')?.checked === true
      )
      await d.act('my-sources-query', 'key', 'escape')
      state = await d.wait(
        'sources-my-sources',
        (node, s) => !s.modal && /3\/22/u.test(node?.title ?? ''),
        'escape cancel'
      )
      check(
        'Escape cancels without saving and returns focus to the entry',
        state.firstResponderId === 'sources-my-sources',
        state.firstResponderId
      )
      await d.click('sources-my-sources')
      await d.wait('my-sources-clear-shown')
      await d.click('my-sources-clear-shown')
      state = await d.wait('my-sources-zero')
      check(
        'zero sources: Save disabled with a nearby reason',
        d.lookup(state, 'my-sources-save')?.enabled === false
      )
      await d.capture('4-wide-light-my-sources-zero')
      for (const source of ['arxiv', 'github', 'folo:302', 'folo:84', 'folo:253'])
        await d.act(`my-sources-${source}`, 'click')
      await d.click('my-sources-save')
      state = await d.wait(
        'sources-my-sources',
        (node, s) => !s.modal && /5\/22/u.test(node?.title ?? ''),
        'saved default'
      )
      await d.go('discover')
      state = await d.wait('discover-source-picker', (node) => /5\/22/u.test(node?.title ?? ''))
      check(
        'an unchanged draft follows the new default',
        text(state, d, 'discover-source-mode') === 'Using your default sources'
      )
      await d.click('discover-source-picker')
      await d.wait('discover-source-folo:64')
      await d.act('discover-source-folo:64', 'click')
      await d.click('discover-source-apply')
      await d.wait('discover-source-picker', (node) => /6\/22/u.test(node?.title ?? ''))
      await d.go('sources')
      await d.click('sources-my-sources')
      await d.wait('my-sources-clear-shown')
      await d.click('my-sources-clear-shown')
      await d.act('my-sources-arxiv', 'click')
      await d.act('my-sources-github', 'click')
      await d.click('my-sources-save')
      await d.wait('sources-my-sources', (node, s) => !s.modal && /2\/22/u.test(node?.title ?? ''))
      await d.go('discover')
      state = await d.wait('discover-source-note')
      check(
        'a custom draft is kept when the default changes',
        /6\/22/u.test(text(state, d, 'discover-source-picker')),
        text(state, d, 'discover-source-note')
      )
      await d.capture('5-wide-light-discover-custom-kept')
      // Narrow and dark appearance of the new controls.
      await d.setSize(820, 600)
      await d.setTheme('dark')
      await d.click('discover-source-picker')
      await d.wait('discover-source-apply')
      await d.capture('6-narrow-dark-discover-popover')
      await d.act('popover', 'dismiss-popover')
      await d.go('sources')
      await d.click('sources-my-sources')
      await d.wait('my-sources-save')
      await d.capture('7-narrow-dark-my-sources-sheet')
      await d.act('my-sources-query', 'fill', '国家')
      await d.wait('my-sources-shown-count', (node) => /^1 of 22 shown/u.test(node?.text ?? ''))
      await d.capture('8-narrow-dark-my-sources-long-name')
      await d.act('my-sources-query', 'key', 'escape')
      await d.wait('sources-my-sources', (node, s) => !s.modal)
    } finally {
      opened = opened.concat(
        await d.application.evaluate(() => globalThis.__opened ?? []).catch(() => [])
      )
      await d.application.close().catch(() => {})
    }
  }
  const stored = sql('SELECT sources_json, origin FROM discover_source_preference')[0]
  check(
    'the saved default is in SQLite with origin user',
    stored.origin === 'user' && JSON.parse(stored.sources_json).join() === 'arxiv,github',
    JSON.stringify(stored)
  )

  // Restart: the draft starts from the saved default; the old session keeps its own scope.
  {
    const d = await launch()
    try {
      const state = await d.wait('discover-source-scope-note')
      check(
        'restart: the draft starts from the saved default',
        /2\/22/u.test(text(state, d, 'discover-source-picker'))
      )
      check(
        'restart: the old session keeps its scope and results',
        text(state, d, 'discover-source-scope-note') ===
          'These results searched 3 of 22 sources. The next search uses 2 of 22 sources.' &&
          d.lookup(state, 'discover-results')?.rows?.length > 0,
        text(state, d, 'discover-source-scope-note')
      )
      await d.capture('9-wide-light-discover-after-restart')
    } finally {
      opened = opened.concat(
        await d.application.evaluate(() => globalThis.__opened ?? []).catch(() => [])
      )
      await d.application.close().catch(() => {})
    }
  }
  check('no external URL was opened', opened.length === 0, JSON.stringify(opened))
} catch (error) {
  check('driver completed', false, String(error?.stack ?? error).slice(0, 2000))
} finally {
  await writeFile(
    join(output, 'my-sources-check.json'),
    `${JSON.stringify({ records }, null, 2)}\n`
  )
}
const assertions = records.filter((record) => record.kind === 'assertion')
const captures = records.filter((record) => record.kind === 'capture')
process.stdout.write(
  `My sources native check: ${assertions.filter((r) => r.ok).length}/${assertions.length} assertions, ${captures.filter((r) => r.ok).length}/${captures.length} captures. Evidence: ${output}\nProfile: ${profile}\n`
)
process.exit(records.every((record) => record.ok) ? 0 : 1)

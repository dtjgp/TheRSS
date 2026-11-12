/**
 * Background-close check of the Discover source popover (R4, option A). Fixture app with a
 * temporary profile; the app's own NSApplicationDidResignActive notification is posted inside the
 * process through the fixture bridge. No other app is activated and no system-wide input is sent.
 * Run from the project root after `npm run build`:
 *   node docs/audits/2026-11-12-my-sources/scripts/popover-background-check.mjs
 */
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

const project = process.cwd()
const require = createRequire(join(project, 'package.json'))
const { _electron: electron } = require('@playwright/test')
const profile = await mkdtemp(join(tmpdir(), 'therss-popover-background-'))
const records = []
const check = (name, ok, detail = '') => {
  records.push({ name, ok: !!ok, detail })
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}\n`)
}
const find = (node, id) =>
  !node
    ? null
    : node.id === id
      ? node
      : (node.children || []).map((child) => find(child, id)).find(Boolean) || null
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
const lookup = (state, id) => find(state.root, id) || find(state.popover?.root, id)
const wait = async (predicate, label, attempts = 50) => {
  let state
  for (let count = 0; count < attempts; count++) {
    state = await inspect().catch(() => null)
    if (state && predicate(state)) return state
    await delay(100)
  }
  throw new Error(`Did not reach: ${label}`)
}
const title = (state) => lookup(state, 'discover-source-picker')?.title ?? ''
try {
  await (await application.firstWindow()).waitForLoadState()
  await application.evaluate(({ app, BrowserWindow }) => {
    const { createRequire: load } = process.getBuiltinModule('node:module')
    globalThis.__bridge = load(app.getAppPath() + '/package.json')(
      app.getAppPath() + '/out/native-appkit/therss-ui.node'
    )
    globalThis.__window = BrowserWindow.getAllWindows()[0]
  })
  let state = await wait((s) => lookup(s, 'discover-query')?.enabled, 'Discover ready')
  await act('discover-query', 'fill', 'Background check question')
  // Apply a custom combination first (21/22), so the applied state differs from the default.
  await act('discover-source-picker', 'click')
  await wait((s) => !!s.popover, 'popover open')
  await act('discover-source-github', 'click')
  await act('discover-source-apply', 'click')
  state = await wait((s) => !s.popover && /21\/22/u.test(title(s)), 'custom applied')
  // Open again and change the draft without applying it.
  await act('discover-source-picker', 'click')
  await wait((s) => !!s.popover, 'popover reopened')
  await act('discover-source-arxiv', 'click')
  state = await wait((s) => lookup(s, 'discover-source-arxiv')?.checked === false, 'draft changed')
  await act('popover', 'app-resign-active')
  state = await wait(
    (s) => !s.popover,
    'popover closed after the app lost the foreground',
    30
  ).catch(() => null)
  state ??= await inspect()
  check('losing the foreground closes the native popover', !state.popover)
  await delay(500)
  state = await inspect()
  check('it does not reopen by itself', !state.popover)
  check(
    'the applied sources are unchanged (draft discarded)',
    /21\/22/u.test(title(state)),
    title(state)
  )
  check(
    'the research question is unchanged',
    lookup(state, 'discover-query')?.value === 'Background check question',
    lookup(state, 'discover-query')?.value
  )
  // A second notification without a popover is harmless.
  await act('popover', 'app-resign-active')
  await delay(200)
  state = await inspect()
  check(
    'a later notification without a popover changes nothing',
    !state.popover && /21\/22/u.test(title(state))
  )
  // Reopening shows the applied combination; ordinary use still works.
  await act('discover-source-picker', 'click')
  state = await wait((s) => !!s.popover, 'popover open again')
  check(
    'reopening shows the applied combination',
    lookup(state, 'discover-source-arxiv')?.checked === true &&
      lookup(state, 'discover-source-github')?.checked === false
  )
  await delay(600)
  state = await inspect()
  check('the reopened popover is not closed by an earlier observer', !!state.popover)
  await act('discover-source-query', 'fill', 'arxiv')
  state = await wait(
    (s) => /^1 of 22 shown/u.test(lookup(s, 'discover-source-shown-count')?.text ?? ''),
    'finder'
  )
  check(
    'the finder still filters in the foreground',
    true,
    lookup(state, 'discover-source-shown-count')?.text
  )
  await act('discover-source-cancel', 'click')
  state = await wait((s) => !s.popover, 'cancel closes')
  check('Cancel still closes without changes', /21\/22/u.test(title(state)))
  await act('discover-source-picker', 'click')
  await wait((s) => !!s.popover, 'open for outside dismissal')
  await act('popover', 'dismiss-popover')
  state = await wait((s) => !s.popover, 'outside dismissal closes')
  check('an outside dismissal still closes', /21\/22/u.test(title(state)))
  await act('discover-source-picker', 'click')
  await wait((s) => !!s.popover, 'open for apply')
  await act('discover-source-github', 'click')
  await act('discover-source-apply', 'click')
  state = await wait((s) => !s.popover && /22\/22/u.test(title(s)), 'apply works')
  check('Apply still changes this search', true, title(state))
  // The observer is registered again for a new opening.
  await act('discover-source-picker', 'click')
  await wait((s) => !!s.popover, 'open for a second background close')
  await act('popover', 'app-resign-active')
  state = await wait((s) => !s.popover, 'second background close', 30).catch(() => null)
  check('a reopened popover also closes when the app loses the foreground', !!state)
  await act('popover', 'app-resign-active')
} catch (error) {
  check('driver completed', false, String(error?.stack ?? error).slice(0, 1500))
} finally {
  await application.close().catch(() => {})
}
// The stored default was never written by these steps.
try {
  const script = `const D=require(${JSON.stringify(require.resolve('better-sqlite3'))});const db=new D(${JSON.stringify(join(profile, 'therss.sqlite'))},{readonly:true});process.stdout.write(JSON.stringify(db.prepare('SELECT origin, sources_json FROM discover_source_preference').get()));db.close()`
  const row = JSON.parse(
    execFileSync(join(project, 'node_modules/.bin/electron'), ['-e', script], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    }).toString()
  )
  check(
    'the stored default was not written',
    row.origin === 'all-sources' && JSON.parse(row.sources_json).length === 22,
    row.origin
  )
} catch (error) {
  check('default readable', false, String(error).slice(0, 300))
}
await rm(profile, { recursive: true, force: true })
process.stdout.write(
  `Popover background check: ${records.filter((r) => r.ok).length}/${records.length}\n`
)
process.exit(records.every((r) => r.ok) ? 0 : 1)

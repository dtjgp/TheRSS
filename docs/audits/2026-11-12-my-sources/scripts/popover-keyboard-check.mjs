/**
 * SUSPENDED (2026-11-12): sends real, system-wide input and switches apps. Never run it
 * unattended or on a desktop someone is using, and never add it to an automated gate. It exits
 * unless THERSS_ALLOW_REAL_INPUT=1 is set by the person who is at the machine.
 *
 * Real keyboard check of the Discover source popover (R4). The app runs in fixture mode with a
 * temporary profile; the driver reads native state through the fixture bridge but sends input
 * only through macOS System Events (real key events to the frontmost app), never fixture fill.
 * Requires Accessibility permission for the terminal. It sends real, system-wide key events and
 * an app switch: run it only on a desktop nobody else is using. Each key event is sent only after
 * checking that the test app is frontmost; otherwise the run stops.
 * Run from the project root after a build:
 *   node docs/audits/2026-11-12-my-sources/scripts/popover-keyboard-check.mjs
 */
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

if (process.env.THERSS_ALLOW_REAL_INPUT !== '1') {
  process.stderr.write(
    'Suspended: this check sends system-wide input. Set THERSS_ALLOW_REAL_INPUT=1 only when you are at an otherwise idle desktop.\n'
  )
  process.exit(2)
}
const project = process.cwd()
const { _electron: electron } = createRequire(join(project, 'package.json'))('@playwright/test')
const profile = await mkdtemp(join(tmpdir(), 'therss-popover-keys-'))
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
const pid = application.process().pid
const osa = (...lines) =>
  execFileSync(
    '/usr/bin/osascript',
    lines.flatMap((line) => ['-e', line]),
    {
      encoding: 'utf8'
    }
  ).trim()
const front = () =>
  osa(
    `tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true`
  )
const activate = `tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true`
// Stops before typing if another app (for example the user's) is frontmost.
const guard = `tell application "System Events" to if unix id of (first process whose frontmost is true) is not ${pid} then error "The test app is not frontmost; stopping before sending keys."`
/** Real key events from System Events, delivered to the key window of the frontmost app. */
const keys = (text) =>
  osa(
    activate,
    'delay 0.3',
    guard,
    `tell application "System Events" to keystroke ${JSON.stringify(text)}`
  )
const keyCode = (code, modifiers = '') =>
  osa(
    activate,
    'delay 0.3',
    guard,
    `tell application "System Events" to key code ${code}${modifiers ? ` using {${modifiers}}` : ''}`
  )
try {
  await (await application.firstWindow()).waitForLoadState()
  await application.evaluate(({ app, BrowserWindow }) => {
    const { createRequire: load } = process.getBuiltinModule('node:module')
    globalThis.__bridge = load(app.getAppPath() + '/package.json')(
      app.getAppPath() + '/out/native-appkit/therss-ui.node'
    )
    globalThis.__window = BrowserWindow.getAllWindows()[0]
  })
  const inspect = () =>
    application.evaluate(() =>
      JSON.parse(globalThis.__bridge.inspect(globalThis.__window.getNativeWindowHandle()))
    )
  const wait = async (predicate, label) => {
    for (let count = 0; count < 100; count++) {
      const state = await inspect().catch(() => null)
      if (state && predicate(state)) return state
      await delay(100)
    }
    throw new Error(`Did not reach: ${label}`)
  }
  let state = await wait((s) => find(s.root, 'discover-query')?.enabled, 'Discover ready')
  // Type the question with real keys first, as a user would.
  // The research question is the window's initial first responder.
  await delay(1500)
  front()
  await delay(500)
  state = await inspect()
  check(
    'the question has keyboard focus at start',
    state.firstResponderId === 'discover-query',
    state.firstResponderId
  )
  // Digits: an active input method (for example Pinyin) composes letters but passes digits.
  keys('2026')
  await delay(600)
  state = await inspect()
  const question = find(state.root, 'discover-query')?.value ?? ''
  check(
    'real keys reach the question before the popover opens',
    question === '2026',
    JSON.stringify(question)
  )
  // Open the popover with the keyboard path a user has: Tab to the button is not stable, so
  // press the button through Accessibility (AXPress), the same path VoiceOver and CUA use.
  // A real mouse click at the button's on-screen centre (located through Accessibility).
  osa(activate, 'delay 0.3')
  const frame = JSON.parse(
    execFileSync(
      '/usr/bin/osascript',
      [
        '-l',
        'JavaScript',
        '-e',
        `const se = Application('System Events'); const p = se.processes.whose({ unixId: ${pid} })[0];
         function walk(e, d) { if (d > 14) return null; let kids = []; try { kids = e.uiElements() } catch (x) { return null }
           for (const k of kids) { let name = ''; try { name = String(k.name() || k.title() || '') } catch (x) {}
             try { if (k.role() === 'AXButton' && name.startsWith('Sources for this search')) return k } catch (x) {}
             const found = walk(k, d + 1); if (found) return found } return null }
         const b = walk(p.windows[0], 0); JSON.stringify(b ? [...b.position(), ...b.size()] : null)`
      ],
      { encoding: 'utf8' }
    )
  )
  if (!frame) throw new Error('Source button not found through Accessibility')
  const [x, y, w, h] = frame.map(Number)
  osa(
    activate,
    'delay 0.2',
    `tell application "System Events" to click at {${Math.round(x + w / 2)}, ${Math.round(y + h / 2)}}`
  )
  state = await wait((s) => s.popover, 'popover open')
  await delay(400)
  state = await inspect()
  check(
    'popover window is key after opening',
    state.popover.keyWindow === true,
    `keyWindow=${state.popover.keyWindow} appKey=${state.popover.appKeyIsPopover} input=${state.popover.inputInPopover} appActive=${state.appActive}`
  )
  keys('64')
  await delay(500)
  state = await inspect()
  check(
    'typed text reaches the source finder',
    find(state.popover?.root, 'discover-source-query')?.value === '64',
    `finder=${JSON.stringify(find(state.popover?.root, 'discover-source-query')?.value)}`
  )
  check(
    'the research question is unchanged',
    find(state.root, 'discover-query')?.value === question,
    `question=${JSON.stringify(find(state.root, 'discover-query')?.value)}`
  )
  // Select all + replace inside the finder must not touch the question.
  keyCode(0, 'command down')
  keys('302')
  await delay(400)
  state = await inspect()
  check(
    'Command-A and typing replace only the finder text',
    find(state.popover?.root, 'discover-source-query')?.value === '302' &&
      find(state.root, 'discover-query')?.value === question,
    `finder=${JSON.stringify(find(state.popover?.root, 'discover-source-query')?.value)} question=${JSON.stringify(find(state.root, 'discover-query')?.value)}`
  )
  // Switch to another app and back (as Command-Tab or an automation tool's activation does): the
  // semi-transient popover stays open, so typing must still reach its finder.
  osa('tell application "Finder" to activate', 'delay 0.6')
  osa(activate, 'delay 1.2')
  state = await inspect()
  check(
    'after switching apps the popover is still open and key',
    !!state.popover && state.popover.keyWindow === true,
    `popover=${!!state.popover} keyWindow=${state.popover?.keyWindow} appKey=${state.popover?.appKeyIsPopover} input=${state.popover?.inputInPopover} appActive=${state.appActive} restores=${state.popover?.restoreCalls} responder=${state.popover?.restoreResponder} main=${state.firstResponderId} appKeyClass=${state.popover?.appKeyClass}`
  )
  keys('7')
  await delay(500)
  state = await inspect()
  check(
    'after switching apps typing still reaches the finder, not the question',
    find(state.popover?.root, 'discover-source-query')?.value === '3027' &&
      find(state.root, 'discover-query')?.value === question,
    `finder=${JSON.stringify(find(state.popover?.root, 'discover-source-query')?.value)} question=${JSON.stringify(find(state.root, 'discover-query')?.value)}`
  )
  // Escape closes the popover (Cancel) and returns focus to the Sources button.
  keyCode(53)
  state = await wait((s) => !s.popover, 'popover closed by Escape')
  await delay(300)
  state = await inspect()
  check(
    'Escape cancels and returns focus to the source button',
    state.firstResponderId === 'discover-source-picker',
    `firstResponderId=${state.firstResponderId}`
  )
  check(
    'Escape left the search sources unchanged',
    /22\/22/u.test(find(state.root, 'discover-source-picker')?.title ?? ''),
    find(state.root, 'discover-source-picker')?.title
  )
} catch (error) {
  check('driver completed', false, String(error?.stack ?? error).slice(0, 1500))
} finally {
  await application.close().catch(() => {})
  await rm(profile, { recursive: true, force: true })
}
process.stdout.write(
  `Popover keyboard check: ${records.filter((r) => r.ok).length}/${records.length}\n`
)
process.exit(records.every((r) => r.ok) ? 0 : 1)

/** Native controls and persisted fixture workflows; no live source, provider or vault calls. */
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, URL } from 'node:url'
import { _electron as electron } from '@playwright/test'
import { classifyNativeSmokeStderr } from './native-smoke-diagnostics.mjs'
import { nativeSmokeAppKitOptions } from './native-smoke-options.mjs'
import { sourceHealthFixture } from './source-health-fixture.mjs'
import { savedSourceUpdateFixture } from './saved-source-update-fixture.mjs'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(
  process.env.THERSS_NATIVE_EVIDENCE_DIR || join(project, 'test-results/appkit-native')
)
await mkdir(output, { recursive: true })
const profile = await mkdtemp(join(tmpdir(), 'therss-appkit-acceptance-'))
const screenshots = process.env.THERSS_NATIVE_SCREENSHOTS !== '0'
const appKitOptions = nativeSmokeAppKitOptions(process.env)
const checks = [],
  errors = [],
  captureFailures = []
const launchEnvironment = {
  ...process.env,
  THERSS_E2E_FIXTURES: '1',
  THERSS_E2E_NATIVE_DIALOGS: '1',
  // Display dates follow the system locale; pin one so assertions do not depend on this Mac.
  THERSS_E2E_LOCALE: process.env.THERSS_E2E_LOCALE || 'en-US',
  THERSS_UI: 'appkit'
}
if (process.env.THERSS_NATIVE_DEFAULT_ONLY === '1') delete launchEnvironment.THERSS_UI
const application = await electron.launch({
  ...(process.env.THERSS_NATIVE_APP_EXECUTABLE
    ? { executablePath: process.env.THERSS_NATIVE_APP_EXECUTABLE }
    : {}),
  args: [
    `--user-data-dir=${profile}`,
    ...(process.env.THERSS_NATIVE_APP_EXECUTABLE ? [] : [project]),
    ...appKitOptions.args
  ],
  env: launchEnvironment,
  timeout: 30000
})
application.process().stderr.on('data', (data) => errors.push(String(data)))
const page = await application.firstWindow()
await page.waitForLoadState()

function find(node, id) {
  if (!node) return null
  if (node.id === id) return node
  return (node.children || []).map((child) => find(child, id)).find(Boolean) || null
}
/**
 * The sidebar width the window shows for a saved width, measured at the split divider: the
 * node inside the system sidebar item can be inset by the OS (8 pt narrower on CI's macOS),
 * and the content column keeps its 636 pt minimum (plus the 1 pt divider) in narrow windows.
 */
function sidebarFits(state, saved) {
  const workspace = find(state.root, 'native-workspace')
  const width = Number(workspace.frame.match(/-?\d+(?:\.\d+)?/gu)[2])
  const expected = Math.max(184, Math.min(saved, width - 636 - 1))
  const actual = state.toolbar.sidebarDivider
  return { ok: Math.abs(actual - expected) <= 1, expected, actual, width }
}
function flatten(node) {
  return node ? [node, ...(node.children || []).flatMap(flatten)] : []
}
const inspect = () =>
  application.evaluate(() =>
    JSON.parse(globalThis.__nativeBridge.inspect(globalThis.__nativeWindow.getNativeWindowHandle()))
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
async function wait(id, predicate = (node) => !!node) {
  for (let count = 0; count < 200; count++) {
    let state
    try {
      state = await inspect()
    } catch (error) {
      if (!String(error).includes('detached')) throw error
      await delay(100)
      continue
    }
    // Toolbar items are window chrome, reported beside the content tree.
    const node =
      find(state.root, id) ||
      find(state.modal, id) ||
      find(state.popover?.root, id) ||
      state.toolbar?.items?.find((item) => item.id === id) ||
      null
    if (predicate(node)) return state
    await delay(100)
  }
  throw new Error(`Native control did not reach its expected state: ${id}`)
}
async function go(route) {
  await wait('native-navigation', (node) => !!node && node.enabled !== false)
  await act('native-navigation', 'select', route)
}
// Asynchronous reloads can disable a control between observing it enabled and pressing it.
// The fixture bridge reports a press on a disabled control, so retry only that precondition.
async function press(id, action, value) {
  for (let attempt = 0; attempt < 50; attempt++) {
    await wait(id, (node) => !!node && node.enabled !== false)
    try {
      await act(id, action, value)
      return
    } catch (error) {
      if (!String(error).includes('Fixture control is disabled')) throw error
      await delay(100)
    }
  }
  throw new Error(`Native control stayed disabled: ${id}`)
}
async function click(id) {
  await press(id, 'click')
}
async function alert(title) {
  for (let count = 0; count < 100; count++) {
    const state = await inspect()
    if (state.alerts.some((entry) => entry.buttons.includes(title))) return state
    await delay(100)
  }
  throw new Error(`Native alert did not appear: ${title}`)
}
const answerAlert = async (title) => {
  const before = await application.evaluate(
    () => globalThis.__fixtureDialogs.filter((entry) => entry.event === 'resolved').length
  )
  await act('', 'alert', title)
  // A native click returns before Electron's sheet promise and close guard settle.
  // Wait for that real completion before issuing another close/navigation action.
  for (let attempt = 0; attempt < 100; attempt++) {
    const resolved = await application.evaluate(
      () => globalThis.__fixtureDialogs.filter((entry) => entry.event === 'resolved').length
    )
    if (resolved > before) return
    await delay(50)
  }
  throw new Error(`Native alert did not finish: ${title}`)
}
async function menu(label) {
  await application.evaluate(({ Menu }, wanted) => {
    const visit = (items) => {
      for (const item of items) {
        if (item.label === wanted) {
          item.click()
          return true
        }
        if (item.submenu && visit(item.submenu.items)) return true
      }
      return false
    }
    if (!visit(Menu.getApplicationMenu().items))
      throw new Error('Missing native menu item: ' + wanted)
  }, label)
}
/**
 * Command-comma opens the separate Settings window. The fixture helpers drive
 * `__nativeWindow`, so point it at the Settings window until `useMainWindow()`.
 */
async function useSettingsWindow({ open = true } = {}) {
  if (open) await menu('Settings…')
  for (let attempt = 0; attempt < 100; attempt++) {
    const found = await application.evaluate(({ BrowserWindow }) => {
      globalThis.__mainWindow ??= globalThis.__nativeWindow
      for (const window of BrowserWindow.getAllWindows()) {
        if (window === globalThis.__mainWindow || window.isDestroyed()) continue
        try {
          const state = JSON.parse(
            globalThis.__nativeBridge.inspect(window.getNativeWindowHandle())
          )
          if (state.toolbar?.style !== 'preference' || !state.visible) continue
        } catch {
          continue
        }
        globalThis.__nativeWindow = window
        return true
      }
      return false
    })
    if (found) return
    await delay(100)
  }
  throw new Error('The Settings window did not open')
}
async function useMainWindow() {
  await application.evaluate(() => {
    globalThis.__nativeWindow = globalThis.__mainWindow ?? globalThis.__nativeWindow
  })
}
const windowCount = () =>
  application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
// At ordinary window heights every workspace must fit: lists, tables and readers scroll, the
// page does not. The adaptive outer scroll remains a fallback for small windows and high zoom.
function assertFitsWindow(state, name) {
  const main = find(state.root, 'native-main')
  if (!main?.documentFrame) return
  const numbers = (frame) => frame.match(/-?\d+(?:\.\d+)?/gu).map(Number)
  const content = numbers(main.documentFrame)[3],
    viewport = numbers(main.viewportSize)[1]
  if (viewport >= 800 && content > viewport + 1)
    throw new Error(
      `Workspace ${name} needs an outer page scroll: ${content} pt of content in a ${viewport} pt window`
    )
}
async function capture(name) {
  if (!screenshots) {
    const state = await inspect()
    await writeFile(join(output, `${name}.json`), JSON.stringify(state, null, 2))
    assertFitsWindow(state, name)
    return state
  }
  // macOS 14+ cooperative activation means a test cannot reliably take activation from the
  // app the user is working in, and an activated fixture would receive this desktop's real
  // keystrokes. Bring the window on-screen without activating it, park keyboard focus while
  // capturing, restore the previous owner, and fail explicitly if the focused field changed.
  // Each capture JSON records `keyWindow`/`appActive`: inactive chrome is expected there.
  const before = await inspect()
  const owner = before.firstResponderId
  const inputValue = (state, id) => {
    const node = find(state.root, id) || find(state.modal, id) || find(state.popover?.root, id)
    return node?.kind === 'input' ? node.value : undefined
  }
  const present = async () => {
    await application.evaluate(() => {
      globalThis.__nativeWindow.showInactive()
      globalThis.__nativeWindow.moveTop()
    })
    const bounds = await application.evaluate(() => globalThis.__nativeWindow.getBounds())
    for (let attempt = 0; attempt < 60; attempt++) {
      const current = await inspect()
      const placement = current.ownedWindowServerEntries?.find(
        (entry) => entry.kCGWindowNumber === current.windowNumber
      )?.kCGWindowBounds
      if (placement && Math.abs(placement.X - bounds.x) < 1 && Math.abs(placement.Y - bounds.y) < 1)
        break
      await delay(50)
    }
    const current = await inspect()
    await act('', 'blur')
    return current.keyWindow ? current.firstResponderId : ''
  }
  const exposed = new Set([owner, await present()].filter(Boolean))
  await delay(80)
  let state = await inspect()
  await writeFile(join(output, `${name}.json`), JSON.stringify(state, null, 2))
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      execFileSync(
        '/usr/sbin/screencapture',
        ['-x', `-l${state.windowNumber}`, join(output, `${name}.png`)],
        { stdio: 'pipe' }
      )
      break
    } catch (error) {
      if (attempt === 3)
        captureFailures.push({ name, windowNumber: state.windowNumber, error: String(error) })
      else {
        await delay(500)
        exposed.add(await present())
        state = await inspect()
      }
    }
  }
  if (state.popover?.windowNumber) {
    // The popover is its own window; capture it beside the main window image.
    try {
      execFileSync(
        '/usr/sbin/screencapture',
        ['-x', `-l${state.popover.windowNumber}`, join(output, `${name}-popover.png`)],
        { stdio: 'pipe' }
      )
    } catch (error) {
      captureFailures.push({
        name: `${name}-popover`,
        windowNumber: state.popover.windowNumber,
        error: String(error)
      })
    }
  }
  assertFitsWindow(state, name)
  if (owner) await act(owner, 'focus')
  const after = await inspect()
  for (const id of exposed) {
    if (inputValue(before, id) !== inputValue(after, id))
      throw new Error(
        `Text input ${id} changed during capture ${name}; external keyboard input may have reached the fixture window`
      )
  }
  return after
}
async function step(name, run) {
  const started = Date.now()
  await run()
  checks.push({ name, passed: true, elapsedMs: Date.now() - started })
  process.stdout.write(`PASS ${name}\n`)
}

try {
  await application.evaluate(
    ({ app, BrowserWindow, shell, clipboard, safeStorage, dialog, nativeTheme }) => {
      nativeTheme.themeSource = 'light'
      const { createRequire } = process.getBuiltinModule('node:module')
      globalThis.__nativeBridge = createRequire(app.getAppPath() + '/package.json')(
        app.getAppPath() + '/out/native-appkit/therss-ui.node'
      )
      globalThis.__nativeWindow = BrowserWindow.getAllWindows()[0]
      if (process.env.THERSS_NATIVE_CLOSE_TRACE === '1') {
        const { appendFileSync } = process.getBuiltinModule('node:fs')
        const trace = (event) =>
          appendFileSync(
            app.getPath('userData') + '/native-close-trace.jsonl',
            JSON.stringify({ event, at: Date.now(), stack: new Error().stack }) + '\n'
          )
        const window = globalThis.__nativeWindow
        const close = window.close.bind(window)
        window.close = (...args) => {
          trace('close-method')
          return close(...args)
        }
        window.on('close', () => trace('close-event'))
        window.on('closed', () => trace('closed-event'))
        app.on('before-quit', () => trace('before-quit'))
      }
      if (process.env.THERSS_NATIVE_COMPACT_FIXTURE === '1')
        globalThis.__nativeWindow.setBounds({ width: 1024, height: 677 })
      globalThis.__nativeOpened = []
      globalThis.__nativeCopied = []
      globalThis.__fixtureCipherHashes = []
      globalThis.__fixtureDialogs = []
      const showMessageBox = dialog.showMessageBox.bind(dialog)
      dialog.showMessageBox = async (window, options) => {
        globalThis.__fixtureDialogs.push({
          event: 'open',
          buttons: options.buttons,
          time: Date.now()
        })
        const result = await showMessageBox(window, options)
        globalThis.__fixtureDialogs.push({
          event: 'resolved',
          buttons: options.buttons,
          result,
          time: Date.now()
        })
        return result
      }
      shell.openExternal = async (url) => {
        globalThis.__nativeOpened.push(url)
      }
      clipboard.writeText = (text) => {
        globalThis.__nativeCopied.push(text)
      }
      const encrypt = safeStorage.encryptString.bind(safeStorage)
      safeStorage.encryptString = (value) => {
        globalThis.__fixtureCipherHashes.push(
          process.getBuiltinModule('node:crypto').createHash('sha256').update(value).digest('hex')
        )
        return encrypt(value)
      }
    }
  )
  await step('Native root, blank Web page and Unicode boundary', async () => {
    const state = await wait('discover-query')
    assert.equal(state.webHidden, true)
    assert.equal(state.nativeRoot, 'TRCanvas')
    assert.equal(await page.evaluate(() => document.body.childElementCount), 0)
    await act('discover-query', 'fill', 'a'.repeat(1999) + '🧪')
    const boundary = await wait('discover-query', (node) => node?.value?.length === 1999)
    assert.equal(find(boundary.root, 'discover-query').value, 'a'.repeat(1999))
    assert.match(find(boundary.root, 'discover-personalization').text, /^1999\/2000/)
    await act('discover-query', 'fill', '边缘计算 structured pruning')
  })
  await step('All 22 source choices and semantic search', async () => {
    await click('discover-source-picker')
    const state = await inspect()
    assert.equal(state.popover?.anchor, 'discover-source-picker', 'Sources open in a popover')
    assert.equal(
      state.popover.below,
      true,
      `The source popover opens below its button (popover ${state.popover.popoverFrame}, button ${state.popover.anchorFrame}, screen ${state.popover.screenFrame})`
    )
    assert.equal(state.popover.keyWindow, true, 'The source finder takes keyboard focus')
    assert(!find(state.root, 'discover-source-controls'), 'The picker no longer pushes results')
    assert.equal(flatten(state.popover.root).filter((node) => node.kind === 'check').length, 22)
    assert.equal(
      flatten(state.popover.root).filter((node) => /^discover-group-.+-title$/u.test(node.id))
        .length,
      5
    )
    await click('discover-group-code-toggle')
    assert.equal(find((await inspect()).popover.root, 'discover-source-github').checked, false)
    assert.equal(find((await inspect()).popover.root, 'discover-source-arxiv').checked, true)
    await click('discover-group-code-toggle')
    await capture('source-picker-checked')
    await click('discover-clear-sources')
    await wait('discover-search', (node) => node?.enabled === false)
    await capture('source-picker-unchecked')
    await click('discover-all-sources')
    await act('popover', 'dismiss-popover')
    await wait('discover-source-picker', (node) => node?.title === 'Sources (22/22)')
    assert.equal((await inspect()).popover, null, 'Dismissing the popover keeps the selection')
    await act('discover-runner', 'choose', 'codex')
    await click('discover-search')
    await wait('discover-results')
    const result = await capture('discover-light')
    assert.equal(find(result.root, 'discover-results').documentClass, 'TRTable')
    assert.equal(find(result.root, 'discover-results').rows.length, 3)
    assert.match(
      find(result.root, 'discover-summary').text.trimEnd(),
      /Full fixture summary ends here\.$/
    )
    assert(!find(result.root, 'discover-expand'))
    assert.match(
      find(result.root, 'discover-result-status').text,
      /^Complete · \d+ of \d+ sources succeeded · [A-Z][a-z]{2} \d{1,2}, \d{4}$/u
    )
    // Rows drag their https link out; the reading Share button hands the link to the picker.
    const drag = find(result.root, 'discover-results').dragItem
    assert.equal(new URL(drag.url).protocol, 'https:')
    assert(drag.text.startsWith(drag.title), 'The drag text is the discovery citation')
    await click('discover-share')
    assert.equal(
      new URL(find((await inspect()).root, 'discover-share').sharedURL).protocol,
      'https:'
    )
    const kinds = find(result.root, 'discover-kind')
    assert.equal(kinds.class, 'NSSegmentedControl', 'Result kinds are a segmented control')
    assert.deepEqual(
      kinds.segments.map((segment) => segment.label),
      ['All (3)', 'Papers (1)', 'Repositories (1)', 'Other (1)']
    )
    const kindsWidth = Number(kinds.frame.match(/-?\d+(?:\.\d+)?/gu)[2])
    assert(kindsWidth >= kinds.intrinsicWidth, 'No segment count is clipped')
    await act('discover-kind', 'choose', 'repository')
    const repositories = await wait('discover-results', (node) => node?.rows.length === 1)
    assert.equal(find(repositories.root, 'discover-kind').selected, 'repository')
    await act('discover-kind', 'choose', 'all')
    await wait('discover-results', (node) => node?.rows.length === 3)
    const nav = find(result.root, 'native-navigation')
    assert.equal(nav.sourceList, true, 'Workspaces use an AppKit source list')
    assert.equal(nav.selected, 'discover')
    assert.deepEqual(
      nav.rows.map((row) => row.id),
      ['discover', 'saved', 'analytics', 'sources']
    )
    assert(!find(result.root, 'native-brand'), 'The sidebar carries no in-window branding')
    const chrome = result.toolbar
    assert.equal(chrome.style, 'unified')
    assert.equal(chrome.titleVisible, true)
    assert.equal(chrome.title, 'Discover')
    assert.equal(chrome.fullSizeContent, true)
    assert.deepEqual(
      chrome.items.map((item) => item.id),
      [
        'sidebar-toggle',
        'therss.sidebar-separator',
        'NSToolbarFlexibleSpaceItem',
        'local-search-query',
        'undo-triage'
      ]
    )
    const top = (node) => Number(node.frame.match(/-?\d+(?:\.\d+)?/gu)[1])
    assert(chrome.safeTop >= 28, 'The full-size window reports its toolbar safe area')
    assert(
      top(find(result.root, 'native-main').children[0]) >= chrome.safeTop,
      'Content starts below the toolbar'
    )
    assert.equal(top(find(result.root, 'native-sidebar')), 0, 'The sidebar reaches the window top')
    // The title sits over the content column, after the toolbar's sidebar tracking separator.
    assert.equal(chrome.trackingSeparator, true)
    assert(
      Number(chrome.titleFrame.match(/-?\d+(?:\.\d+)?/gu)[0]) >= chrome.sidebarDivider,
      'The window title starts over the content column'
    )
    await click('sidebar-toggle')
    const hidden = await wait('native-workspace', (node) => node?.compactPane === 'detail')
    assert.equal(
      hidden.toolbar.items.find((item) => item.id === 'sidebar-toggle').label,
      'Show Sidebar'
    )
    assert.equal((await inspect()).toolbar.sidebarDivider, 0, 'Hiding collapses the native sidebar')
    await click('sidebar-toggle')
    await wait('native-workspace', (node) => !!node && !node.compactPane)
    for (let attempt = 0; attempt < 40 && (await inspect()).toolbar.sidebarDivider < 184; attempt++)
      await delay(50)
    assert((await inspect()).toolbar.sidebarDivider >= 184, 'Showing restores the native sidebar')
    // Animated hide/show (system split item animation); Reduce Motion changes at once.
    const sidebarState = async () => {
      const state = await inspect()
      return {
        divider: state.toolbar.sidebarDivider,
        animating: find(state.root, 'native-workspace').animating
      }
    }
    const savedWidth = async () =>
      JSON.parse(await readFile(join(profile, 'native-ui.json'), 'utf8')).sidebar
    const widthBefore = (await sidebarState()).divider
    const preferenceBefore = await savedWidth()
    const widthEvents = async () => find((await inspect()).root, 'native-workspace').widthEvents
    const eventsBefore = await widthEvents()
    const sample = async (done) => {
      const samples = []
      for (let attempt = 0; attempt < 80; attempt++) {
        samples.push(await sidebarState())
        if (done(samples.at(-1))) break
        await delay(10)
      }
      return samples
    }
    // The instant path neither completes an animator group nor draws a frame between the start
    // and end widths. A loaded CI runner can draw no intermediate frame in one 0.2 s slide (one
    // observed run), so a cycle without frames repeats, at most three times.
    const workspace = async () => find((await inspect()).root, 'native-workspace')
    const toggle = async (done) => {
      const completedBefore = (await workspace()).animationsCompleted
      await click('sidebar-toggle')
      const samples = await sample(done)
      const state = await workspace()
      return {
        samples,
        steps: state.animationSteps,
        animated: state.animationsCompleted === completedBefore + 1
      }
    }
    await act('native-workspace', 'animations', true)
    const cycles = []
    let hiding, showing
    for (let cycle = 0; cycle < 3; cycle++) {
      const hide = await toggle((state) => state.divider === 0 && !state.animating)
      assert(hide.animated, 'Hiding the sidebar runs the animated path')
      assert.equal(hide.samples.at(-1).divider, 0)
      const show = await toggle(
        (state) => Math.abs(state.divider - widthBefore) <= 1 && !state.animating
      )
      assert(show.animated, 'Showing the sidebar runs the animated path')
      assert(
        Math.abs(show.samples.at(-1).divider - widthBefore) <= 1,
        'Showing restores the saved width'
      )
      cycles.push({ hideSteps: hide.steps, showSteps: show.steps })
      hiding = hide.samples
      showing = show.samples
      if (hide.steps >= 1 && show.steps >= 1) break
    }
    assert(
      cycles.some((cycle) => cycle.hideSteps >= 1),
      `Hiding the sidebar draws intermediate widths: ${JSON.stringify(cycles)}`
    )
    assert(
      cycles.some((cycle) => cycle.showSteps >= 1),
      `Showing the sidebar draws intermediate widths: ${JSON.stringify(cycles)}`
    )
    await writeFile(
      join(output, 'sidebar-motion.json'),
      JSON.stringify({ widthBefore, cycles, hiding, showing }, null, 2)
    )
    // Reversing mid-animation ends shown at the saved width, with no stray restore.
    await click('sidebar-toggle')
    await delay(60)
    await click('sidebar-toggle')
    const reversed = await sample(
      (state) => Math.abs(state.divider - widthBefore) <= 1 && !state.animating
    )
    assert(
      Math.abs(reversed.at(-1).divider - widthBefore) <= 1,
      `A reversed toggle ends shown: ${JSON.stringify(reversed.slice(-3))}`
    )
    await delay(300)
    assert(Math.abs((await sidebarState()).divider - widthBefore) <= 1, 'The width stays settled')
    // A loaded runner can deliver the second toggle before the run loop turns, while the split
    // item still reports its old state; the sidebar must still end shown at the saved width.
    for (const stall of [0, 60]) {
      await application.evaluate(
        (_, stall) =>
          new Promise((resolve) => {
            const press = () =>
              globalThis.__nativeBridge.interactFixture(
                globalThis.__nativeWindow.getNativeWindowHandle(),
                JSON.stringify({ id: 'sidebar-toggle', action: 'click' })
              )
            press()
            globalThis.setImmediate(() => {
              const end = Date.now() + stall
              while (Date.now() < end);
              press()
              resolve()
            })
          }),
        stall
      )
      const settled = await sample(
        (state) => Math.abs(state.divider - widthBefore) <= 1 && !state.animating
      )
      await delay(300)
      const after = await sidebarState()
      assert(
        Math.abs(after.divider - widthBefore) <= 1 && !after.animating,
        `Two toggles in one main-thread turn end shown at the saved width: ${JSON.stringify({ stall, settled: settled.at(-1), after })}`
      )
    }
    assert.equal(await widthEvents(), eventsBefore, 'Animations emit no sidebar width')
    assert.equal(await savedWidth(), preferenceBefore, 'The animation writes no width preference')
    await act('native-workspace', 'reduce-motion', true)
    await click('sidebar-toggle')
    const reduced = await sidebarState()
    assert.equal(reduced.divider, 0, 'Reduce Motion hides the sidebar at once')
    assert.equal(reduced.animating, false)
    await click('sidebar-toggle')
    const restored = await sample((state) => Math.abs(state.divider - widthBefore) <= 1)
    assert(Math.abs(restored.at(-1).divider - widthBefore) <= 1, 'Reduce Motion shows it again')
    assert.equal(restored.length, 1, 'Reduce Motion shows the sidebar at once')
    await act('native-workspace', 'reduce-motion', false)
    await act('native-workspace', 'animations', false)
    assert.equal(find(result.root, 'discover-search').emphasis, 'primary')
    assert.equal(find(result.root, 'discover-search').hasSymbol, true)
    assert.equal(find(result.root, 'discover-composer').surface, 'panel')
    assert(find(result.root, 'discover-query'))
    assert(!find(result.root, 'discover-edit-search'))
    assert(!find(result.root, 'discover-done-editing'))
    await act('discover-query', 'focus')
    const editing = await wait('discover-query')
    assert.equal(editing.firstResponderId, 'discover-query')
    assert.equal(find(editing.root, 'discover-query').value, '边缘计算 structured pruning')
    await act('discover-query', 'fill', 'An unsubmitted native draft')
    assert.match(find((await inspect()).root, 'discover-draft-status').text, /Draft not searched/)
    await capture('discover-editable-draft')
    await act('discover-query', 'fill', '边缘计算 structured pruning')
    await application.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'dark'
    })
    await wait('discover-search', (node) => node?.controlAppearance === 'NSAppearanceNameDarkAqua')
    await capture('discover-editable-dark')
    await application.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'light'
    })
    await wait('discover-search', (node) => node?.controlAppearance === 'NSAppearanceNameAqua')
    const table = find(result.root, 'discover-results')
    assert.equal(table.titleLines, 2)
    assert.equal(table.rowHeight, 70)
    assert.equal(find(result.root, 'discover-reading-scroll').surface, 'reading')
    await act('discover-workspace', 'divider', 260)
    const narrowTitle = find((await inspect()).root, 'discover-results')
    const titleHeight = Number(narrowTitle.titleFrame.match(/-?\d+(?:\.\d+)?/gu)[3])
    assert(narrowTitle.titleRequiredHeight > narrowTitle.titleLineHeight)
    assert(titleHeight >= 2 * narrowTitle.titleLineHeight)
    await act('discover-workspace', 'divider', 320)
    for (const accent of ['blue', 'yellow', 'orange', 'purple', 'gray']) {
      await act('native-workspace', 'accent', accent)
      const accented = await inspect()
      assert(find(accented.root, 'discover-search').primaryColorContrast >= 4.5)
      if (accent === 'yellow') await capture('discover-yellow-accent')
    }
    await act('native-workspace', 'accent', 'system')
  })
  await step('Native reading, Save, full analysis and search details sheet', async () => {
    if (process.env.THERSS_NATIVE_COMPACT_FIXTURE === '1')
      await act('discover-reading-scroll', 'scroller', 'legacy')
    const beforeSave = await inspect()
    const actions = find(beforeSave.root, 'discover-reading-actions')
    assert(find(actions, 'discover-analyze'), 'Analysis must be in the top reading actions')
    await click('discover-save')
    const afterSave = await wait('discover-save', (node) => node?.title === 'Unsave')
    for (const id of ['discover-page', 'discover-workspace', 'discover-reading-scroll'])
      assert.equal(
        find(afterSave.root, id).frame,
        find(beforeSave.root, id).frame,
        `${id} moved after Save`
      )
    assert.equal(
      find(afterSave.root, 'discover-reading-scroll').scrollOrigin,
      find(beforeSave.root, 'discover-reading-scroll').scrollOrigin
    )
    assert.equal(afterSave.announcementCount, beforeSave.announcementCount + 1)
    // The saved result shows the star; every row keeps its kind glyph.
    const savedId = find(afterSave.root, 'discover-results').selected
    const rowIndex = find(afterSave.root, 'discover-results').rows.findIndex(
      (row) => row.id === savedId
    )
    const savedRow = await wait(
      'discover-results',
      (node) => node?.rowGlyphs?.[rowIndex]?.saved === true
    )
    const rowGlyphs = find(savedRow.root, 'discover-results').rowGlyphs
    assert(
      rowGlyphs.every((row) => row.symbol),
      'Every Discover row shows its kind glyph'
    )
    // A title that wraps keeps both lines: the frame matches the lines it needs at its width.
    for (const row of rowGlyphs)
      assert(
        Math.abs(Number(row.titleFrame.match(/-?\d+(?:\.\d+)?/gu)[3]) - row.titleTextHeight) <= 3,
        `A Discover row title keeps its lines: ${JSON.stringify(row)}`
      )
    assert.match(rowGlyphs[rowIndex].accessibilityLabel, /\. Saved\.$/u)
    assert(!/Saved/u.test(find(savedRow.root, 'discover-results').rows[rowIndex].subtitle))
    await capture('discover-saved-feedback')
    await wait('native-notice', (node) => !node?.text)
    const expired = await inspect()
    assert.equal(
      find(expired.root, 'discover-reading-scroll').frame,
      find(beforeSave.root, 'discover-reading-scroll').frame
    )
    assert.equal(expired.announcementCount, afterSave.announcementCount)
    await click('discover-metadata-toggle')
    await click('discover-analyze')
    const state = await wait('discover-analysis')
    assert.equal(find(state.root, 'discover-analysis').class, 'NSTextView')
    assert.match(find(state.root, 'discover-analysis').text, /Source hash:/)
    await act('discover-reading-scroll', 'scroll', 500)
    assert.notEqual(find((await inspect()).root, 'discover-reading-scroll').scrollOrigin, '{0, 0}')
    const rows = find(state.root, 'discover-results').rows
    await act('discover-results', 'select', rows[1].id)
    await wait('discover-reading-title', (node) => node?.text === rows[1].title)
    assert.equal(find((await inspect()).root, 'discover-reading-scroll').scrollOrigin, '{0, 0}')
    await act('discover-results', 'select', rows[0].id)
    await click('discover-details')
    const details = await wait('document-modal-content')
    assert.equal(details.modal.kind, 'column')
    assert.match(find(details.modal, 'document-modal-content').text, /Planner provenance/)
    await capture('search-details')
    await click('modal-close')
  })
  await step('A double-clicked result opens read-only in its own window', async () => {
    await go('discover')
    const listed = await wait('discover-results', (node) => node?.rows.length > 0)
    const row = find(listed.root, 'discover-results').rows[0]
    const recordWindow = () =>
      application.evaluate(({ BrowserWindow }) => {
        const main = globalThis.__nativeWindow
        const others = BrowserWindow.getAllWindows().filter((window) => window !== main)
        let record = null
        try {
          // A new window is inspectable once its native host is attached.
          if (others[0])
            record = JSON.parse(
              globalThis.__nativeBridge.inspect(others[0].getNativeWindowHandle())
            )
        } catch {
          record = null
        }
        return { count: BrowserWindow.getAllWindows().length, record }
      })
    await act('discover-results', 'double', row.id)
    let opened = await recordWindow()
    for (let attempt = 0; attempt < 60 && !opened.record?.root?.id; attempt++) {
      await delay(100)
      opened = await recordWindow()
    }
    assert.equal(opened.count, 2, 'The record opens in a second window')
    if (opened.record.toolbar.title !== row.title.slice(0, 200)) {
      // CI once saw "TheRSS" here; record what owns the title, and whether it settles.
      const titles = () =>
        application.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().map((window) => ({
            main: window === globalThis.__nativeWindow,
            electron: window.getTitle(),
            visible: window.isVisible()
          }))
        )
      const first = { native: opened.record.toolbar.title, windows: await titles() }
      await delay(1000)
      const settled = {
        native: (await recordWindow()).record?.toolbar?.title,
        windows: await titles()
      }
      assert.fail(`The record window shows the record title: ${JSON.stringify({ first, settled })}`)
    }
    assert.equal(find(opened.record.root, 'discover-reading-title').text, row.title)
    assert(find(opened.record.root, 'discover-open'), 'The record window opens the original')
    assert(!find(opened.record.root, 'discover-save'), 'The record window is read-only')
    assert(!find(opened.record.root, 'discover-analyze'), 'The record window is read-only')
    if (screenshots) {
      await delay(300)
      try {
        execFileSync(
          '/usr/sbin/screencapture',
          ['-x', `-l${opened.record.windowNumber}`, join(output, 'record-window.png')],
          { stdio: 'pipe' }
        )
      } catch (error) {
        captureFailures.push({
          name: 'record-window',
          windowNumber: opened.record.windowNumber,
          error: String(error)
        })
      }
    }
    await act('discover-results', 'double', row.id)
    await delay(300)
    assert.equal((await recordWindow()).count, 2, 'The same record focuses its existing window')
    await application.evaluate(({ BrowserWindow }) => {
      const main = globalThis.__nativeWindow
      BrowserWindow.getAllWindows()
        .find((window) => window !== main)
        ?.close()
    })
    for (let attempt = 0; attempt < 60 && (await recordWindow()).count > 1; attempt++)
      await delay(100)
    assert.equal((await recordWindow()).count, 1)
    await wait('discover-results', (node) => node?.rows.length > 0)
  })
  await step('Saved repository analysis and independent source/runner filters', async () => {
    const state = await inspect(),
      repository = find(state.root, 'discover-results').rows.find((row) =>
        row.id.startsWith('github:')
      )
    await act('discover-results', 'select', repository.id)
    await wait('discover-save')
    await click('discover-save')
    await wait('discover-save', (node) => node?.title === 'Unsave')
    await go('saved')
    await wait('saved-items')
    // A source without saved items shows the centered native empty state and its recovery.
    await act('saved-source-filter', 'choose', 'folo:312')
    const emptySaved = await wait('saved-empty-title', (node) =>
      /^No items from /u.test(node?.text || '')
    )
    const empty = find(emptySaved.root, 'saved-empty')
    assert.equal(find(empty, 'saved-empty-symbol').hasImage, true)
    assert.equal(find(empty, 'saved-empty-title').centered, true)
    const emptyWidth = Number(empty.frame.match(/-?\d+(?:\.\d+)?/gu)[2])
    const reset = find(empty, 'saved-empty-actions')
      .frame.match(/-?\d+(?:\.\d+)?/gu)
      .map(Number)
    assert(
      Math.abs(reset[0] + reset[2] / 2 - emptyWidth / 2) <= 1,
      'The recovery action is centered'
    )
    await capture('saved-empty-filter')
    await click('saved-reset-filter')
    await wait('saved-items')
    await act('saved-source-filter', 'choose', 'github')
    await act('saved-runner', 'choose', 'codex')
    await click('saved-analyze')
    const saved = await wait('saved-analysis')
    assert.equal(find(saved.root, 'saved-items').rows.length, 1)
    assert.match(find(saved.root, 'saved-analysis').text, /Analysis provenance/)
    await capture('saved-repository')
  })
  await step(
    'Settings opens in its own window and the workspace reloads saved context',
    async () => {
      const before = await windowCount()
      await useSettingsWindow()
      const opened = await wait('personal-prompt', (node) => node?.enabled)
      assert.equal(await windowCount(), before + 1, 'Settings is a separate window')
      assert.equal(opened.toolbar.style, 'preference')
      assert.equal(opened.toolbar.displayMode, 'iconAndLabel')
      assert.equal(opened.toolbar.selected, 'settings-personal')
      assert.equal(opened.toolbar.title, 'Personal Context')
      assert.deepEqual(
        opened.toolbar.items.map((item) => [item.id, item.label, item.hasImage]),
        [
          ['settings-personal', 'Personal Context', true],
          ['settings-provider', 'Model Provider', true]
        ]
      )
      assert(!find(opened.root, 'settings-tab'), 'Panes are toolbar items, not a pop-up')
      await act('personal-prompt', 'fill', '资源高效 AI 与边缘智能')
      await click('personal-save')
      await wait('settings-status', (node) => /context saved/.test(node?.text || ''))
      // Each pane opens at its content height (the top edge stays put), as in Mail and Notes:
      // the pane's form neither overflows the viewport nor leaves an empty tail under it.
      const numbers = (frame) => frame.match(/-?\d+(?:\.\d+)?/gu).map(Number)
      const settingsBounds = () => application.evaluate(() => globalThis.__nativeWindow.getBounds())
      const paneFits = async (pane, form) => {
        const state = await wait(form)
        const viewport = numbers(find(state.root, 'settings-scroll').viewportSize)[1]
        const content = numbers(find(state.root, form).frame)[3]
        // The window never grows past the screen's visible height; a taller pane scrolls there
        // (CI displays are small).
        const { bounds, workArea } = await application.evaluate(({ screen }) => {
          const bounds = globalThis.__nativeWindow.getBounds()
          return { bounds, workArea: screen.getDisplayMatching(bounds).workArea }
        })
        const capped = content > viewport + 1 && bounds.height >= workArea.height - 1
        assert(
          capped || Math.abs(content - viewport) <= 1,
          `The ${pane} pane fits its window: ${content} pt of content in ${viewport} pt ` +
            JSON.stringify({ bounds, workArea })
        )
        return state
      }
      const top = (await settingsBounds()).y
      await paneFits('Personal Context', 'personal-form')
      await click('settings-provider')
      const provider = await paneFits('Model Provider', 'provider-form')
      assert(find(provider.root, 'agent-status-claude'), 'Local agents are part of the fitted pane')
      assert.equal((await settingsBounds()).y, top, 'Fitting keeps the top edge')
      await click('settings-personal')
      await paneFits('Personal Context', 'personal-form')
      assert.equal((await settingsBounds()).y, top, 'Fitting keeps the top edge')
      // A user resize is kept: a status-line change never shrinks it and a width change does not
      // refit the height.
      const fitted = await settingsBounds()
      await application.evaluate((_, bounds) => globalThis.__nativeWindow.setBounds(bounds), {
        ...fitted,
        height: fitted.height + 80
      })
      await delay(200)
      await act('personal-prompt', 'type', ' ')
      await wait('settings-status', (node) => !node)
      assert.equal(
        (await settingsBounds()).height,
        fitted.height + 80,
        'A status change keeps a user resize'
      )
      await application.evaluate((_, bounds) => globalThis.__nativeWindow.setBounds(bounds), {
        ...fitted,
        width: fitted.width - 60,
        height: fitted.height + 80
      })
      await delay(200)
      assert.equal(
        (await settingsBounds()).height,
        fitted.height + 80,
        'A width change keeps the height'
      )
      await act('personal-prompt', 'fill', '资源高效 AI 与边缘智能')
      await capture('settings-personal')
      // Command-comma again focuses the same window.
      await menu('Settings…')
      await delay(200)
      assert.equal(await windowCount(), before + 1)
      await useMainWindow()
      await go('discover')
      await wait('discover-personalization', (node) =>
        /Personal context active/.test(node?.text || '')
      )
    }
  )
  await step('Secure key then immediate Save uses the real ordered callback queue', async () => {
    await useSettingsWindow({ open: false })
    await click('settings-provider')
    const pane = await wait('provider-name', (node) => node?.enabled)
    assert.equal(pane.toolbar.selected, 'settings-provider')
    assert.equal(pane.toolbar.title, 'Model Provider')
    await act('provider-name', 'fill', 'Native fixture')
    await act('provider-url', 'fill', 'https://fixture.invalid/v1')
    await act('provider-model', 'fill', 'fixture-model')
    const fixtureCredential = randomUUID()
    await application.evaluate((_, value) => {
      const bridge = globalThis.__nativeBridge,
        handle = globalThis.__nativeWindow.getNativeWindowHandle()
      bridge.interactFixture(
        handle,
        JSON.stringify({ id: 'provider-key', action: 'fill', value, deferFlush: true })
      )
      bridge.interactFixture(
        handle,
        JSON.stringify({ id: 'provider-save', action: 'click', deferFlush: true })
      )
    }, fixtureCredential)
    const state = await wait('settings-status', (node) => /Provider saved/.test(node?.text || ''))
    assert.equal(find(state.root, 'provider-key').class, 'NSSecureTextField')
    assert.equal(find(state.root, 'provider-key').hasValue, false)
    assert(!JSON.stringify(state).includes(fixtureCredential))
    const hashes = await application.evaluate(() => globalThis.__fixtureCipherHashes)
    assert(hashes.includes(createHash('sha256').update(fixtureCredential).digest('hex')))
    await click('provider-test')
    await wait('settings-status', (node) => /Connection successful/.test(node?.text || ''))
    await capture('settings-provider')
    const form = await inspect()
    const frameWidth = (node) => Number(node.frame.match(/-?\d+(?:\.\d+)?/gu)[2])
    assert(frameWidth(find(form.root, 'provider-form')) <= 800)
  })
  await step(
    'Secure draft survives tabs and explicit discard clears the hidden native field',
    async () => {
      await act('provider-key', 'fill', 'fixture-unsaved-replacement')
      await click('settings-personal')
      await wait('personal-prompt')
      assert.equal((await inspect()).secureDrafts['provider-key'].hasValue, true)
      await click('settings-provider')
      await wait('provider-key', (node) => node?.hasValue === true)
      await click('settings-personal')
      await wait('personal-prompt')
      // Workspace commands from the Settings window go to the main window and keep the draft.
      await menu('Saved')
      await useMainWindow()
      await wait('saved-items')
      await useSettingsWindow({ open: false })
      assert.equal((await inspect()).secureDrafts['provider-key'].hasValue, true)
      await application.evaluate(() => globalThis.__nativeWindow.close())
      await alert('Keep Editing')
      await answerAlert('Keep Editing')
      await wait('personal-prompt')
      assert.equal((await inspect()).secureDrafts['provider-key'].hasValue, true)
      await application.evaluate(() => globalThis.__nativeWindow.close())
      await alert('Discard Changes')
      await answerAlert('Discard Changes')
      for (
        let attempt = 0;
        attempt < 100 &&
        !(await application.evaluate(() => globalThis.__nativeWindow.isDestroyed()));
        attempt++
      )
        await delay(50)
      assert.equal(await application.evaluate(() => globalThis.__nativeWindow.isDestroyed()), true)
      await useMainWindow()
      // A reopened Settings window starts from the saved values, without the discarded draft.
      await useSettingsWindow()
      await click('settings-provider')
      const reopened = await wait('provider-name', (node) => node?.enabled)
      assert.equal(find(reopened.root, 'provider-name').value, 'Native fixture')
      assert.equal(reopened.secureDrafts['provider-key']?.hasValue, false)
      await application.evaluate(() => globalThis.__nativeWindow.close())
      await useMainWindow()
      await wait('saved-items')
    }
  )
  await step('Persisted Analytics metrics and complete analysis artifact', async () => {
    await go('analytics')
    await wait('analytics-analyses')
    // At the minimum window the metrics wrap as two pairs, so no metric is squeezed below its
    // label width (the pairs are laid out at their natural width).
    const wide = await application.evaluate(() => globalThis.__nativeWindow.getBounds())
    await application.evaluate(() =>
      globalThis.__nativeWindow.setBounds({ width: 820, height: 720 })
    )
    await delay(200)
    const narrowMetrics = await inspect()
    for (const id of [
      'analytics-searches',
      'analytics-window',
      'analytics-completed',
      'analytics-papers'
    ]) {
      const width = Number(find(narrowMetrics.root, id).frame.match(/-?\d+(?:\.\d+)?/gu)[2])
      assert(width >= 170, `Metric ${id} keeps its label width at 820 pt: ${width} pt`)
    }
    await application.evaluate((_, bounds) => globalThis.__nativeWindow.setBounds(bounds), wide)
    await delay(200)
    const trend = find((await inspect()).root, 'analytics-trend')
    assert.equal(trend.class, 'TRChart')
    assert.equal(trend.points.length, 7)
    assert.equal(
      trend.points.reduce((total, point) => total + point.value, 0),
      3
    )
    assert(trend.accessibleValues.includes('records returned'))
    for (const bar of trend.bars) {
      const height = Number(bar.frame.match(/-?\d+(?:\.\d+)?/gu)[3])
      assert.equal(height > 0, bar.value > 0)
    }
    await act('analytics-trend-kind', 'choose', 'today')
    await wait('analytics-trend-empty')
    await act('analytics-trend-kind', 'choose', 'analysis')
    assert.equal(
      find((await inspect()).root, 'analytics-trend').points.reduce(
        (sum, point) => sum + point.value,
        0
      ),
      2
    )
    await act('analytics-trend-kind', 'choose', 'discover')
    await click('analytics-toggle-values')
    const daily = find((await inspect()).root, 'analytics-daily')
    assert.equal(daily.rowHeight, 26)
    assert.deepEqual(
      daily.columns.map((column) => column.id),
      ['date', 'returned', 'discover', 'legacy', 'analyses']
    )
    assert(daily.rows.every((row) => Object.keys(row.cells).length === 5))
    assert.equal(daily.rows.length, 7)
    assert(Number(daily.frame.match(/-?\d+(?:\.\d+)?/gu)[3]) >= 220)
    await capture('analytics-daily-values')
    await click('analytics-toggle-values')
    const state = await inspect(),
      analyses = find(state.root, 'analytics-analyses').rows
    assert(analyses.length >= 2)
    await act('analytics-analyses', 'select', analyses[0].id)
    const selected = await wait('analytics-analysis-content')
    assert.match(find(selected.root, 'analytics-freshness').text, /current/)
    assert.match(find(selected.root, 'analytics-analysis-content').text, /Source hash:/)
    await capture('analytics')
    for (const appearance of ['dark', 'light']) {
      await application.evaluate(({ nativeTheme }, mode) => {
        nativeTheme.themeSource = mode
      }, appearance)
      await wait(
        'analytics-trend',
        (node) =>
          node?.controlAppearance ===
          (appearance === 'dark' ? 'NSAppearanceNameDarkAqua' : 'NSAppearanceNameAqua')
      )
      for (const accent of ['blue', 'yellow', 'orange', 'purple', 'gray']) {
        await act('native-workspace', 'accent', accent)
        assert(find((await inspect()).root, 'analytics-trend').graphicContrast >= 3)
      }
      await act('native-workspace', 'accent', 'system')
      await capture(`analytics-${appearance}`)
    }
  })
  await step('Source focus is separate from activation; content stays read-only', async () => {
    await go('sources')
    await wait('sources-list')
    await act('sources-group', 'choose', 'code')
    assert.equal(find((await inspect()).root, 'sources-list').rows.length, 2)
    await capture('sources-code-group')
    await act('sources-group', 'choose', 'all')
    await act('sources-list', 'key', 'down')
    const preview = await inspect()
    assert(!find(preview.root, 'source-content-items'))
    await act('sources-list', 'select', 'folo:302', { activate: true })
    await wait('source-content-items')
    assert(!find((await inspect()).root, 'source-item-save'))
    await capture('sources')
    await act('sources-list', 'select', 'folo:10', { activate: true })
    const github = await wait('source-detail-title', (node) => /GitHub/.test(node?.text || ''))
    assert.equal(find(github.root, 'sources-refresh').enabled, false)
  })
  await step('Local search uses the toolbar field and safe external-open routing', async () => {
    await menu('Find Local Research')
    const initial = await wait('local-search-query', (node) => node?.editing === true)
    assert.equal(initial.modal, null, 'Local search no longer opens a sheet')
    assert(!find(initial.root, 'local-search-submit'))
    await act('local-search-query', 'fill', 'pruning')
    const state = await wait('local-search-results')
    assert(!find(state.root, 'local-search-open-in-app'))
    assert(find(state.root, 'local-search-results').rows.length > 0)
    assert.equal(state.toolbar.title, 'Search')
    assert.equal(
      find(state.root, 'native-navigation').selected,
      '',
      'No workspace is selected while a local search shows'
    )
    await click('local-search-open')
    const opened = await application.evaluate(() => globalThis.__nativeOpened)
    assert(opened.every((url) => new URL(url).protocol === 'https:'))
    await capture('local-search')
    for (const kind of ['saved', 'discover']) {
      const searchState = await inspect()
      const target = find(searchState.root, 'local-search-results').rows.find((row) =>
        row.id.startsWith(kind + ':')
      )
      assert(target, `Fixture must include a ${kind} local target`)
      await act('local-search-results', 'select', target.id)
      await act('local-search-results', 'key', 'enter')
      await wait('local-search-page', (node) => !node)
      const openedLocal = await wait('return-local-search')
      assert.equal(find(openedLocal.root, `${kind}-reading-title`).text, target.title)
      assert.equal(openedLocal.modal, null)
      await capture(`local-open-${kind}`)
      await click('return-local-search')
      const restored = await wait('local-search-results')
      assert.equal(find(restored.root, 'local-search-results').selected, target.id)
      assert.equal(
        restored.toolbar.items.find((item) => item.id === 'local-search-query').value,
        'pruning'
      )
    }
    await act('local-search-query', 'fill', 'analysis')
    await wait('local-search-result-count', (node) => /for “analysis”/.test(node?.text || ''))
    const analysisResults = await wait('local-search-results')
    const analysisTarget = find(analysisResults.root, 'local-search-results').rows.find((row) =>
      row.id.startsWith('analysis:')
    )
    assert(analysisTarget, 'Fixture must include a stored analysis target')
    await act('local-search-results', 'select', analysisTarget.id)
    await act('local-search-results', 'key', 'enter')
    await wait('local-search-page', (node) => !node)
    const localAnalysis = await wait('analytics-local-record')
    assert(
      find(localAnalysis.root, 'analytics-analysis-content').text.includes(
        analysisTarget.id.slice('analysis:'.length)
      )
    )
    await capture('local-open-analysis')
    await click('return-local-search')
    await wait('local-search-results')
    await act('local-search-query', 'key', 'escape')
    const cleared = await wait('local-search-page', (node) => !node)
    assert.notEqual(
      cleared.toolbar.title,
      'Search',
      'Escape ends search and restores the workspace'
    )
  })
  await step(
    'Promotion preview includes verified facts and produces a fixture receipt only after confirmation',
    async () => {
      await go('discover')
      await wait('discover-results')
      const rows = find((await inspect()).root, 'discover-results').rows
      await act('discover-results', 'select', rows.find((row) => row.id.startsWith('arxiv:')).id)
      await click('discover-promote')
      await wait('promotion-confirm')
      const preview = await capture('promotion-preview')
      assert.match(find(preview.modal, 'promotion-preview-text').text, /SHA-256:/)
      assert.match(find(preview.modal, 'promotion-preview-text').text, /raw\/papers\//)
      await click('promotion-confirm')
      const confirmation = await alert('Cancel')
      await writeFile(
        join(output, 'promotion-native-confirmation.json'),
        JSON.stringify(confirmation, null, 2)
      )
      // Do not force the parent window key while AppKit owns the modal alert.
      if (screenshots)
        execFileSync(
          '/usr/sbin/screencapture',
          [
            '-x',
            `-l${confirmation.alerts[0].windowNumber}`,
            join(output, 'promotion-native-confirmation.png')
          ],
          { stdio: 'pipe' }
        )
      await answerAlert('Cancel')
      await wait('promotion-receipt-text', (node) =>
        /cancelled before writing/.test(node?.text || '')
      )
      await click('modal-close')
      await click('discover-promote')
      await wait('promotion-confirm')
      await click('promotion-confirm')
      await alert('Write to llm-wiki')
      await delay(1200)
      await alert('Write to llm-wiki')
      await answerAlert(
        process.env.THERSS_NATIVE_DIALOG_STRESS === '1' ? 'Cancel' : 'Write to llm-wiki'
      )
      const receipt = await wait('promotion-receipt-text', (node) =>
        /Operation receipt/.test(node?.text || '')
      )
      assert.match(
        find(receipt.modal, 'promotion-receipt-text').text,
        process.env.THERSS_NATIVE_DIALOG_STRESS === '1'
          ? /cancelled before writing/
          : /without writing the real vault/
      )
      await click('modal-close')
    }
  )
  if (process.env.THERSS_NATIVE_DIALOG_STRESS === '1')
    await step('Repeated native confirmations remain open until an explicit choice', async () => {
      for (let index = 0; index < 12; index++) {
        await click('discover-promote')
        await wait('promotion-confirm')
        await click('promotion-confirm')
        await alert('Write to llm-wiki')
        await delay(2000)
        await alert('Write to llm-wiki')
        await answerAlert('Cancel')
        await wait('promotion-receipt-text', (node) => /Operation receipt/.test(node?.text || ''))
        await click('modal-close')
        await wait('modal-close', (node) => !node)
      }
    })
  await step('Native editing Undo, zoom, dividers and narrow window layout', async () => {
    await act('discover-query', 'fill', '')
    await act('discover-query', 'type', 'native undo fixture')
    await wait('discover-query', (node) => node?.value === 'native undo fixture')
    await menu('Undo')
    await wait('discover-query', (node) => node?.value === '')
    await act('discover-query', 'fill', '边缘计算 structured pruning')
    // Outside a text field, Edit > Undo (Command-Z) must reach the triage history.
    const saveTitle = find((await inspect()).root, 'discover-save').title
    await click('discover-save')
    await wait('discover-save', (node) => !!node && node.title !== saveTitle)
    await act('discover-results', 'focus')
    await menu('Undo')
    await wait('discover-save', (node) => node?.title === saveTitle)
    await menu('Zoom In')
    await delay(80)
    assert.equal((await inspect()).zoom, 1.1)
    await menu('Actual Size')
    await delay(80)
    assert.equal((await inspect()).zoom, 1)
    await act('native-workspace', 'divider', 248)
    await act('discover-workspace', 'divider', 350)
    await act('discover-workspace', 'focus')
    await act('discover-workspace', 'key', 'right', { shift: true })
    await act('discover-workspace', 'key', 'escape')
    await delay(300)
    const prefs = JSON.parse(await readFile(join(profile, 'native-ui.json'), 'utf8'))
    assert.equal(prefs.sidebar, 248)
    assert.equal(prefs.discover, 350)
    await application.evaluate(() =>
      globalThis.__nativeWindow.setBounds({ width: 820, height: 720 })
    )
    await delay(200)
    const narrow = await capture('discover-narrow')
    assert.equal(find(narrow.root, 'discover-workspace').compactPane, 'list')
    // 820 px is the window minimum: the wrapped results row still fits every segment count.
    const narrowKinds = find(narrow.root, 'discover-kind')
    assert(
      Number(narrowKinds.frame.match(/-?\d+(?:\.\d+)?/gu)[2]) >= narrowKinds.intrinsicWidth,
      'Segment counts are not clipped at the minimum window width'
    )
    assert.equal(find(narrow.root, 'discover-results').hidden, false)
    assert.equal(find(narrow.root, 'discover-reading-scroll').hidden, true)
    const selectedBefore = find(narrow.root, 'discover-results').selected
    await act('discover-results', 'key', 'enter')
    const reader = await capture('discover-narrow-reading')
    assert.equal(find(reader.root, 'discover-workspace').compactPane, 'detail')
    assert.equal(find(reader.root, 'discover-results').hidden, true)
    assert.equal(find(reader.root, 'discover-reading-scroll').hidden, false)
    assert(!find(reader.root, 'discover-composer'))
    assert.equal(reader.firstResponderId, 'discover-summary')
    await click('discover-back-to-results')
    const returned = await wait('discover-workspace', (node) => node?.compactPane === 'list')
    assert.equal(find(returned.root, 'discover-results').selected, selectedBefore)
    assert.equal(returned.firstResponderId, 'discover-results')
    const frameValues = (frame) => frame.match(/-?\d+(?:\.\d+)?/g).map(Number)
    await application.evaluate(() =>
      globalThis.__nativeWindow.setBounds({ width: 820, height: 600 })
    )
    for (let count = 0; count < 5; count++) await menu('Zoom In')
    await delay(100)
    await act('discover-results', 'key', 'enter')
    const zoomed = await inspect()
    assert.equal(zoomed.zoom, 1.5)
    assert.equal(find(zoomed.root, 'discover-workspace').compactPane, 'detail')
    assert.equal(find(zoomed.root, 'discover-results').rowFontSize, 19.5)
    assert(
      frameValues(find(zoomed.root, 'discover-reading-scroll').frame)[3] >= 300,
      'Compact zoomed reading must keep a usable full-width viewport'
    )
    const main = find(zoomed.root, 'native-main')
    assert(
      frameValues(main.documentFrame)[3] <= frameValues(main.viewportSize)[1] + 1,
      'Reading mode must not require an outer page scroll at minimum window size'
    )
    await capture('discover-narrow-zoomed')
    assert(zoomed.toolbar.sidebarDivider > 0, 'A narrow zoomed window keeps the sidebar shown')
    await click('discover-back-to-results')
    await menu('Actual Size')
    await application.evaluate(() =>
      globalThis.__nativeWindow.setBounds({ width: 820, height: 720 })
    )
    await go('sources')
    if (find((await inspect()).root, 'sources-back-to-results'))
      await click('sources-back-to-results')
    await wait('sources-filters')
    const sourceNarrow = await capture('sources-narrow')
    const filters = find(sourceNarrow.root, 'sources-filters')
    const numbers = (frame) => frame.match(/-?\d+(?:\.\d+)?/g).map(Number)
    const width = numbers(filters.frame)[2]
    for (const child of filters.children) {
      const [x, , w] = numbers(child.frame)
      assert(x + w <= width + 1, `${child.id} overflows the narrow native toolbar`)
    }
    await go('discover')
    await wait('discover-workspace')
    await application.evaluate(() =>
      globalThis.__nativeWindow.setBounds({ width: 1360, height: 880 })
    )
    await delay(150)
    const widened = sidebarFits(await inspect(), 248)
    assert(widened.ok, `Widening restores the saved sidebar width: ${JSON.stringify(widened)}`)
    assert.equal(
      JSON.parse(await readFile(join(profile, 'native-ui.json'), 'utf8')).sidebar,
      248,
      'Narrow and zoomed windows do not change the saved sidebar width'
    )
    await application.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'dark'
    })
    const dark = await capture('discover-dark')
    assert.match(dark.root.appearance, /DarkAqua/)
    await act('native-workspace', 'appearance', 'contrast-dark')
    const contrast = await capture('discover-contrast-dark')
    assert.equal(find(contrast.root, 'native-sidebar').material, 'opaque')
    assert.equal(find(contrast.root, 'native-navigation').selected, 'discover')
    await act('native-workspace', 'appearance', 'contrast-light')
    await capture('discover-contrast-light')
    await act('native-workspace', 'appearance', 'light')
    await application.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'light'
    })
  })
  await step(
    'Dirty marked-text close guard and native window recreation preserve data/preferences',
    async () => {
      const destroyed = () => application.evaluate(() => globalThis.__nativeWindow.isDestroyed())
      const untilDestroyed = async () => {
        for (let attempt = 0; attempt < 100 && !(await destroyed()); attempt++) await delay(50)
        assert.equal(await destroyed(), true)
      }
      await useSettingsWindow()
      await wait('personal-prompt', (node) => node?.enabled)
      await act('personal-prompt', 'fill', '')
      await act('personal-prompt', 'mark', '尚未保存')
      await application.evaluate(() => globalThis.__nativeWindow.close())
      await alert('Keep Editing')
      await answerAlert('Keep Editing')
      assert.equal(await destroyed(), false)
      assert.equal(find((await inspect()).root, 'personal-prompt').value, '尚未保存')
      await application.evaluate(() => globalThis.__nativeWindow.close())
      await alert('Discard Changes')
      await answerAlert('Discard Changes')
      await untilDestroyed()
      // With only the Settings window left, activation recreates the workspace window. The
      // workspace window has no Settings drafts and closes without a prompt.
      await useMainWindow()
      await useSettingsWindow()
      await wait('personal-prompt', (node) => node?.enabled)
      await useMainWindow()
      await application.evaluate(() => globalThis.__nativeWindow.close())
      await untilDestroyed()
      assert.equal(await windowCount(), 1, 'The Settings window stays open')
      await application.evaluate(({ app }) => app.emit('activate'))
      for (let attempt = 0; attempt < 100; attempt++) {
        if (
          await application.evaluate(({ BrowserWindow }) => {
            const window = BrowserWindow.getAllWindows().find((candidate) => {
              try {
                const state = JSON.parse(
                  globalThis.__nativeBridge.inspect(candidate.getNativeWindowHandle())
                )
                return state.toolbar?.style !== 'preference'
              } catch {
                return false
              }
            })
            if (!window) return false
            globalThis.__nativeWindow = window
            globalThis.__mainWindow = window
            return true
          })
        )
          break
        await delay(50)
      }
      assert.equal(await windowCount(), 2, 'A new workspace window joins the Settings window')
      await wait('discover-results')
      // The controller-hosted sidebar takes its saved width right after the first layout.
      let reopened = await wait('native-sidebar')
      for (let attempt = 0; attempt < 40 && !sidebarFits(reopened, 248).ok; attempt++) {
        await delay(50)
        reopened = await inspect()
      }
      assert(sidebarFits(reopened, 248).ok, JSON.stringify(sidebarFits(reopened, 248)))
      assert.equal(reopened.nativeRoot, 'TRCanvas')
      assert(find(reopened.root, 'discover-results').rows.length > 0)
      // A new Settings window loads the saved context: wait for its load, not only the node.
      await useSettingsWindow()
      const settings = await wait('personal-prompt', (node) => node?.enabled)
      assert.equal(find(settings.root, 'personal-prompt').value, '资源高效 AI 与边缘智能')
      await application.evaluate(() => globalThis.__nativeWindow.close())
      await useMainWindow()
      await go('discover')
    }
  )
  await step(
    'Explicit Saved snapshot update preserves SQLite history and refreshes native reading',
    async () => {
      const before = await savedSourceUpdateFixture(application, profile, true)
      await go('saved')
      await wait('saved-items')
      await act('saved-source-filter', 'choose', 'github')
      await wait('saved-update-source', (node) => node?.enabled)
      await application.evaluate(() =>
        globalThis.__nativeWindow.setBounds({ width: 820, height: 600 })
      )
      await delay(100)
      await capture('saved-update-ready-narrow')
      await act('saved-update-source', 'focus')
      await press('saved-update-source', 'key', 'space')
      await wait('saved-source-update-status', (node) =>
        /No newer local snapshot/.test(node?.text || '')
      )
      await act('saved-items', 'key', 'enter')
      const updated = await wait('saved-summary', (node) =>
        /Newer locally retrieved/.test(node?.text || '')
      )
      await wait('saved-analysis-freshness', (node) => /changed|stale/i.test(node?.text || ''))
      assert.equal(find(updated.root, 'saved-update-source').enabled, false)
      const after = await savedSourceUpdateFixture(application, profile)
      assert.equal(after.item.triage_state, 'saved')
      assert.equal(after.item.triage_updated_at, before.item.triage_updated_at)
      assert.equal(after.item.first_seen_at, before.item.first_seen_at)
      assert.deepEqual(after.artifacts, before.artifacts)
      assert.notEqual(after.item.summary, before.item.summary)
      await capture('saved-update-stale-analysis-narrow')
      await application.evaluate(() =>
        globalThis.__nativeWindow.setBounds({ width: 1280, height: 900 })
      )
      await go('sources')
      await wait('sources-list')
      await act('sources-list', 'select', 'folo:611', { activate: true })
      const month = await wait('source-content-summary', (node) =>
        /exact day unavailable/.test(node?.text || '')
      )
      assert.match(find(month.root, 'source-content-items').rows[0].subtitle, /month only/)
      assert.match(
        find(month.root, 'source-content-summary').text,
        /Updated: Not supplied separately/
      )
      await capture('sources-publication-month')
    }
  )
  await step(
    'Latest recorded source feedback replaces old checks and stays local to Sources',
    async () => {
      const observedAt = await sourceHealthFixture(application, profile)
      await application.evaluate(() =>
        globalThis.__nativeWindow.setBounds({ width: 1360, height: 880 })
      )
      await go('sources')
      await act('sources-list', 'select', 'folo:10', { activate: true })
      await wait('source-detail-health', (node) => /Latest search/.test(node?.text || ''))
      assert(!find((await inspect()).root, 'source-health-attention'))
      await act('sources-list', 'select', 'folo:444', { activate: true })
      const failed = await wait('source-detail-health', (node) =>
        /Failed · Latest search/.test(node?.text || '')
      )
      assert.match(
        find(failed.root, 'source-detail-health').text,
        new RegExp(observedAt.slice(0, 10))
      )
      assert.match(find(failed.root, 'source-health-error').text, /twenty entries/)
      await capture('sources-recorded-failed')
      await act('sources-list', 'select', 'folo:523', { activate: true })
      const empty = await wait('source-detail-health', (node) =>
        /No matches · Latest search/.test(node?.text || '')
      )
      assert(!find(empty.root, 'source-health-error'))
      await capture('sources-recorded-no-matches')
      await act('sources-attention', 'click')
      const filtered = await wait('sources-attention', (node) => node?.checked === true)
      assert(!find(filtered.root, 'sources-list').rows.some((row) => row.id === 'folo:523'))
      await act('sources-list', 'select', 'folo:611', { activate: true })
      await wait('source-detail-health', (node) => /Partial · Latest search/.test(node?.text || ''))
      await application.evaluate(() =>
        globalThis.__nativeWindow.setBounds({ width: 820, height: 720 })
      )
      await application.evaluate(({ nativeTheme }) => {
        nativeTheme.themeSource = 'dark'
      })
      const partial = await capture('sources-recorded-partial-narrow-dark')
      assert.match(find(partial.root, 'source-health-error').text, /seven entries/)
    }
  )
  const final = await inspect()
  assert.deepEqual(
    captureFailures,
    [],
    'Native screenshots must be captured as well as behavioral checks'
  )
  assert.equal(
    await application.evaluate(() =>
      globalThis.__nativeWindow.webContents.executeJavaScript('document.body.childElementCount')
    ),
    0
  )
  const { applicationErrors, platformDiagnostics } = classifyNativeSmokeStderr(errors)
  assert.deepEqual(applicationErrors, [])
  await writeFile(
    join(output, 'result.json'),
    JSON.stringify(
      {
        passed: true,
        screenshots,
        legacyScrollers: appKitOptions.legacyScrollers,
        dialogs: await application.evaluate(() => globalThis.__fixtureDialogs),
        profile,
        checks,
        errors,
        platformDiagnostics,
        webElementCount: 0,
        nativeRoot: final.nativeRoot
      },
      null,
      2
    )
  )
  process.stdout.write(
    `Native AppKit ${screenshots ? 'acceptance' : 'behavior-only checks'} passed: ${checks.length} workflow groups. Evidence: ${output}\n`
  )
} catch (error) {
  let state
  try {
    state = await capture('failure')
  } catch {
    state = null
  }
  await writeFile(
    join(output, 'result.json'),
    JSON.stringify(
      {
        passed: false,
        profile,
        checks,
        errors,
        error: String(error),
        state,
        dialogs: await application.evaluate(() => globalThis.__fixtureDialogs)
      },
      null,
      2
    )
  )
  throw error
} finally {
  // Failed fixture assertions must not strand an accepted operation in a dialog.
  try {
    const state = await inspect()
    for (const entry of state.alerts)
      await answerAlert(entry.buttons.includes('Cancel') ? 'Cancel' : 'Discard Changes')
    await application.evaluate(({ dialog }) => {
      dialog.showMessageBox = async (_, options) => ({
        response: options.buttons.includes('Discard Changes') ? 1 : 0
      })
    })
  } catch {
    /* A lifecycle test may already have closed the window. */
  }
  await application.close()
}

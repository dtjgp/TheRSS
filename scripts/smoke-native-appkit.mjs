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

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(
  process.env.THERSS_NATIVE_EVIDENCE_DIR || join(project, 'test-results/appkit-native')
)
await mkdir(output, { recursive: true })
const profile = await mkdtemp(join(tmpdir(), 'therss-appkit-acceptance-'))
const screenshots = process.env.THERSS_NATIVE_SCREENSHOTS !== '0'
const checks = [],
  errors = [],
  captureFailures = []
const launchEnvironment = {
  ...process.env,
  THERSS_E2E_FIXTURES: '1',
  THERSS_E2E_NATIVE_DIALOGS: '1',
  THERSS_UI: 'appkit'
}
if (process.env.THERSS_NATIVE_DEFAULT_ONLY === '1') delete launchEnvironment.THERSS_UI
const application = await electron.launch({
  ...(process.env.THERSS_NATIVE_APP_EXECUTABLE
    ? { executablePath: process.env.THERSS_NATIVE_APP_EXECUTABLE }
    : {}),
  args: [
    `--user-data-dir=${profile}`,
    ...(process.env.THERSS_NATIVE_APP_EXECUTABLE ? [] : [project])
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
    const node = find(state.root, id) || find(state.modal, id)
    if (predicate(node)) return state
    await delay(100)
  }
  throw new Error(`Native control did not reach its expected state: ${id}`)
}
async function click(id) {
  await wait(id, (node) => !!node && node.enabled !== false)
  await act(id, 'click')
}
async function alert(title) {
  for (let count = 0; count < 100; count++) {
    const state = await inspect()
    if (state.alerts.some((entry) => entry.buttons.includes(title))) return state
    await delay(100)
  }
  throw new Error(`Native alert did not appear: ${title}`)
}
const answerAlert = (title) => act('', 'alert', title)
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
async function capture(name) {
  if (!screenshots) {
    const state = await inspect()
    await writeFile(join(output, `${name}.json`), JSON.stringify(state, null, 2))
    return state
  }
  await application.evaluate(({ app }) => {
    app.focus({ steal: true })
    globalThis.__nativeWindow.show()
    globalThis.__nativeWindow.focus()
  })
  const bounds = await application.evaluate(() => globalThis.__nativeWindow.getBounds())
  let state
  for (let attempt = 0; attempt < 60; attempt++) {
    state = await inspect()
    const placement = state.ownedWindowServerEntries?.find(
      (entry) => entry.kCGWindowNumber === state.windowNumber
    )?.kCGWindowBounds
    if (placement && Math.abs(placement.X - bounds.x) < 1 && Math.abs(placement.Y - bounds.y) < 1)
      break
    await delay(50)
  }
  await delay(80)
  state = await inspect()
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
        await application.evaluate(({ app }) => {
          app.focus({ steal: true })
          globalThis.__nativeWindow.show()
          globalThis.__nativeWindow.focus()
        })
        await delay(500)
        state = await inspect()
      }
    }
  }
  return state
}
async function step(name, run) {
  const started = Date.now()
  await run()
  checks.push({ name, passed: true, elapsedMs: Date.now() - started })
  process.stdout.write(`PASS ${name}\n`)
}

try {
  await application.evaluate(({ app, BrowserWindow, shell, clipboard, safeStorage, dialog }) => {
    const { createRequire } = process.getBuiltinModule('node:module')
    globalThis.__nativeBridge = createRequire(app.getAppPath() + '/package.json')(
      app.getAppPath() + '/out/native-appkit/therss-ui.node'
    )
    globalThis.__nativeWindow = BrowserWindow.getAllWindows()[0]
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
  })
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
    assert.equal(flatten(state.root).filter((node) => node.kind === 'check').length, 22)
    await click('discover-clear-sources')
    await wait('discover-search', (node) => node?.enabled === false)
    await click('discover-all-sources')
    await click('discover-source-picker')
    await act('discover-runner', 'choose', 'codex')
    await click('discover-search')
    await wait('discover-results')
    const result = await capture('discover-light')
    assert.equal(find(result.root, 'discover-results').documentClass, 'TRTable')
    assert.equal(find(result.root, 'discover-results').rows.length, 3)
    assert.match(find(result.root, 'discover-result-status').text, /completed/)
  })
  await step('Native reading, Save, full analysis and search details sheet', async () => {
    if (process.env.THERSS_NATIVE_COMPACT_FIXTURE === '1')
      await act('discover-reading-scroll', 'scroller', 'legacy')
    await click('discover-save')
    await wait('discover-save', (node) => node?.title === 'Unsave')
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
  await step('Saved repository analysis and independent source/runner filters', async () => {
    const state = await inspect(),
      repository = find(state.root, 'discover-results').rows.find((row) =>
        row.id.startsWith('github:')
      )
    await act('discover-results', 'select', repository.id)
    await wait('discover-save')
    await click('discover-save')
    await wait('discover-save', (node) => node?.title === 'Unsave')
    await click('navigate-saved')
    await wait('saved-items')
    await act('saved-source-filter', 'choose', 'github')
    await act('saved-runner', 'choose', 'codex')
    await click('saved-analyze')
    const saved = await wait('saved-analysis')
    assert.equal(find(saved.root, 'saved-items').rows.length, 1)
    assert.match(find(saved.root, 'saved-analysis').text, /Analysis provenance/)
    await capture('saved-repository')
  })
  await step('Secure key then immediate Save uses the real ordered callback queue', async () => {
    await click('navigate-settings')
    await wait('personal-prompt', (node) => node?.enabled)
    await act('personal-prompt', 'fill', '资源高效 AI 与边缘智能')
    await click('personal-save')
    await wait('settings-status', (node) => /context saved/.test(node?.text || ''))
    await act('settings-tab', 'choose', 'provider')
    await wait('provider-name', (node) => node?.enabled)
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
    await wait('settings-status', (node) => /connected/.test(node?.text || ''))
    await capture('settings-provider')
  })
  await step(
    'Secure draft survives tabs and explicit discard clears the hidden native field',
    async () => {
      await act('provider-key', 'fill', 'fixture-unsaved-replacement')
      await act('settings-tab', 'choose', 'personal')
      await wait('personal-prompt')
      assert.equal((await inspect()).secureDrafts['provider-key'].hasValue, true)
      await act('settings-tab', 'choose', 'provider')
      await wait('provider-key', (node) => node?.hasValue === true)
      await act('settings-tab', 'choose', 'personal')
      await wait('personal-prompt')
      await menu('Saved')
      await alert('Keep Editing')
      await answerAlert('Keep Editing')
      await wait('personal-prompt')
      assert.equal((await inspect()).secureDrafts['provider-key'].hasValue, true)
      await menu('Saved')
      await alert('Discard Changes')
      await answerAlert('Discard Changes')
      await wait('saved-items')
      assert.equal((await inspect()).secureDrafts['provider-key'].hasValue, false)
    }
  )
  await step('Persisted Analytics metrics and complete analysis artifact', async () => {
    await click('navigate-analytics')
    await wait('analytics-analyses')
    const state = await inspect(),
      analyses = find(state.root, 'analytics-analyses').rows
    assert(analyses.length >= 2)
    await act('analytics-analyses', 'select', analyses[0].id)
    const selected = await wait('analytics-analysis-content')
    assert.match(find(selected.root, 'analytics-freshness').text, /current/)
    assert.match(find(selected.root, 'analytics-analysis-content').text, /Source hash:/)
    await capture('analytics')
  })
  await step('Source focus is separate from activation; content stays read-only', async () => {
    await click('navigate-sources')
    await wait('sources-list')
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
  await step('Local search uses a native sheet and safe external-open routing', async () => {
    await menu('Find Local Research')
    const initial = await wait('local-search-query')
    assert.equal(initial.firstResponderId, 'local-search-query')
    await act('local-search-query', 'key', 'tab')
    const tabbed = await inspect()
    assert(find(tabbed.modal, tabbed.firstResponderId), 'Tab focus must remain in the native sheet')
    await act('local-search-query', 'fill', 'pruning')
    await click('local-search-submit')
    const state = await wait('local-search-results')
    assert(find(state.modal, 'local-search-results').rows.length > 0)
    await click('local-search-open')
    const opened = await application.evaluate(() => globalThis.__nativeOpened)
    assert(opened.every((url) => new URL(url).protocol === 'https:'))
    await capture('local-search')
    await act('local-search-query', 'key', 'escape')
    await wait('local-search-query', (node) => !node)
    assert((await inspect()).firstResponderId, 'Closing a sheet must restore native focus')
  })
  await step(
    'Promotion preview includes verified facts and produces a fixture receipt only after confirmation',
    async () => {
      await click('navigate-discover')
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
    assert.equal(find(narrow.root, 'discover-workspace').vertical, false)
    assert.match(find(narrow.root, 'native-sidebar').frame, /184,/)
    const frameValues = (frame) => frame.match(/-?\d+(?:\.\d+)?/g).map(Number)
    const splitHeight = () =>
      inspect().then((state) => frameValues(find(state.root, 'discover-list-pane').frame)[3])
    const initialHeight = await splitHeight()
    await act('discover-workspace', 'focus')
    await act('discover-workspace', 'key', 'down')
    assert.equal(await splitHeight(), initialHeight + 8)
    await act('discover-workspace', 'key', 'escape')
    assert.equal(await splitHeight(), initialHeight)
    await application.evaluate(() =>
      globalThis.__nativeWindow.setBounds({ width: 820, height: 600 })
    )
    for (let count = 0; count < 5; count++) await menu('Zoom In')
    await delay(100)
    const zoomed = await inspect()
    assert.equal(zoomed.zoom, 1.5)
    assert.equal(find(zoomed.root, 'discover-results').rowFontSize, 19.5)
    assert(
      frameValues(find(zoomed.root, 'discover-workspace').frame)[3] >= 320,
      'Minimum-height zoomed window must retain usable list and reading panes'
    )
    await act('native-main', 'scroll', 300)
    assert.notEqual(find((await inspect()).root, 'native-main').scrollOrigin, '{0, 0}')
    await capture('discover-narrow-zoomed')
    await menu('Actual Size')
    await application.evaluate(() =>
      globalThis.__nativeWindow.setBounds({ width: 820, height: 720 })
    )
    await click('navigate-sources')
    await wait('sources-filters')
    const sourceNarrow = await capture('sources-narrow')
    const filters = find(sourceNarrow.root, 'sources-filters')
    const numbers = (frame) => frame.match(/-?\d+(?:\.\d+)?/g).map(Number)
    const width = numbers(filters.frame)[2]
    for (const child of filters.children) {
      const [x, , w] = numbers(child.frame)
      assert(x + w <= width + 1, `${child.id} overflows the narrow native toolbar`)
    }
    await click('navigate-discover')
    await wait('discover-workspace')
    await application.evaluate(() =>
      globalThis.__nativeWindow.setBounds({ width: 1360, height: 880 })
    )
    await delay(150)
    assert.match(find((await inspect()).root, 'native-sidebar').frame, /248,/)
    await application.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'dark'
    })
    await capture('discover-dark')
    await application.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'light'
    })
  })
  await step(
    'Dirty marked-text close guard and native window recreation preserve data/preferences',
    async () => {
      await click('navigate-settings')
      await wait('personal-prompt')
      await act('personal-prompt', 'fill', '')
      await act('personal-prompt', 'mark', '尚未保存')
      await application.evaluate(() => globalThis.__nativeWindow.close())
      await alert('Keep Editing')
      await answerAlert('Keep Editing')
      assert.equal(await application.evaluate(() => globalThis.__nativeWindow.isDestroyed()), false)
      assert.equal(find((await inspect()).root, 'personal-prompt').value, '尚未保存')
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
      await application.evaluate(({ app }) => app.emit('activate'))
      for (let attempt = 0; attempt < 100; attempt++) {
        if (
          await application.evaluate(({ BrowserWindow }) => {
            const window = BrowserWindow.getAllWindows()[0]
            if (!window) return false
            globalThis.__nativeWindow = window
            return true
          })
        )
          break
        await delay(50)
      }
      const reopened = await wait('discover-results')
      assert.equal(reopened.nativeRoot, 'TRCanvas')
      assert.match(find(reopened.root, 'native-sidebar').frame, /248,/)
      assert(find(reopened.root, 'discover-results').rows.length > 0)
      await click('navigate-settings')
      const settings = await wait('personal-prompt')
      assert.equal(find(settings.root, 'personal-prompt').value, '资源高效 AI 与边缘智能')
      await click('navigate-discover')
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
  const applicationErrors = errors.filter(
    (line) =>
      !/^\d{4}-\d{2}-\d{2} .* error messaging the mach port for IMKCFRunLoopWakeUpReliable\s*$/.test(
        line
      )
  )
  assert.deepEqual(applicationErrors, [])
  await writeFile(
    join(output, 'result.json'),
    JSON.stringify(
      {
        passed: true,
        screenshots,
        dialogs: await application.evaluate(() => globalThis.__fixtureDialogs),
        profile,
        checks,
        errors,
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

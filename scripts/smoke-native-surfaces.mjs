/**
 * Opt-in smoke check for the macOS-native surfaces that unit tests and the Electron
 * E2E flow cannot reach: the real system accent travelling OS -> main -> IPC -> DOM,
 * a real NSMenu opening via Menu.popup(), and the clipboard/openExternal side effects
 * of its entries.
 *
 * Run with `npm run smoke:native`. It launches a disposable profile with fixtures, so
 * it performs no live source or model call and touches no real user data.
 */
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process, { env } from 'node:process'
import { _electron as electron } from '@playwright/test'

const VALID_ACCENTS = ['blue', 'purple', 'red', 'orange', 'green', 'teal', 'cyan', 'indigo', 'gray']
const results = []
let failures = 0

function check(label, passed, detail) {
  results.push(`${passed ? 'PASS' : 'FAIL'}  ${label}\n        ${detail}`)
  if (!passed) failures += 1
}

const userDataDirectory = await mkdtemp(join(tmpdir(), 'therss-verify-'))
const application = await electron.launch({
  args: [`--user-data-dir=${userDataDirectory}`, '.'],
  env: { ...env, HOME: userDataDirectory, THERSS_E2E_FIXTURES: '1' }
})
const page = await application.firstWindow()
await page.waitForSelector('.app-shell')

// ---- 1. Real OS accent -> main -> IPC -> renderer attribute ---------------
const reportedHex = await application.evaluate(({ systemPreferences }) => {
  try {
    return systemPreferences.getAccentColor()
  } catch {
    return null
  }
})
const viaApi = await page.evaluate(() => window.therss.getSystemAccent())
const appliedAccent = await page.evaluate(
  () => document.documentElement.dataset.systemAccent ?? null
)

check(
  'main resolves the OS accent to a valid palette name',
  viaApi !== null && VALID_ACCENTS.includes(viaApi),
  `macOS reported "${String(reportedHex)}" -> main resolved "${String(viaApi)}"`
)
check(
  'the renderer applied exactly what main resolved',
  appliedAccent === viaApi,
  `DOM data-system-accent="${String(appliedAccent)}" vs API "${String(viaApi)}"`
)

const accentValue = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--system-accent').trim()
)
const focusRule = await page.evaluate(() => {
  const el = document.querySelector('button')
  return el ? getComputedStyle(el).getPropertyValue('--system-accent').trim() : ''
})
check('--system-accent computes to a real colour', accentValue.length > 0, `"${accentValue}"`)
check('the token reaches components', focusRule.length > 0, `"${focusRule}"`)

// ---- 2. Instrument main: open the real NSMenu, then dismiss it ------------
await application.evaluate(({ Menu, shell }) => {
  const scheduleTimeout = globalThis.setTimeout
  const store = globalThis
  store.__vPopups = 0
  store.__vLabels = []
  store.__vOpened = []
  store.__vMenu = null

  shell.openExternal = async function (url) {
    store.__vOpened.push(url)
  }

  const originalPopup = Menu.prototype.popup
  Menu.prototype.popup = function (options) {
    store.__vPopups += 1
    store.__vLabels = this.items.map(function (entry) {
      return entry.type === 'separator' ? '---' : entry.label
    })
    store.__vMenu = this
    const returned = originalPopup.call(this, options)
    // Dismiss the real menu so an automated run is not left waiting on a human.
    scheduleTimeout(function () {
      try {
        store.__vMenu.closePopup(options && options.window)
      } catch {
        /* already closed */
      }
    }, 300)
    return returned
  }
})

// ---- 3. Real secondary click on a Discover result -------------------------
await page.getByRole('textbox', { name: 'Research question' }).fill('edge pruning')
await page.getByRole('button', { name: 'Expand and search' }).click()
await page.getByTestId('discover-result').first().waitFor({ timeout: 30000 })
await page.getByTestId('discover-result').first().click({ button: 'right' })
await page.waitForTimeout(1500)

const popupState = await application.evaluate(() => ({
  popups: globalThis.__vPopups,
  labels: globalThis.__vLabels
}))
check(
  'Menu.popup() opened a real native menu',
  popupState.popups === 1,
  `popup invoked ${popupState.popups} time(s)`
)
check(
  'the native menu carried the expected entries',
  JSON.stringify(popupState.labels) ===
    JSON.stringify([
      'Open in Browser',
      'Copy Link',
      '---',
      'Copy Title',
      'Copy Citation',
      '---',
      'Save to Saved',
      'Analyze…'
    ]),
  JSON.stringify(popupState.labels)
)

// ---- 4. Real click handlers: clipboard and external open ------------------
const sideEffects = await application.evaluate(({ clipboard }) => {
  const menu = globalThis.__vMenu
  const run = function (label) {
    const entry = menu.items.find(function (c) {
      return c.label === label
    })
    if (entry && entry.click) entry.click()
  }
  clipboard.writeText('__cleared__')
  run('Copy Link')
  const link = clipboard.readText()
  clipboard.writeText('__cleared__')
  run('Copy Title')
  const title = clipboard.readText()
  clipboard.writeText('__cleared__')
  run('Copy Citation')
  const citation = clipboard.readText()
  run('Open in Browser')
  return { link, title, citation, opened: globalThis.__vOpened }
})

check(
  'Copy Link put the URL on the clipboard',
  sideEffects.link.startsWith('https://'),
  JSON.stringify(sideEffects.link)
)
check(
  'Copy Title put the bare title on the clipboard',
  sideEffects.title.length > 0 && !sideEffects.title.includes('https://'),
  JSON.stringify(sideEffects.title)
)
check(
  'Copy Citation produced a formatted citation',
  /^.+\. .+\. \d{4}-\d{2}-\d{2}\. https:\/\//u.test(sideEffects.citation),
  JSON.stringify(sideEffects.citation)
)
check(
  'Open in Browser reached shell.openExternal',
  sideEffects.opened.length === 1 && sideEffects.opened[0].startsWith('https://'),
  JSON.stringify(sideEffects.opened)
)

// ---- 5. Menu bar shape ---------------------------------------------------
const menuBar = await application.evaluate(({ Menu }) => {
  const m = Menu.getApplicationMenu()
  const sub = function (label) {
    const found =
      m &&
      m.items.find(function (i) {
        return i.label === label
      })
    return found && found.submenu ? found.submenu.items : []
  }
  return {
    top: m
      ? m.items.map(function (i) {
          return i.label
        })
      : [],
    hasHelp: m
      ? m.items.some(function (i) {
          return i.role === 'help'
        })
      : false,
    viewRoles: sub('View').map(function (i) {
      return i.role || i.label
    }),
    signal: sub('Signal').map(function (i) {
      return i.label + '|' + (i.accelerator || '')
    })
  }
})
check('Help menu is installed', menuBar.hasHelp, JSON.stringify(menuBar.top))
check(
  'View exposes the zoom roles',
  ['resetzoom', 'zoomin', 'zoomout'].every(function (r) {
    return menuBar.viewRoles
      .map(function (v) {
        return String(v).toLowerCase()
      })
      .includes(r)
  }),
  JSON.stringify(menuBar.viewRoles)
)
check(
  'Signal accelerators are Mac-idiomatic',
  menuBar.signal.includes('Dismiss Selected|CommandOrControl+Backspace') &&
    menuBar.signal.includes('Save Selected|Shift+CommandOrControl+D') &&
    !menuBar.signal.some(function (e) {
      return e.endsWith('|CommandOrControl+S')
    }),
  JSON.stringify(menuBar.signal)
)

await application.close()
process.stdout.write(`\n${results.join('\n')}\n\n`)
process.stdout.write(failures === 0 ? 'ALL CHECKS PASSED\n' : `${failures} CHECK(S) FAILED\n`)
process.exitCode = failures === 0 ? 0 : 1

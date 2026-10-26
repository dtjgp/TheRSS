/**
 * Appearance and window-size capture matrix for the native AppKit route (fixture data only; no
 * live source, provider or vault calls). Run after `npm run build`:
 *   node docs/audits/2026-10-06-appearance-acceptance/capture-matrix.mjs
 * Output: test-results/appearance-acceptance/<appearance>-<size>-<state>.{png,json}
 */
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from '@playwright/test'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const output = resolve(
  process.env.THERSS_MATRIX_DIR || join(project, 'test-results/appearance-acceptance')
)
await mkdir(output, { recursive: true })
const profile = await mkdtemp(join(tmpdir(), 'therss-appearance-matrix-'))
const application = await electron.launch({
  args: [`--user-data-dir=${profile}`, project],
  env: {
    ...process.env,
    THERSS_E2E_FIXTURES: '1',
    THERSS_E2E_NATIVE_DIALOGS: '1',
    THERSS_E2E_LOCALE: 'en-US',
    THERSS_UI: 'appkit'
  },
  timeout: 30000
})
const stderr = []
application.process().stderr.on('data', (data) => stderr.push(String(data)))
await (await application.firstWindow()).waitForLoadState()

const SIZES = {
  wide: { main: [1360, 880], settings: null, record: null },
  min: { main: [820, 600], settings: [560, 520], record: [520, 460] }
}
const records = []

const find = (node, id) =>
  !node
    ? null
    : node.id === id
      ? node
      : (node.children || []).map((child) => find(child, id)).find(Boolean) || null
const inspect = (target = '__nativeWindow') =>
  application.evaluate(
    (_, key) =>
      JSON.parse(globalThis.__nativeBridge.inspect(globalThis[key].getNativeWindowHandle())),
    target
  )
const act = (id, action, value, target = '__nativeWindow') =>
  application.evaluate(
    (_, data) =>
      globalThis.__nativeBridge.interactFixture(
        globalThis[data.target].getNativeWindowHandle(),
        JSON.stringify(data.payload)
      ),
    { target, payload: { id, action, ...(value !== undefined ? { value } : {}) } }
  )
async function wait(id, predicate = (node) => !!node, target = '__nativeWindow') {
  for (let count = 0; count < 200; count++) {
    const state = await inspect(target).catch(() => null)
    const node = state
      ? find(state.root, id) ||
        find(state.modal, id) ||
        find(state.popover?.root, id) ||
        state.toolbar?.items?.find((item) => item.id === id)
      : null
    if (predicate(node)) return state
    await delay(100)
  }
  throw new Error(`Did not reach expected state: ${id}`)
}
const click = async (id, target) => {
  await wait(id, (node) => !!node && node.enabled !== false, target)
  await act(id, 'click', undefined, target)
}
const go = async (route) => {
  await wait('native-navigation', (node) => !!node && node.enabled !== false)
  await act('native-navigation', 'select', route)
  await delay(250)
}
async function menu(label) {
  await application.evaluate(({ Menu }, wanted) => {
    const visit = (items) =>
      items.some((item) =>
        item.label === wanted ? (item.click(), true) : !!item.submenu && visit(item.submenu.items)
      )
    if (!visit(Menu.getApplicationMenu().items)) throw new Error('Missing menu item: ' + wanted)
  }, label)
}
const setTheme = (appearance) =>
  application.evaluate(({ nativeTheme }, value) => {
    nativeTheme.themeSource = value
  }, appearance)
const setSize = (target, size) =>
  application.evaluate(
    (_, data) => {
      const window = globalThis[data.target]
      if (data.size) window.setBounds({ width: data.size[0], height: data.size[1] })
    },
    { target, size }
  )

/** Captures one window without activating the app; records frame and appearance evidence. */
async function capture(name, target = '__nativeWindow') {
  await application.evaluate((_, key) => {
    globalThis[key].showInactive()
    globalThis[key].moveTop()
  }, target)
  await delay(350)
  const state = await inspect(target)
  await writeFile(join(output, `${name}.json`), JSON.stringify(state, null, 2))
  const shot = (number, file) => {
    try {
      execFileSync('/usr/sbin/screencapture', ['-x', `-l${number}`, join(output, file)], {
        stdio: 'pipe'
      })
      return true
    } catch {
      return false
    }
  }
  // Window capture can fail transiently (window server timing); retry as the smoke does.
  let ok = false
  for (let attempt = 0; attempt < 4 && !ok; attempt++) {
    if (attempt) await delay(500)
    ok = shot(state.windowNumber, `${name}.png`)
  }
  if (state.popover?.windowNumber) shot(state.popover.windowNumber, `${name}-popover.png`)
  const bounds = await application.evaluate((_, key) => globalThis[key].getBounds(), target)
  records.push({
    name,
    captured: ok,
    bounds,
    appearance: state.windowEffectiveAppearance,
    outerScroll: find(state.root, 'native-main')?.documentFrame ?? null
  })
  process.stdout.write(`${ok ? 'SHOT' : 'MISS'} ${name}\n`)
  return state
}

async function openSettings() {
  await menu('Settings…')
  for (let attempt = 0; attempt < 100; attempt++) {
    const found = await application.evaluate(({ BrowserWindow }) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (window === globalThis.__mainWindow || window.isDestroyed()) continue
        try {
          const state = JSON.parse(
            globalThis.__nativeBridge.inspect(window.getNativeWindowHandle())
          )
          if (state.toolbar?.style === 'preference' && state.visible) {
            globalThis.__settingsWindow = window
            return true
          }
        } catch {
          // A window without an attached native host is not ready yet.
        }
      }
      return false
    })
    if (found) return
    await delay(100)
  }
  throw new Error('Settings window did not open')
}
async function openRecord() {
  const listed = await wait('discover-results', (node) => node?.rows.length > 0)
  await act('discover-results', 'double', find(listed.root, 'discover-results').rows[0].id)
  for (let attempt = 0; attempt < 100; attempt++) {
    const found = await application.evaluate(({ BrowserWindow }) => {
      const other = BrowserWindow.getAllWindows().find(
        (window) =>
          window !== globalThis.__mainWindow &&
          window !== globalThis.__settingsWindow &&
          !window.isDestroyed()
      )
      if (!other) return false
      try {
        if (!JSON.parse(globalThis.__nativeBridge.inspect(other.getNativeWindowHandle())).root?.id)
          return false
      } catch {
        return false
      }
      globalThis.__recordWindow = other
      return true
    })
    if (found) return
    await delay(100)
  }
  throw new Error('Record window did not open')
}
const closeTarget = (target) =>
  application.evaluate((_, key) => {
    globalThis[key]?.close()
    globalThis[key] = null
  }, target)

try {
  await application.evaluate(({ app, BrowserWindow, shell, nativeTheme }) => {
    nativeTheme.themeSource = 'light'
    const { createRequire } = process.getBuiltinModule('node:module')
    globalThis.__nativeBridge = createRequire(app.getAppPath() + '/package.json')(
      app.getAppPath() + '/out/native-appkit/therss-ui.node'
    )
    globalThis.__nativeWindow = globalThis.__mainWindow = BrowserWindow.getAllWindows()[0]
    shell.openExternal = async () => {}
  })
  await wait('discover-query')

  // Phase 1: a fresh profile shows every empty workspace.
  for (const appearance of ['light', 'dark']) {
    await setTheme(appearance)
    for (const [size, spec] of Object.entries(SIZES)) {
      await setSize('__nativeWindow', spec.main)
      for (const route of ['discover', 'saved', 'analytics', 'sources']) {
        await go(route)
        await capture(`${appearance}-${size}-empty-${route}`)
      }
    }
  }

  // Phase 2: one fixture Discover run, one saved result and one local search.
  await setTheme('light')
  await setSize('__nativeWindow', SIZES.wide.main)
  await go('discover')
  await act('discover-query', 'fill', '边缘计算 structured pruning')
  await act('discover-runner', 'choose', 'codex')
  await click('discover-search')
  await wait('discover-results', (node) => node?.rows.length > 0)
  await click('discover-save')
  await delay(300)

  for (const appearance of ['light', 'dark']) {
    await setTheme(appearance)
    for (const [size, spec] of Object.entries(SIZES)) {
      const tag = `${appearance}-${size}`
      await setSize('__nativeWindow', spec.main)
      await go('discover')
      await wait('discover-results', (node) => node?.rows.length > 0)
      await capture(`${tag}-discover`)
      await click('discover-source-picker')
      await capture(`${tag}-discover-popover`)
      await act('popover', 'dismiss-popover')
      await click('discover-details')
      await wait('document-modal-content')
      await capture(`${tag}-discover-details`)
      await click('modal-close')
      await delay(300)
      for (const route of ['saved', 'analytics', 'sources']) {
        await go(route)
        await capture(`${tag}-${route}`)
      }
      await menu('Find Local Research')
      await wait('local-search-query', (node) => node?.editing === true)
      await act('local-search-query', 'fill', 'pruning')
      await wait('local-search-results')
      await capture(`${tag}-local-search`)
      await act('local-search-query', 'fill', 'zzqx-no-match')
      await wait('local-search-empty-title').catch(() => {})
      await capture(`${tag}-local-search-empty`)
      await act('local-search-query', 'key', 'escape')
      await delay(250)

      await go('discover')
      await openRecord()
      await setSize('__recordWindow', spec.record)
      await capture(`${tag}-record-window`, '__recordWindow')
      await closeTarget('__recordWindow')

      await openSettings()
      await setSize('__settingsWindow', spec.settings)
      await wait('personal-prompt', undefined, '__settingsWindow')
      await capture(`${tag}-settings-personal`, '__settingsWindow')
      await click('settings-provider', '__settingsWindow')
      await delay(300)
      await capture(`${tag}-settings-provider`, '__settingsWindow')
      await click('settings-personal', '__settingsWindow')
      await closeTarget('__settingsWindow')
      await delay(300)
    }
  }
} finally {
  await writeFile(
    join(output, 'matrix.json'),
    JSON.stringify({ profile, records, stderr: stderr.join('') }, null, 2)
  )
  await application.close().catch(() => {})
}
process.stdout.write(`Matrix: ${records.length} captures in ${output}\n`)

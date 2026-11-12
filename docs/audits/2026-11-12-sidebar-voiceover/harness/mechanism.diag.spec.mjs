/* global window, getComputedStyle -- used inside page.evaluate callbacks */
// Mechanism checks for the sidebar hypotheses, inside the test app only: a second window of the
// same app takes focus (H-A), webContents.sendInputEvent adds one key (H-B1), and Hide/Show is
// clicked while a drag has no mouse-up (H-B2). These prove mechanisms, not the historical trigger.
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { env } from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { _electron as electron, expect, test } from '@playwright/test'
import { attachRecorder } from './recorder.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const project = join(here, '../../../..')
const evidence = join(here, '../evidence')
const runId = env.SIDEBAR_DIAG_RUN ?? `mechanism-${Date.now()}`

async function launch() {
  const profile = await mkdtemp(join(tmpdir(), 'therss-sidebar-mechanism-'))
  const application = await electron.launch({
    args: [`--user-data-dir=${profile}`, project],
    env: { ...env, THERSS_E2E_FIXTURES: '1', THERSS_UI: 'web', THERSS_NATIVE_GLASS: 'off' }
  })
  const page = await application.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByRole('heading', { name: 'Discover research' })).toBeVisible()
  const recorder = await attachRecorder(application, page)
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.focus())
  await page.bringToFront()
  const resizer = page.getByRole('separator', { name: 'Resize sidebar' })
  const box = await resizer.boundingBox()
  return { application, page, recorder, resizer, box }
}
const value = (resizer) => resizer.getAttribute('aria-valuenow')
const stored = (page) => page.evaluate(() => window.localStorage.getItem('therss.sidebar-width'))

test('H-A: focus moving to another window of the app during a drag', async () => {
  const f = await launch()
  const x = f.box.x + f.box.width / 2,
    y = f.box.y + f.box.height / 2
  const outcome = {}
  try {
    f.recorder.phase('mouse-down')
    await f.page.mouse.move(x, y)
    await f.page.mouse.down({ button: 'left' })
    await f.page.mouse.move(x + 32, y, { steps: 2 })
    outcome.duringDrag = await value(f.resizer)
    f.recorder.phase('second-window-focus')
    await f.application.evaluate(({ BrowserWindow }) => {
      const second = new BrowserWindow({ width: 240, height: 120, show: true, title: 'diag' })
      second.focus()
      globalThis.__diagSecond = second
    })
    await delay(500)
    f.recorder.phase('continue-drag')
    await f.page.mouse.move(x + 64, y, { steps: 2 })
    await f.page.mouse.up({ button: 'left' })
    await delay(300)
    outcome.after = await value(f.resizer)
    outcome.stored = await stored(f.page)
  } finally {
    await f.application.evaluate(() => globalThis.__diagSecond?.destroy()).catch(() => undefined)
    await f.recorder.save(join(evidence, `${runId}-H-A.json`), outcome)
    await f.application.close()
  }
  test.info().annotations.push({ type: 'outcome', description: JSON.stringify(outcome) })
})

test('H-B1: one extra Right key delivered to the focused resizer', async () => {
  const f = await launch()
  const outcome = {}
  try {
    f.recorder.phase('press-right')
    await f.resizer.press('ArrowRight')
    await expect(f.resizer).toHaveAttribute('aria-valuenow', '232')
    f.recorder.phase('send-input-right')
    await f.application.evaluate(({ BrowserWindow }) => {
      const contents = BrowserWindow.getAllWindows()[0].webContents
      contents.sendInputEvent({ type: 'keyDown', keyCode: 'Right' })
      contents.sendInputEvent({ type: 'keyUp', keyCode: 'Right' })
    })
    await delay(300)
    outcome.after = await value(f.resizer)
    outcome.stored = await stored(f.page)
  } finally {
    await f.recorder.save(join(evidence, `${runId}-H-B1.json`), outcome)
    await f.application.close()
  }
  test.info().annotations.push({ type: 'outcome', description: JSON.stringify(outcome) })
})

test('H-B2: Hide and Show clicked while a drag has no mouse-up', async () => {
  const f = await launch()
  const x = f.box.x + f.box.width / 2,
    y = f.box.y + f.box.height / 2
  const outcome = {}
  try {
    f.recorder.phase('mouse-down-no-up')
    await f.page.mouse.move(x, y)
    await f.page.mouse.down({ button: 'left' })
    await f.page.mouse.move(x + 64, y, { steps: 4 })
    outcome.duringDrag = await value(f.resizer)
    f.recorder.phase('click-hide')
    await f.page
      .getByRole('button', { name: 'Hide sidebar' })
      .click({ timeout: 5_000 })
      .catch((error) => {
        outcome.hideError = String(error).slice(0, 200)
      })
    await delay(300)
    f.recorder.phase('click-show')
    await f.page
      .getByRole('button', { name: 'Show sidebar' })
      .click({ timeout: 5_000 })
      .catch((error) => {
        outcome.showError = String(error).slice(0, 200)
      })
    await delay(500)
    outcome.after = await value(f.resizer)
    outcome.width = await f.page
      .locator('.sidebar')
      .evaluate((element) => getComputedStyle(element).width)
    outcome.stored = await stored(f.page)
  } finally {
    await f.page.mouse.up({ button: 'left' }).catch(() => undefined)
    await f.recorder.save(join(evidence, `${runId}-H-B2.json`), outcome)
    await f.application.close()
  }
  test.info().annotations.push({ type: 'outcome', description: JSON.stringify(outcome) })
})

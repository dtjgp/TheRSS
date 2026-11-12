/* global window, process, setImmediate -- used inside evaluate callbacks copied from the original specs */
// Diagnosis harness: the two quit cases that precede the sidebar case in the full E2E, then the
// sidebar case with its original assertions and an event recorder. Not part of the normal E2E.
import { mkdir, mkdtemp } from 'node:fs/promises'
import { release, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { env, platform } from 'node:process'
import { fileURLToPath } from 'node:url'
import { _electron as electron, expect, test } from '@playwright/test'
import { attachRecorder } from './recorder.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const project = env.SIDEBAR_DIAG_PROJECT ?? join(here, '../../../..')
const evidence = env.SIDEBAR_DIAG_EVIDENCE ?? join(here, '../evidence')
const runId = env.SIDEBAR_DIAG_RUN ?? `run-${Date.now()}`

for (const ui of ['appkit', 'web']) {
  test(`${ui} normal quit terminates the application process after draining`, async () => {
    test.skip(ui === 'appkit' && (platform !== 'darwin' || Number.parseInt(release(), 10) < 25))
    const profile = await mkdtemp(join(tmpdir(), 'therss-quit-e2e-'))
    const application = await electron.launch({
      args: [`--user-data-dir=${profile}`, project],
      env: { ...env, THERSS_E2E_FIXTURES: '1', THERSS_UI: ui }
    })
    const child = application.process()
    try {
      await application.firstWindow()
      await expect
        .poll(() =>
          application.evaluate(({ Menu }) =>
            Boolean(Menu.getApplicationMenu()?.items.some((item) => item.label === 'Signal'))
          )
        )
        .toBe(true)
      await application.evaluate(({ app, BrowserWindow }, mode) => {
        if (mode === 'appkit') {
          const { createRequire } = process.getBuiltinModule('node:module')
          const bridge = createRequire(app.getAppPath() + '/package.json')(
            app.getAppPath() + '/out/native-appkit/therss-ui.node'
          )
          bridge.interactFixture(
            BrowserWindow.getAllWindows()[0].getNativeWindowHandle(),
            JSON.stringify({ action: 'quit' })
          )
        } else setImmediate(() => app.quit())
      }, ui)
      await expect.poll(() => child.exitCode ?? child.signalCode, { timeout: 5_000 }).toBe(0)
    } finally {
      if (child.exitCode === null && child.signalCode === null) await application.close()
    }
  })
}

test('the sidebar divider resizes, collapses, and restores its saved width (recorded)', async () => {
  const userDataDirectory = await mkdtemp(join(tmpdir(), 'therss-sidebar-e2e-'))
  const captureDirectory = env.THERSS_E2E_CAPTURE_BASELINE
  if (captureDirectory) await mkdir(captureDirectory, { recursive: true })
  const application = await electron.launch({
    args: [`--user-data-dir=${userDataDirectory}`, project],
    env: { ...env, THERSS_E2E_FIXTURES: '1', THERSS_UI: 'web', THERSS_NATIVE_GLASS: 'off' }
  })

  let recorder
  let outcome = 'failed'
  try {
    const page = await application.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    recorder = await attachRecorder(application, page)
    recorder.phase('window-ready')
    await expect(page.getByRole('heading', { name: 'Discover research' })).toBeVisible()

    const sidebar = page.locator('.sidebar')
    const sidebarResizer = page.getByRole('separator', { name: 'Resize sidebar' })
    const applicationUtilities = page.getByRole('navigation', { name: 'Application utilities' })
    const settingsButton = applicationUtilities.getByRole('button', { name: 'Settings' })
    await expect(applicationUtilities.locator('.sidebar__footer')).toHaveCount(0)
    const [sidebarBox, utilityBox, settingsBox] = await Promise.all([
      sidebar.boundingBox(),
      applicationUtilities.boundingBox(),
      settingsButton.boundingBox()
    ])
    expect(sidebarBox).not.toBeNull()
    expect(utilityBox).not.toBeNull()
    expect(settingsBox).not.toBeNull()
    if (sidebarBox && utilityBox && settingsBox) {
      expect(
        sidebarBox.y + sidebarBox.height - (utilityBox.y + utilityBox.height)
      ).toBeLessThanOrEqual(20)
      expect(settingsBox.y + settingsBox.height).toBeLessThanOrEqual(
        utilityBox.y + utilityBox.height
      )
    }
    if (captureDirectory) {
      await page.screenshot({
        path: join(captureDirectory, '11-settings-bottom-utility.png'),
        animations: 'disabled'
      })
    }
    const resizerBox = await sidebarResizer.boundingBox()
    expect(resizerBox).not.toBeNull()
    if (!resizerBox) return

    recorder.phase('focus-before-drag')
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.focus())
    await page.bringToFront()
    await page.mouse.move(resizerBox.x + resizerBox.width / 2, resizerBox.y + resizerBox.height / 2)
    recorder.phase('mouse-down')
    await page.mouse.down({ button: 'left' })
    await page.mouse.move(
      resizerBox.x + resizerBox.width / 2 + 64,
      resizerBox.y + resizerBox.height / 2,
      { steps: 4 }
    )
    recorder.phase('mouse-up')
    await page.mouse.up({ button: 'left' })

    recorder.phase('expect-288')
    await expect(sidebarResizer).toHaveAttribute('aria-valuenow', '288')
    await expect(sidebar).toHaveCSS('width', '288px')
    recorder.phase('press-right-wide')
    await sidebarResizer.press('ArrowRight')
    await expect(sidebarResizer).toHaveAttribute('aria-valuenow', '296')
    expect(await page.evaluate(() => window.localStorage.getItem('therss.sidebar-width'))).toBe(
      '296'
    )

    recorder.phase('click-hide')
    await page.getByRole('button', { name: 'Hide sidebar' }).click()
    await expect(sidebarResizer).toBeHidden()
    recorder.phase('click-show')
    await page.getByRole('button', { name: 'Show sidebar' }).click()
    await expect(sidebar).toHaveCSS('width', '296px')

    recorder.phase('reload')
    await page.reload()
    await expect(sidebarResizer).toHaveAttribute('aria-valuenow', '296')
    await expect(sidebar).toHaveCSS('width', '296px')

    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(820, 700)
    })
    await expect(sidebarResizer).toHaveAttribute('aria-valuemax', '184')
    await expect(sidebar).toHaveCSS('width', '184px')
    const sourceSelectionSummary = page.locator('.discover-source-trigger strong')
    await expect(sourceSelectionSummary).toHaveText('22 of 22 selected')
    expect(
      await sourceSelectionSummary.evaluate((element) => element.scrollWidth <= element.clientWidth)
    ).toBe(true)
    const sourcePickerBox = await page.locator('.discover-source-picker').boundingBox()
    const runnerBox = await page.getByLabel('Search with').boundingBox()
    expect(sourcePickerBox).not.toBeNull()
    expect(runnerBox).not.toBeNull()
    if (sourcePickerBox && runnerBox) {
      expect(sourcePickerBox.y + sourcePickerBox.height).toBeLessThan(runnerBox.y)
    }
    if (captureDirectory) {
      await page.screenshot({
        path: join(captureDirectory, '12-minimum-width-discover.png'),
        animations: 'disabled'
      })
    }
    expect(await page.evaluate(() => window.localStorage.getItem('therss.sidebar-width'))).toBe(
      '296'
    )
    await sidebarResizer.press('ArrowRight')
    await expect(sidebar).toHaveCSS('width', '184px')
    expect(await page.evaluate(() => window.localStorage.getItem('therss.sidebar-width'))).toBe(
      '296'
    )

    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(1360, 880)
    })
    await expect(sidebarResizer).toHaveAttribute('aria-valuemax', '360')
    await expect(sidebar).toHaveCSS('width', '296px')
    outcome = 'passed'
  } finally {
    if (recorder)
      await recorder.save(join(evidence, `${runId}-sidebar.json`), outcome).catch(() => undefined)
    await application.close()
  }
})

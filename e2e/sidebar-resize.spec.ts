import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env } from 'node:process'
import { _electron as electron, expect, test } from '@playwright/test'
import { startSidebarDiagnostics, type SidebarDiagnostics } from './support/sidebarDiagnostics'

test('the sidebar divider resizes, collapses, and restores its saved width', async () => {
  const userDataDirectory = await mkdtemp(join(tmpdir(), 'therss-sidebar-e2e-'))
  const captureDirectory = env.THERSS_E2E_CAPTURE_BASELINE
  if (captureDirectory) await mkdir(captureDirectory, { recursive: true })
  const application = await electron.launch({
    args: [`--user-data-dir=${userDataDirectory}`, '.'],
    env: { ...env, THERSS_E2E_FIXTURES: '1', THERSS_UI: 'web', THERSS_NATIVE_GLASS: 'off' }
  })

  // Failure-only diagnostics: recorded in bounded memory, written only if the test fails.
  let diagnostics: SidebarDiagnostics | undefined
  try {
    const page = await application.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    diagnostics = await startSidebarDiagnostics(application, page, {
      THERSS_UI: 'web',
      THERSS_E2E_FIXTURES: '1',
      THERSS_NATIVE_GLASS: 'off'
    })
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

    diagnostics.phase('focus-before-drag')
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.focus())
    await page.bringToFront()
    await page.mouse.move(resizerBox.x + resizerBox.width / 2, resizerBox.y + resizerBox.height / 2)
    diagnostics.phase('mouse-down')
    await page.mouse.down({ button: 'left' })
    await page.mouse.move(
      resizerBox.x + resizerBox.width / 2 + 64,
      resizerBox.y + resizerBox.height / 2,
      { steps: 4 }
    )
    diagnostics.phase('mouse-up')
    await page.mouse.up({ button: 'left' })

    diagnostics.phase('expect-288')
    await expect(sidebarResizer).toHaveAttribute('aria-valuenow', '288')
    await expect(sidebar).toHaveCSS('width', '288px')
    diagnostics.phase('press-right-wide')
    await sidebarResizer.press('ArrowRight')
    await expect(sidebarResizer).toHaveAttribute('aria-valuenow', '296')
    expect(await page.evaluate(() => window.localStorage.getItem('therss.sidebar-width'))).toBe(
      '296'
    )

    diagnostics.phase('click-hide')
    await page.getByRole('button', { name: 'Hide sidebar' }).click()
    await expect(sidebarResizer).toBeHidden()
    diagnostics.phase('click-show')
    await page.getByRole('button', { name: 'Show sidebar' }).click()
    await expect(sidebar).toHaveCSS('width', '296px')

    diagnostics.phase('reload')
    await page.reload()
    await expect(sidebarResizer).toHaveAttribute('aria-valuenow', '296')
    await expect(sidebar).toHaveCSS('width', '296px')

    diagnostics.phase('narrow-window')
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
    diagnostics.phase('press-right-narrow')
    await sidebarResizer.press('ArrowRight')
    await expect(sidebar).toHaveCSS('width', '184px')
    expect(await page.evaluate(() => window.localStorage.getItem('therss.sidebar-width'))).toBe(
      '296'
    )

    diagnostics.phase('wide-window')
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(1360, 880)
    })
    await expect(sidebarResizer).toHaveAttribute('aria-valuemax', '360')
    await expect(sidebar).toHaveCSS('width', '296px')
  } catch (error) {
    // The original failure stays the test result; diagnostics never throw.
    await diagnostics?.recordFailure(error)
    throw error
  } finally {
    await diagnostics?.dispose()
    await application.close()
  }
})

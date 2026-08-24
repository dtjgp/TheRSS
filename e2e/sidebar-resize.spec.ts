import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env } from 'node:process'
import { _electron as electron, expect, test } from '@playwright/test'

test('the sidebar divider resizes, collapses, and restores its saved width', async () => {
  const userDataDirectory = await mkdtemp(join(tmpdir(), 'therss-sidebar-e2e-'))
  const captureDirectory = env.THERSS_E2E_CAPTURE_BASELINE
  if (captureDirectory) await mkdir(captureDirectory, { recursive: true })
  const application = await electron.launch({
    args: [`--user-data-dir=${userDataDirectory}`, '.'],
    env: { ...env, THERSS_E2E_FIXTURES: '1' }
  })

  try {
    const page = await application.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await expect(
      page.getByRole('heading', { name: 'Search across your full source desk' })
    ).toBeVisible()

    const sidebar = page.locator('.sidebar')
    const sidebarResizer = page.getByRole('separator', { name: 'Resize sidebar' })
    const applicationUtilities = page.getByRole('navigation', { name: 'Application utilities' })
    const settingsButton = applicationUtilities.getByRole('button', { name: 'Settings' })
    const sourceStatusButton = applicationUtilities.locator('.sidebar__footer')
    const [sidebarBox, utilityBox, settingsBox, sourceStatusBox] = await Promise.all([
      sidebar.boundingBox(),
      applicationUtilities.boundingBox(),
      settingsButton.boundingBox(),
      sourceStatusButton.boundingBox()
    ])
    expect(sidebarBox).not.toBeNull()
    expect(utilityBox).not.toBeNull()
    expect(settingsBox).not.toBeNull()
    expect(sourceStatusBox).not.toBeNull()
    if (sidebarBox && utilityBox && settingsBox && sourceStatusBox) {
      expect(
        sidebarBox.y + sidebarBox.height - (utilityBox.y + utilityBox.height)
      ).toBeLessThanOrEqual(20)
      expect(settingsBox.y + settingsBox.height).toBeLessThanOrEqual(sourceStatusBox.y)
      expect(sourceStatusBox.y - (settingsBox.y + settingsBox.height)).toBeLessThanOrEqual(8)
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

    await page.mouse.move(resizerBox.x + resizerBox.width / 2, resizerBox.y + resizerBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      resizerBox.x + resizerBox.width / 2 + 64,
      resizerBox.y + resizerBox.height / 2
    )
    await page.mouse.up()

    await expect(sidebarResizer).toHaveAttribute('aria-valuenow', '288')
    await expect(sidebar).toHaveCSS('width', '288px')
    await sidebarResizer.press('ArrowRight')
    await expect(sidebarResizer).toHaveAttribute('aria-valuenow', '296')
    expect(await page.evaluate(() => window.localStorage.getItem('therss.sidebar-width'))).toBe(
      '296'
    )

    await page.getByRole('button', { name: 'Hide sidebar' }).click()
    await expect(sidebarResizer).toBeHidden()
    await page.getByRole('button', { name: 'Show sidebar' }).click()
    await expect(sidebar).toHaveCSS('width', '296px')

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
  } finally {
    await application.close()
  }
})

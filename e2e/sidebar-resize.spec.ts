import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env } from 'node:process'
import { _electron as electron, expect, test } from '@playwright/test'

test('the sidebar divider resizes, collapses, and restores its saved width', async () => {
  const userDataDirectory = await mkdtemp(join(tmpdir(), 'therss-sidebar-e2e-'))
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

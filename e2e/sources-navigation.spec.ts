import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env } from 'node:process'
import { _electron as electron, expect, test } from '@playwright/test'

test('Sources keeps long-list navigation and selected detail in independent panes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'therss-source-navigation-'))
  const application = await electron.launch({
    args: [`--user-data-dir=${directory}`, '.'],
    env: { ...env, THERSS_E2E_FIXTURES: '1', THERSS_NATIVE_GLASS: 'off' }
  })
  try {
    const page = await application.firstWindow()
    await expect
      .poll(() =>
        application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible())
      )
      .toBe(true)
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(1024, 677)
    })
    await expect
      .poll(() => page.evaluate(() => ({ width: innerWidth, height: innerHeight })))
      .toEqual({ width: 1024, height: 677 })
    await page.getByRole('button', { name: '04 Sources', exact: true }).click()
    const list = page.getByRole('listbox', { name: 'Configured sources' })
    await expect(list.getByRole('option')).toHaveCount(22)
    expect(await list.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)
    const main = page.locator('main')
    const initialScroll = await main.evaluate((node) => node.scrollTop)
    const first = list.getByRole('option').first()
    const last = list.getByRole('option').last()
    await first.focus()
    await first.press('End')
    await expect(last).toBeFocused()
    await expect(list.getByRole('option', { selected: true })).toHaveText(/arXiv/u)
    await last.press('Enter')
    await expect(last).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.source-detail-heading')).toBeInViewport()
    expect(await main.evaluate((node) => node.scrollTop)).toBe(initialScroll)
    await page.screenshot({ path: test.info().outputPath('sources-last-row.png') })
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(820, 700)
    })
    await expect(page.locator('.source-catalog-workspace')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally {
    await application.close()
  }
})

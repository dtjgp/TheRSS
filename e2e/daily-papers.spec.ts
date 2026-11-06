import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env } from 'node:process'
import { _electron as electron, expect, test } from '@playwright/test'

test('Daily Papers uses the typed Web bridge and preserves the Discover draft', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'therss-daily-web-'))
  try {
    const application = await electron.launch({
      args: [`--user-data-dir=${directory}`, '.'],
      env: { ...env, THERSS_E2E_FIXTURES: '1', THERSS_UI: 'web', THERSS_NATIVE_GLASS: 'off' }
    })
    try {
      const page = await application.firstWindow()
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.setSize(1200, 800)
      )
      const question = page.getByRole('textbox', { name: 'Research question' })
      await question.fill('Retain this unsent pruning question')
      const daily = page.getByRole('button', { name: 'Daily Papers', exact: true })
      await daily.click()
      await expect(page.getByRole('heading', { name: 'Daily Papers' })).toBeFocused()
      await expect(page.getByRole('status', { name: 'Daily scan status' })).toContainText(
        'Edition 2026-11-06 · Scan complete · 2 selected'
      )
      await expect(
        page.getByRole('heading', { name: 'Fixture direct pruning paper' })
      ).toBeVisible()
      await page.getByRole('button', { name: 'Open note in Obsidian' }).click()
      await expect(page.getByRole('button', { name: 'Open note in Obsidian' })).toBeEnabled()
      await page.getByRole('button', { name: 'Open digest in Obsidian' }).click()
      await expect(page.getByRole('button', { name: 'Open digest in Obsidian' })).toBeEnabled()
      await expect(page.getByRole('alert')).toHaveCount(0)
      await page.screenshot({ path: test.info().outputPath('daily-papers-web-wide.png') })
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.setSize(820, 720)
      )
      const devtools = await page.context().newCDPSession(page)
      await devtools.send('Emulation.setEmulatedMedia', {
        features: [
          { name: 'prefers-color-scheme', value: 'dark' },
          { name: 'prefers-reduced-motion', value: 'reduce' }
        ]
      })
      await expect
        .poll(() => page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches))
        .toBe(true)
      const first = page.getByRole('button', { name: /fixture direct pruning paper/i })
      await first.focus()
      await first.press('ArrowDown')
      await expect(
        page.getByRole('button', { name: /fixture adjacent quantization paper/i })
      ).toBeFocused()
      await expect(page.getByRole('link', { name: /arXiv/i })).toHaveAttribute(
        'href',
        'https://arxiv.org/abs/2611.00002'
      )
      await expect(page.getByRole('button', { name: 'Open note in Obsidian' })).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      )
      await page.screenshot({ path: test.info().outputPath('daily-papers-web-narrow-dark.png') })
      await page.getByRole('button', { name: 'Refresh daily papers' }).click()
      await expect(page.getByRole('status', { name: 'Daily scan status' })).toContainText(
        '2 selected'
      )
      await expect(
        page.getByRole('heading', { name: 'Fixture adjacent quantization paper' })
      ).toBeVisible()
      await page.getByRole('button', { name: 'Back to Discover' }).click()
      await expect(question).toHaveValue('Retain this unsent pruning question')
      await expect(daily).toBeFocused()
    } finally {
      await application.close()
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

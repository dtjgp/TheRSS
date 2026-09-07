import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env } from 'node:process'
import { _electron as electron, expect, test, type Locator } from '@playwright/test'

async function contrastOf(locator: Locator, backgroundSelector?: string): Promise<number> {
  return locator.evaluate((element, selector) => {
    const canvas = new OffscreenCanvas(1, 1)
    const context = canvas.getContext('2d')!
    const luminance = (color: string) => {
      context.fillStyle = color
      context.fillRect(0, 0, 1, 1)
      const [red, green, blue] = Array.from(context.getImageData(0, 0, 1, 1).data).map((value) => {
        const channel = value / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!
    }
    const background = getComputedStyle(
      selector ? document.querySelector(selector)! : element
    ).backgroundColor
    const foreground = getComputedStyle(element).color
    const values = [luminance(background), luminance(foreground)].sort((a, b) => a - b)
    return (values[1]! + 0.05) / (values[0]! + 0.05)
  }, backgroundSelector)
}

test('macOS 27 keeps edge navigation, readable toolbar and accessible materials', async () => {
  const info = test.info()
  const fixtureDirectory = await mkdtemp(join(tmpdir(), 'therss-appearance-'))
  const application = await electron.launch({
    args: [`--user-data-dir=${fixtureDirectory}`, '.'],
    env: { ...env, THERSS_E2E_FIXTURES: '1', THERSS_UI: 'web', THERSS_NATIVE_GLASS: 'off' }
  })

  try {
    const page = await application.firstWindow()
    const devtools = await page.context().newCDPSession(page)
    const emulateAppearance = (colorScheme: 'light' | 'dark') =>
      devtools.send('Emulation.setEmulatedMedia', {
        features: [
          { name: 'prefers-color-scheme', value: colorScheme },
          { name: 'prefers-reduced-transparency', value: 'no-preference' },
          { name: 'prefers-reduced-motion', value: 'no-preference' },
          { name: 'prefers-contrast', value: 'no-preference' },
          { name: 'forced-colors', value: 'none' }
        ]
      })
    await expect(
      page.getByRole('heading', { name: 'Discover research', exact: true })
    ).toBeVisible()
    await emulateAppearance('light')
    const sidebar = page.locator('.sidebar')
    const toolbar = page.locator('.topbar')
    const selectedNavigation = page.locator('.nav-item--active')
    await expect(selectedNavigation).toHaveCSS('font-weight', '600')
    await expect(toolbar).toHaveCSS('backdrop-filter', 'none')
    await expect(toolbar).toHaveCSS('background-color', 'rgb(246, 246, 246)')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(page.locator('.discover-form')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(page.getByRole('heading', { name: 'Discover research', exact: true })).toHaveCSS(
      'font-size',
      '26px'
    )
    const edge = await sidebar.boundingBox()
    expect(edge?.x).toBe(0)
    expect(edge?.y).toBe(0)
    expect(edge?.height).toBe(await page.evaluate(() => window.innerHeight))
    await page.screenshot({ path: info.outputPath('discover-light.png'), animations: 'disabled' })

    await page.getByRole('textbox', { name: 'Research question' }).fill('edge intelligence')
    await page.getByLabel('Search with').selectOption({ label: 'Codex CLI' })
    const originalAccent = await page.evaluate(() => document.documentElement.dataset.systemAccent)
    for (const colorScheme of ['light', 'dark'] as const) {
      await emulateAppearance(colorScheme)
      for (const accent of [
        'blue',
        'purple',
        'red',
        'orange',
        'green',
        'teal',
        'cyan',
        'indigo',
        'gray'
      ]) {
        await page.evaluate((name) => {
          document.documentElement.dataset.systemAccent = name
        }, accent)
        expect(
          await contrastOf(page.locator('.primary-button')),
          `${colorScheme} ${accent}`
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
    await page.evaluate((name) => {
      if (name) document.documentElement.dataset.systemAccent = name
      else delete document.documentElement.dataset.systemAccent
    }, originalAccent)
    await emulateAppearance('light')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    const results = page.getByRole('region', { name: 'Discover results' })
    await expect(results).toBeVisible()
    await expect(page.locator('.signal-detail__title')).toHaveCSS('font-size', '28px')
    await expect(page.locator('.signal-detail')).toHaveCSS('backdrop-filter', 'none')
    await expect(page.locator('.signal-detail')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await page.screenshot({ path: info.outputPath('results-light.png'), animations: 'disabled' })
    await emulateAppearance('dark')
    await expect(toolbar).toHaveCSS('background-color', 'rgb(36, 36, 38)')
    await expect(page.locator('.signal-detail')).toHaveCSS('background-color', 'rgb(30, 30, 32)')
    expect(
      await contrastOf(page.locator('.signal-row__state').first(), '.signal-detail')
    ).toBeGreaterThanOrEqual(4.5)
    await page.screenshot({ path: info.outputPath('results-dark.png'), animations: 'disabled' })

    for (const [label, surface] of [
      ['02 Saved', '.today-view'],
      ['Settings', '.settings-view'],
      ['03 Data Analytics', '.analytics-view'],
      ['04 Sources', '.source-catalog-view']
    ] as const) {
      await page.getByRole('button', { name: label, exact: true }).click()
      await expect(page.locator(surface)).toBeVisible()
      await page.screenshot({ path: info.outputPath(`${label}-dark.png`), animations: 'disabled' })
    }

    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(820, 700)
    })
    await devtools.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-color-scheme', value: 'light' },
        { name: 'prefers-reduced-transparency', value: 'reduce' },
        { name: 'prefers-reduced-motion', value: 'reduce' },
        { name: 'prefers-contrast', value: 'more' }
      ]
    })
    await expect(sidebar).toHaveCSS('backdrop-filter', 'none')
    await expect(sidebar).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(toolbar).toHaveCSS('border-bottom-color', 'rgb(107, 107, 112)')
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true)
    await page.screenshot({
      path: info.outputPath('sources-accessible-820.png'),
      animations: 'disabled'
    })

    await application.evaluate(({ Menu }) => {
      const edit = Menu.getApplicationMenu()?.items.find((item) => item.label === 'Edit')
      edit?.submenu?.items.find((item) => item.label === 'Find Local Research')?.click()
    })
    const search = page.getByRole('dialog', { name: 'Find research' })
    await expect(search).toBeVisible()
    await expect(page.locator('.local-search-backdrop')).toHaveCSS('backdrop-filter', 'none')
    await page.screenshot({
      path: info.outputPath('local-search-accessible.png'),
      animations: 'disabled'
    })
    await page.getByLabel('Search local research').press('Escape')
    await expect(search).toBeHidden()
  } finally {
    await application.close()
  }
})

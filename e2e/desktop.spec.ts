import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env } from 'node:process'
import { _electron as electron, expect, test, type Page } from '@playwright/test'

test('Discover-first search across every deployed source', async () => {
  const userDataDirectory = await mkdtemp(join(tmpdir(), 'therss-e2e-'))
  const baselineDirectory = env.THERSS_E2E_CAPTURE_BASELINE
  const baselineExecutable = env.THERSS_E2E_EXECUTABLE
  const isBaselineCapture = Boolean(baselineDirectory && baselineExecutable)
  if (baselineDirectory) await mkdir(baselineDirectory, { recursive: true })
  const screenshotPath = (name: string) =>
    baselineDirectory ? join(baselineDirectory, name) : join('test-results', name)
  const capture = (page: Page, name: string) =>
    page.screenshot({ path: screenshotPath(name), animations: 'disabled' })
  const application = await electron.launch(
    baselineExecutable
      ? {
          executablePath: baselineExecutable,
          args: [`--user-data-dir=${userDataDirectory}`],
          env: { ...env, THERSS_E2E_FIXTURES: '1' }
        }
      : {
          args: [`--user-data-dir=${userDataDirectory}`, '.'],
          env: { ...env, THERSS_E2E_FIXTURES: '1' }
        }
  )

  try {
    const page = await application.firstWindow()
    await page.emulateMedia({ colorScheme: 'light' })
    const rendererErrors: string[] = []
    page.on('pageerror', (error) => rendererErrors.push(error.message))
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)

    expect(rendererErrors).toEqual([])
    expect(page.url()).toContain('/out/renderer/index.html')
    const brandMark = page.locator('.brand-lockup__index')
    await expect(brandMark).toBeVisible()
    expect(
      await brandMark.evaluate((element) => {
        const style = getComputedStyle(element)
        return {
          display: style.display,
          alignItems: style.alignItems,
          justifyItems: style.justifyItems
        }
      })
    ).toEqual({ display: 'grid', alignItems: 'center', justifyItems: 'center' })

    await expect(
      page.getByRole('heading', { name: 'Search across your full source desk' })
    ).toBeVisible()
    const primaryNavigation = page.getByRole('navigation', { name: 'Primary navigation' })
    await expect(primaryNavigation.getByRole('button')).toHaveCount(5)
    await expect(primaryNavigation.getByRole('button', { name: '01 Discover' })).toBeVisible()
    await expect(primaryNavigation.getByRole('button', { name: '02 Saved' })).toBeVisible()
    await expect(
      primaryNavigation.getByRole('button', { name: '03 Models & Agents' })
    ).toBeVisible()
    await expect(primaryNavigation.getByRole('button', { name: '04 Data Analytics' })).toBeVisible()
    await expect(primaryNavigation.getByRole('button', { name: '05 Sources' })).toBeVisible()
    await expect(primaryNavigation.getByText('Today')).toHaveCount(0)
    await expect(primaryNavigation.getByText('Interests')).toHaveCount(0)
    await expect(page.locator('.nav-item--active .nav-item__icon')).toHaveCSS(
      'color',
      isBaselineCapture ? 'rgb(88, 86, 214)' : 'rgb(69, 66, 181)'
    )

    if (!isBaselineCapture) {
      const applicationMenuLabels = await application.evaluate(({ Menu }) =>
        (Menu.getApplicationMenu()?.items ?? []).map((item) => ({
          label: item.label,
          submenu: item.submenu?.items.map((child) => child.label) ?? []
        }))
      )
      const viewMenu = applicationMenuLabels.find((item) => item.label === 'View')
      expect(applicationMenuLabels).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: 'TheRSS',
            submenu: expect.arrayContaining(['Settings…'])
          }),
          expect.objectContaining({
            label: 'View',
            submenu: expect.arrayContaining(['Discover', 'Saved', 'Show or Hide Sidebar'])
          })
        ])
      )
      expect(viewMenu?.submenu).not.toContain('Today')
      expect(viewMenu?.submenu).not.toContain('Interests')
    }

    const sourcePicker = page.getByRole('button', {
      name: 'Choose sources, 22 of 22 selected'
    })
    await expect(sourcePicker).toHaveAttribute('aria-expanded', 'false')
    await capture(page, '01-discover-first.png')
    await sourcePicker.click()
    const sourceGroup = page.getByRole('group', { name: 'Search sources' })
    await expect(sourceGroup.getByRole('checkbox')).toHaveCount(22)
    expect(
      await sourceGroup
        .getByRole('checkbox')
        .evaluateAll((inputs) => inputs.every((input) => (input as HTMLInputElement).checked))
    ).toBe(true)
    await expect(sourceGroup.getByRole('checkbox', { name: 'Search arXiv' })).toBeChecked()
    await expect(sourceGroup.getByRole('checkbox', { name: 'Search GitHub' })).toBeChecked()
    await expect(
      sourceGroup.getByRole('checkbox', { name: 'Search 北京智源人工智能研究院' })
    ).toBeChecked()
    await sourceGroup.getByRole('button', { name: 'Clear all sources' }).click()
    await expect(page.getByRole('button', { name: 'Expand and search' })).toBeDisabled()
    await sourceGroup.getByRole('button', { name: 'Select all sources' }).click()
    await sourcePicker.click()
    await expect(sourcePicker).toHaveAttribute('aria-expanded', 'false')
    await page
      .getByRole('textbox', { name: 'Research question' })
      .fill('semantic communication pruning for edge deployment')
    await page.getByRole('combobox', { name: 'Search with' }).selectOption('codex')
    await page.getByRole('button', { name: 'Expand and search' }).click()

    await expect(page.getByText('Search complete')).toBeVisible()
    const searchDetails = page.getByLabel('Discover search details')
    await expect(searchDetails).not.toHaveAttribute('open', '')

    const discoverPaper = page
      .locator('article')
      .filter({ hasText: 'Semantic expansion search for edge intelligence' })
    const discoverRepository = page
      .locator('article')
      .filter({ hasText: 'TheRSS/semantic-fixture' })
    const discoverArticle = page
      .locator('article')
      .filter({ hasText: 'BAAI structured pruning research fixture' })
    await expect(discoverPaper).toBeVisible()
    await expect(discoverRepository).toBeVisible()
    await expect(discoverArticle).toBeVisible()
    await expect(discoverArticle.getByText('北京智源人工智能研究院')).toBeVisible()
    await expect(discoverArticle.getByText('Article')).toBeVisible()
    const resultTop = await page
      .getByRole('region', { name: 'Discover results' })
      .evaluate((element) => element.getBoundingClientRect().top)
    const detailsTop = await searchDetails.evaluate(
      (element) => element.getBoundingClientRect().top
    )
    expect(resultTop).toBeLessThan(detailsTop)
    await page.waitForTimeout(1_200)
    await capture(page, '02-discover-results.png')

    await page.getByRole('button', { name: /Search details/u }).click()
    await expect(page.getByText('Codex CLI · codex-cli')).toBeVisible()
    const outcomes = page.getByRole('list', { name: 'Source outcomes' })
    await expect(outcomes.getByRole('listitem')).toHaveCount(22)
    await expect(outcomes.getByText('北京智源人工智能研究院')).toBeVisible()

    const resultFilters = page.getByRole('group', { name: 'Filter Discover results' })
    await resultFilters.getByRole('button', { name: 'Other 1' }).click()
    await expect(discoverPaper).toHaveCount(0)
    await expect(discoverRepository).toHaveCount(0)
    await expect(discoverArticle).toBeVisible()
    await capture(page, '03-discover-other.png')

    await discoverArticle.getByRole('button', { name: 'Save result' }).click({ force: true })
    await expect(discoverArticle.getByRole('button', { name: 'Saved' })).toBeDisabled()
    await primaryNavigation.getByRole('button', { name: '02 Saved' }).click()
    await expect(page.getByRole('heading', { name: 'Saved research signals' })).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: 'Select signal: BAAI structured pruning research fixture'
      })
    ).toBeVisible()
    await expect(page.getByRole('group', { name: 'Filter saved signals by source' })).toBeVisible()
    await page.getByRole('button', { name: 'Dismiss signal' }).click()
    await expect(page.getByRole('status')).toContainText(
      'Dismissed “BAAI structured pruning research fixture”'
    )
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(
      page.getByRole('button', {
        name: 'Select signal: BAAI structured pruning research fixture'
      })
    ).toBeVisible()
    await capture(page, '04-saved.png')

    await primaryNavigation.getByRole('button', { name: '03 Models & Agents' }).click()
    await expect(
      page.getByRole('heading', { name: 'Bring your own analysis model.' })
    ).toBeVisible()
    await page.getByRole('textbox', { name: 'Provider name' }).fill('Local fixture')
    await page.getByRole('textbox', { name: 'Provider base URL' }).fill('http://127.0.0.1:11434/v1')
    await page.getByRole('textbox', { name: 'Model name' }).fill('fixture-model')
    await page.getByRole('button', { name: 'Save model provider' }).click()
    await expect(page.getByText('Credential protected by macOS')).toHaveCount(0)
    await capture(page, '05-models.png')

    await page.getByRole('button', { name: 'Hide sidebar' }).click()
    await expect(page.locator('.app-shell')).toHaveClass(/app-shell--sidebar-collapsed/)
    await page.getByRole('button', { name: 'Show sidebar' }).click()
    await expect(page.locator('.app-shell')).not.toHaveClass(/app-shell--sidebar-collapsed/)

    await primaryNavigation.getByRole('button', { name: '04 Data Analytics' }).click()
    await expect(page.getByRole('heading', { name: 'Data Analytics' })).toBeVisible()
    const searchResults = page.getByLabel('Search results')
    await expect(searchResults).toContainText('3')
    await expect(searchResults).toContainText('0 legacy Today · 3 Discover')
    await capture(page, '06-analytics.png')

    if (!isBaselineCapture) {
      await primaryNavigation.getByRole('button', { name: '05 Sources' }).click()
      await expect(
        page.getByRole('heading', { name: '22 live-verified research sources' })
      ).toBeVisible()
      await expect(page.locator('.source-catalog-card')).toHaveCount(22)
      await page
        .getByRole('button', { name: 'Browse 北京智源人工智能研究院 recent content' })
        .click()
      await expect(page.getByRole('heading', { name: '北京智源人工智能研究院' })).toBeVisible()
      await expect(page.getByText('BAAI structured pruning research fixture')).toBeVisible()
      await expect(page.locator('.source-detail-boundary')).toContainText('rolling 30 days')
      await page.getByRole('button', { name: 'Back to source directory' }).click()

      await page.getByRole('button', { name: 'Browse GitHub recent content' }).click()
      await expect(page.getByRole('heading', { name: 'GitHub' })).toBeVisible()
      await expect(page.getByText('Search GitHub from Discover.')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Refresh recent content' })).toBeDisabled()
      await capture(page, '07-sources.png')
    }

    await expect(page.getByRole('button', { name: /Today|Interests|Sync/ })).toHaveCount(0)
    await expect(page.getByText(/Google Drive/i)).toHaveCount(0)
    expect(rendererErrors).toEqual([])
  } finally {
    await application.close()
  }
})

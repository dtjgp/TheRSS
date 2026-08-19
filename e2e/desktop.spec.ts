import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env } from 'node:process'
import { _electron as electron, expect, test, type Page } from '@playwright/test'

test('first-run discovery, triage, provider setup, and analysis', async () => {
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
    await expect(page.getByRole('heading', { name: 'Build your research radar' })).toBeVisible()
    await expect(page.locator('.nav-item--active .nav-item__icon')).toHaveCSS(
      'color',
      isBaselineCapture ? 'rgb(0, 122, 255)' : 'rgb(0, 87, 184)'
    )
    if (!isBaselineCapture) {
      const applicationMenuLabels = await application.evaluate(({ Menu }) =>
        (Menu.getApplicationMenu()?.items ?? []).map((item) => ({
          label: item.label,
          submenu: item.submenu?.items.map((child) => child.label) ?? []
        }))
      )
      expect(applicationMenuLabels).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: 'TheRSS',
            submenu: expect.arrayContaining(['Settings…'])
          }),
          expect.objectContaining({
            label: 'View',
            submenu: expect.arrayContaining(['Today', 'Saved', 'Discover', 'Show or Hide Sidebar'])
          }),
          expect.objectContaining({
            label: 'Signal',
            submenu: expect.arrayContaining(['Dismiss Selected'])
          })
        ])
      )
    }
    await capture(page, '01-onboarding.png')

    await page.getByRole('button', { name: 'Set research interests' }).click()
    await expect(page.locator('.nav-item--active .nav-item__icon')).toHaveCSS(
      'color',
      isBaselineCapture ? 'rgb(48, 176, 199)' : 'rgb(0, 109, 117)'
    )
    await capture(page, '02-interests.png')
    await page.getByRole('textbox', { name: 'Profile name' }).fill('E2E research')
    await page.getByRole('textbox', { name: 'arXiv categories' }).fill('cs.LG')
    await page.getByRole('textbox', { name: 'arXiv keywords' }).fill('structured pruning')
    await page.getByRole('textbox', { name: 'GitHub topics' }).fill('model-compression')
    await page.getByRole('button', { name: 'Save research radar' }).click()

    await page.reload()
    await expect(
      page.getByRole('button', { name: 'Select signal: Structured pruning for edge deployment' })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Select signal: TheRSS/fixture' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Select signal: BAAI edge intelligence fixture' })
    ).toBeVisible()
    if (!isBaselineCapture) {
      await expect(page.getByText('arXiv: Healthy')).toBeVisible()
      await expect(page.getByText('GitHub: Healthy')).toBeVisible()
      await expect(page.getByText('Additional: 21/21 ready')).toBeVisible()
      await expect(page.getByText('Sources ready')).toBeVisible()
    }
    const signalDetail = page.getByRole('article', { name: 'Selected signal details' })
    const dailyStream = page.getByRole('complementary', { name: 'Daily stream' })
    await expect(dailyStream).toBeVisible()
    await expect(dailyStream.getByText('3 returned')).toBeVisible()
    await expect(dailyStream.getByText('3 sources')).toBeVisible()
    await expect(dailyStream.getByRole('button')).toHaveCount(3)
    await expect(
      dailyStream.getByRole('heading', { name: /北京智源人工智能研究院\s*1/u })
    ).toBeVisible()
    await expect(
      signalDetail.getByRole('heading', { name: 'Structured pruning for edge deployment' })
    ).toBeVisible()
    await dailyStream
      .getByRole('button', { name: 'Open in daily workspace: TheRSS/fixture' })
      .click()
    await expect(signalDetail.getByRole('heading', { name: 'TheRSS/fixture' })).toBeVisible()
    await dailyStream
      .getByRole('button', {
        name: 'Open in daily workspace: Structured pruning for edge deployment'
      })
      .click()
    await expect(
      signalDetail.getByRole('heading', { name: 'Structured pruning for edge deployment' })
    ).toBeVisible()
    await capture(page, '03-today-light.png')

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(0, 0, 0)')
    await expect(page.locator('.nav-item--active .nav-item__icon')).toHaveCSS(
      'color',
      'rgb(10, 132, 255)'
    )
    await capture(page, '04-today-dark.png')
    await page.emulateMedia({ colorScheme: 'light' })

    await page.getByRole('button', { name: 'Hide sidebar' }).click()
    await expect(page.locator('.app-shell')).toHaveClass(/app-shell--sidebar-collapsed/)
    expect((await page.locator('.sidebar').boundingBox())?.width).toBeGreaterThanOrEqual(84)
    await capture(page, '04b-sidebar-collapsed.png')
    await page.getByRole('button', { name: 'Show sidebar' }).click()
    await expect(page.locator('.app-shell')).not.toHaveClass(/app-shell--sidebar-collapsed/)
    if (!isBaselineCapture) {
      await page.setViewportSize({ width: 880, height: 760 })
      await expect(page.getByRole('button', { name: '01 Today' })).toContainText('Today')
      await expect(page.getByRole('button', { name: 'Hide sidebar' })).toBeVisible()
      const compactStreamBounds = await dailyStream.boundingBox()
      const compactWorkspaceBounds = await page.locator('.signal-workspace').boundingBox()
      expect(compactStreamBounds?.y).toBeGreaterThan(compactWorkspaceBounds?.y ?? 0)
      await capture(page, '03b-today-compact.png')
      await page.setViewportSize({ width: 1360, height: 880 })
      const wideStreamBounds = await dailyStream.boundingBox()
      const wideWorkspaceBounds = await page.locator('.signal-workspace').boundingBox()
      expect(wideStreamBounds?.x).toBeGreaterThan(wideWorkspaceBounds?.x ?? 0)
    }

    await page.getByRole('button', { name: '05 Models & Agents' }).click()
    await expect(page.locator('.nav-item--active .nav-item__icon')).toHaveCSS(
      'color',
      isBaselineCapture ? 'rgb(175, 82, 222)' : 'rgb(127, 46, 162)'
    )
    await capture(page, '05-models.png')
    await page.getByRole('textbox', { name: 'Provider name' }).fill('Local fixture')
    await page.getByRole('textbox', { name: 'Provider base URL' }).fill('http://127.0.0.1:11434/v1')
    await page.getByRole('textbox', { name: 'Model name' }).fill('fixture-model')
    await page.getByRole('button', { name: 'Save model provider' }).click()

    await page.getByRole('button', { name: '01 Today' }).click()
    await page
      .getByRole('button', { name: 'Select signal: Structured pruning for edge deployment' })
      .click()
    await expect(signalDetail.getByRole('region', { name: 'L1 paper analysis' })).toContainText(
      'Run Analyze or press A'
    )
    await signalDetail.getByRole('button', { name: 'Analyze signal' }).click()
    await expect(page.getByText(/E2E fixture analysis passed/)).toBeVisible()
    await expect(page.getByText('Local fixture · fixture-model')).toBeVisible()
    await expect(
      signalDetail.getByRole('complementary', { name: 'L1 paper analysis result' })
    ).toContainText('L1 PAPER ANALYSIS')
    await expect(signalDetail.getByRole('heading', { name: '快速决策卡', level: 3 })).toBeVisible()
    await capture(page, '05b-paper-l1-analysis.png')

    await page.getByRole('combobox', { name: 'Analysis runner' }).selectOption('codex')
    await signalDetail.getByRole('button', { name: 'Analyze signal' }).click()
    await expect(page.getByText(/E2E local agent analysis passed/)).toBeVisible()
    await expect(page.getByText('Codex CLI · codex-cli')).toBeVisible()

    const unsavedPaperButton = signalDetail.getByRole('button', {
      name: 'Save signal',
      pressed: false
    })
    await expect(unsavedPaperButton.locator('[data-save-star]')).toHaveAttribute('fill', 'none')
    await unsavedPaperButton.click()
    const savedPaperButton = signalDetail.getByRole('button', {
      name: 'Save signal',
      pressed: true
    })
    await expect(savedPaperButton).toBeEnabled()
    await expect(savedPaperButton.locator('[data-save-star]')).toHaveAttribute(
      'fill',
      'currentColor'
    )
    await expect(savedPaperButton).toHaveCSS(
      'color',
      isBaselineCapture ? 'rgb(183, 121, 0)' : 'rgb(118, 88, 0)'
    )
    await page.getByRole('button', { name: 'Select signal: TheRSS/fixture' }).click()
    await signalDetail.getByRole('button', { name: 'Save signal' }).click()

    await page.getByRole('button', { name: '02 Saved' }).click()
    await expect(page.locator('.nav-item--active .nav-item__icon')).toHaveCSS(
      'color',
      isBaselineCapture ? 'rgb(183, 121, 0)' : 'rgb(118, 88, 0)'
    )
    await expect(page.getByRole('heading', { name: 'Saved research signals' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Select signal: Structured pruning for edge deployment' })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Select signal: TheRSS/fixture' })).toBeVisible()
    await page
      .getByRole('button', { name: 'Select signal: Structured pruning for edge deployment' })
      .click()
    await signalDetail.getByRole('button', { name: 'Save signal', pressed: true }).click()
    await expect(
      page.getByRole('button', { name: 'Select signal: Structured pruning for edge deployment' })
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Select signal: TheRSS/fixture' })).toBeVisible()

    await page.getByRole('button', { name: '01 Today' }).click()
    await expect(
      page.getByRole('button', { name: 'Select signal: Structured pruning for edge deployment' })
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Select signal: Structured pruning for edge deployment' })
      .click()
    await expect(
      signalDetail.getByRole('button', { name: 'Save signal', pressed: false })
    ).toBeEnabled()

    await page.getByRole('button', { name: '03 Discover' }).click()
    await expect(page.locator('.nav-item--active .nav-item__icon')).toHaveCSS(
      'color',
      isBaselineCapture ? 'rgb(88, 86, 214)' : 'rgb(69, 66, 181)'
    )
    await page
      .getByRole('textbox', { name: 'Research question' })
      .fill('semantic communication pruning for edge deployment')
    await page.getByRole('combobox', { name: 'Search with' }).selectOption('codex')
    await page.getByRole('button', { name: 'Expand and search' }).click()
    await expect(
      page.getByText('Fixture semantic search for pruning-aware edge intelligence.')
    ).toBeVisible()
    await expect(page.getByText('Search complete')).toBeVisible()
    await expect(page.getByText('Codex CLI · codex-cli')).toBeVisible()
    await expect(page.getByText(/semantic-discover-v1/)).toBeVisible()
    if (!isBaselineCapture) await expect(page.getByRole('status')).toHaveCount(0)
    await capture(page, '06-discover.png')

    const discoverPaper = page
      .locator('article')
      .filter({ hasText: 'Semantic expansion search for edge intelligence' })
    await expect(discoverPaper).toBeVisible()
    await expect(page.getByText('TheRSS/semantic-fixture')).toBeVisible()

    const discoverFilters = page.getByRole('group', { name: 'Filter Discover results' })
    await discoverFilters.getByRole('button', { name: 'GitHub repos 1' }).click()
    await expect(discoverPaper).toHaveCount(0)
    await expect(page.getByText('TheRSS/semantic-fixture')).toBeVisible()

    await discoverFilters.getByRole('button', { name: 'Papers 1' }).click()
    await expect(discoverPaper).toBeVisible()
    await expect(page.getByText('TheRSS/semantic-fixture')).toHaveCount(0)

    await discoverFilters.getByRole('button', { name: 'All 2' }).click()
    await expect(discoverPaper).toBeVisible()
    await expect(page.getByText('TheRSS/semantic-fixture')).toBeVisible()
    const saveDiscoverResult = discoverPaper.getByRole('button', { name: 'Save result' })
    await expect(saveDiscoverResult).toBeEnabled()
    await saveDiscoverResult.click({ force: true })
    await expect(discoverPaper.getByRole('button', { name: 'Saved' })).toBeDisabled()

    await page.getByRole('button', { name: '02 Saved' }).click()
    await expect(
      page.getByRole('button', {
        name: 'Select signal: Semantic expansion search for edge intelligence'
      })
    ).toBeVisible()

    await page.getByRole('button', { name: '01 Today' }).click()
    await expect(
      page.getByRole('button', {
        name: 'Select signal: Semantic expansion search for edge intelligence'
      })
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Select signal: Structured pruning for edge deployment' })
    ).toBeVisible()

    await page.reload()
    await expect(
      page.getByRole('button', { name: 'Select signal: Structured pruning for edge deployment' })
    ).toBeVisible()
    await expect(
      signalDetail.getByRole('button', { name: 'Save signal', pressed: false })
    ).toBeEnabled()
    if (!isBaselineCapture) {
      await expect(page.getByText(/E2E local agent analysis passed/)).toBeVisible()
    }

    await page.getByRole('button', { name: '06 Data Analytics' }).click()
    await expect(page.locator('.nav-item--active .nav-item__icon')).toHaveCSS(
      'color',
      isBaselineCapture ? 'rgb(50, 173, 230)' : 'rgb(0, 103, 127)'
    )
    await expect(page.getByRole('heading', { name: 'Data Analytics' })).toBeVisible()
    await expect(page.getByLabel('Search results')).toContainText('5')
    await expect(page.getByLabel('Deep analyses')).toContainText('2')
    await expect(page.getByText('Structured pruning for edge deployment')).toHaveCount(2)
    await expect(page.getByText('Local fixture · fixture-model')).toBeVisible()
    await expect(page.getByText('Codex CLI · codex-cli')).toBeVisible()
    await page.waitForTimeout(1_200)
    await capture(page, '07-analytics.png')

    if (!isBaselineCapture) {
      await page.getByRole('button', { name: '07 Sources' }).click()
      await expect(page.locator('.nav-item--active .nav-item__icon')).toHaveCSS(
        'color',
        'rgb(154, 84, 0)'
      )
      await expect(page.getByRole('heading', { name: '105 research sources' })).toBeVisible()
      await expect(page.locator('.source-catalog-card')).toHaveCount(23)
      await expect(page.getByRole('heading', { name: 'arXiv' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'GitHub' })).toBeVisible()
      await expect(
        page.getByText(/Catalog membership does not mean retrieval is implemented/i)
      ).toBeVisible()
      await capture(page, '08-sources.png')

      await page.getByRole('button', { name: /Pending integrations.*82/i }).click()
      await expect(page.locator('.source-catalog-card')).toHaveCount(82)
      await expect(page.getByRole('heading', { name: '3GPP Specifications' })).toBeVisible()
      await page.getByRole('button', { name: /Content sources.*23/i }).click()

      await page
        .getByRole('button', { name: 'Browse 北京智源人工智能研究院 recent content' })
        .click()
      await expect(page.getByRole('heading', { name: '北京智源人工智能研究院' })).toBeVisible()
      await expect(page.getByText('BAAI edge intelligence fixture')).toBeVisible()
      await expect(page.locator('.source-detail-boundary')).toContainText('rolling 30 days')
      await capture(page, '08b-source-detail.png')
      await page.getByRole('button', { name: 'Back to source directory' }).click()
    }

    await expect(page.getByRole('button', { name: /Sync/ })).toHaveCount(0)
    await expect(page.getByText(/Google Drive/i)).toHaveCount(0)
  } finally {
    await application.close()
  }
})

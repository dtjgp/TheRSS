import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env, platform } from 'node:process'
import { _electron as electron, expect, test, type Page } from '@playwright/test'

test('Discover-first search across every deployed source', async () => {
  const userDataDirectory = await mkdtemp(join(tmpdir(), 'therss-e2e-'))
  const poisonVault = join(userDataDirectory, 'must-not-touch-llm-wiki')
  const poisonSentinel = join(poisonVault, 'SENTINEL.txt')
  await mkdir(poisonVault, { recursive: true })
  await writeFile(poisonSentinel, 'fixture adapter must not touch this vault\n')
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
          env: {
            ...env,
            HOME: userDataDirectory,
            THERSS_E2E_FIXTURES: '1',
            THERSS_LLM_WIKI_PATH: poisonVault
          }
        }
      : {
          args: [`--user-data-dir=${userDataDirectory}`, '.'],
          env: {
            ...env,
            HOME: userDataDirectory,
            THERSS_E2E_FIXTURES: '1',
            THERSS_LLM_WIKI_PATH: poisonVault
          }
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

    const discoverHeading = page.getByRole('heading', {
      name: 'Search across your full source desk'
    })
    await expect(discoverHeading).toBeVisible()
    const appleTypography = await page.evaluate(() => {
      const rootStyle = getComputedStyle(document.documentElement)
      return {
        textVariable: rootStyle.getPropertyValue('--font-apple-text').trim(),
        displayVariable: rootStyle.getPropertyValue('--font-apple-display').trim(),
        bodyFont: getComputedStyle(document.body).fontFamily
      }
    })
    expect(appleTypography.textVariable).toContain('-apple-system')
    expect(appleTypography.textVariable).toContain('SF Pro Text')
    expect(appleTypography.displayVariable).toContain('SF Pro Display')
    expect(appleTypography.bodyFont).toContain('-apple-system')
    expect(
      await discoverHeading.evaluate((element) => getComputedStyle(element).fontFamily)
    ).toContain('SF Pro Display')
    const primaryNavigation = page.getByRole('navigation', { name: 'Primary navigation' })
    await expect(primaryNavigation.getByRole('button')).toHaveCount(2)
    await expect(primaryNavigation.getByRole('button', { name: '01 Discover' })).toBeVisible()
    await expect(primaryNavigation.getByRole('button', { name: '02 Saved' })).toBeVisible()
    const researchUtilities = page.getByRole('navigation', { name: 'Research utilities' })
    await expect(researchUtilities.getByRole('button')).toHaveCount(2)
    await expect(researchUtilities.getByRole('button', { name: '03 Data Analytics' })).toBeVisible()
    await expect(researchUtilities.getByRole('button', { name: '04 Sources' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible()
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
      const fileMenu = applicationMenuLabels.find((item) => item.label === 'File')
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
      expect(fileMenu?.submenu).toContain('Close Window')
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
    const resultRegion = page.getByRole('region', { name: 'Discover results' })
    await expect(resultRegion).toHaveAttribute('tabindex', '0')
    expect(
      await resultRegion.evaluate((element) => ({
        clientHeight: element.clientHeight,
        overflowY: getComputedStyle(element).overflowY,
        scrollHeight: element.scrollHeight
      }))
    ).toMatchObject({ overflowY: 'auto' })
    expect(
      await resultRegion.evaluate((element) => element.scrollHeight > element.clientHeight)
    ).toBe(true)
    await resultRegion.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    expect(await resultRegion.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    await resultRegion.evaluate((element) => {
      element.scrollTop = 0
    })
    const paperSave = discoverPaper.getByRole('button', { name: 'Save result' })
    await expect(paperSave).toHaveAttribute('aria-pressed', 'false')
    await expect(paperSave.locator('[data-save-star]')).toHaveAttribute('fill', 'none')
    await expect(discoverPaper.getByRole('button', { name: 'Analyze paper' })).toBeVisible()
    await expect(discoverRepository.getByRole('button', { name: 'Analyze paper' })).toHaveCount(0)
    await expect(discoverArticle.getByRole('button', { name: 'Analyze paper' })).toHaveCount(0)
    await expect(discoverPaper.getByRole('button', { name: 'Promote to llm-wiki' })).toBeVisible()
    await expect(
      discoverRepository.getByRole('button', { name: 'Promote to llm-wiki' })
    ).toHaveCount(0)
    await expect(discoverArticle.getByRole('button', { name: 'Promote to llm-wiki' })).toHaveCount(
      0
    )
    await discoverPaper.getByRole('button', { name: 'Promote to llm-wiki' }).click()
    const promotionDialog = page.getByRole('dialog', { name: 'Promote paper to llm-wiki' })
    await expect(promotionDialog).toContainText('Destination: local llm-wiki vault')
    await expect(promotionDialog).not.toContainText(poisonVault)
    await expect(promotionDialog).toContainText(
      'Literature/Paper_Notes/L2_Structured/Model_Compression'
    )
    await capture(page, '02a-llm-wiki-promotion-preview.png')
    await promotionDialog.getByRole('button', { name: 'Cancel promotion' }).click()
    await expect(promotionDialog).toHaveCount(0)
    await discoverPaper.getByRole('button', { name: 'Promote to llm-wiki' }).click()
    await page.getByRole('button', { name: 'Confirm local promotion' }).click()
    await expect(discoverPaper.getByRole('status')).toContainText('without writing the real vault')
    await discoverPaper.getByRole('button', { name: 'Analyze paper' }).click()
    await expect(discoverPaper.getByLabel('L1 paper analysis result')).toContainText(
      'llm-wiki-paper-l1-v1'
    )
    await expect(paperSave).toHaveAttribute('aria-pressed', 'false')
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
    await expect(searchDetails.getByText('Codex CLI · codex-cli')).toBeVisible()
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
    const removeSavedArticle = discoverArticle.getByRole('button', {
      name: 'Remove result from Saved'
    })
    await expect(removeSavedArticle).toHaveAttribute('aria-pressed', 'true')
    await expect(removeSavedArticle.locator('[data-save-star]')).toHaveAttribute(
      'fill',
      'currentColor'
    )
    await capture(page, '03b-discover-star-saved.png')
    await removeSavedArticle.click({ force: true })
    await expect(discoverArticle.getByRole('button', { name: 'Save result' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    await discoverArticle.getByRole('button', { name: 'Save result' }).click({ force: true })
    await primaryNavigation.getByRole('button', { name: '02 Saved' }).click()
    await expect(page.getByRole('heading', { name: 'Saved research signals' })).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: 'Select signal: BAAI structured pruning research fixture'
      })
    ).toBeVisible()
    await expect(page.getByRole('group', { name: 'Filter saved signals by source' })).toBeVisible()
    const savedActionsBox = await page.locator('.signal-detail__actions').boundingBox()
    const savedSummaryBox = await page.locator('.signal-detail__summary').boundingBox()
    expect(savedActionsBox).not.toBeNull()
    expect(savedSummaryBox).not.toBeNull()
    if (savedActionsBox && savedSummaryBox) {
      expect(savedActionsBox.y).toBeLessThan(savedSummaryBox.y)
    }
    const savedListDivider = page.getByRole('separator', { name: 'Resize saved signal list' })
    await expect(savedListDivider).toBeVisible()
    // End grows the pane to the maximum the current viewport allows, which
    // ResizableSplitPane derives from window.innerWidth. Asserting a fixed pixel value
    // only holds on a window wide enough to reach the 520 cap; a narrower screen reports
    // a smaller aria-valuemax. Assert the relationship instead of the magic number.
    const savedListMaximum = await savedListDivider.getAttribute('aria-valuemax')
    if (!savedListMaximum) throw new Error('Saved list divider is missing aria-valuemax')
    await savedListDivider.focus()
    await page.keyboard.press('End')
    await expect(savedListDivider).toHaveAttribute('aria-valuenow', savedListMaximum)
    expect(await page.evaluate(() => window.localStorage.getItem('therss.saved-list-width'))).toBe(
      savedListMaximum
    )
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

    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    const personalPrompt = page.getByRole('textbox', { name: 'Personal Discover prompt' })
    await expect(personalPrompt).toHaveValue('')
    await page.emulateMedia({ colorScheme: 'dark' })
    const placeholderContrast = await personalPrompt.evaluate((element) => {
      const parseRgb = (value: string) => {
        const channels = value.match(/[\d.]+/gu)?.map(Number)
        if (!channels || channels.length < 3) throw new Error(`Unsupported color: ${value}`)
        return channels.slice(0, 3)
      }
      const luminance = (channels: number[]) => {
        const linear = channels
          .map((value) => value / 255)
          .map((value) =>
            value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
          )
        return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!
      }
      const foreground = luminance(parseRgb(getComputedStyle(element, '::placeholder').color))
      const background = luminance(parseRgb(getComputedStyle(element).backgroundColor))
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
    })
    expect(placeholderContrast).toBeGreaterThanOrEqual(4.5)
    await capture(page, '05a-personal-prompt-dark.png')
    await page.emulateMedia({ colorScheme: 'light' })
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(2)
    })
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    const zoomLayout = await page.evaluate(() => {
      const main = document.querySelector('main')!
      return {
        documentOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainOverflow: main.scrollWidth - main.clientWidth
      }
    })
    expect(zoomLayout.documentOverflow).toBeLessThanOrEqual(1)
    expect(zoomLayout.mainOverflow).toBeLessThanOrEqual(1)
    await capture(page, '05z-settings-200-percent.png')
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(1)
    })
    await personalPrompt.fill(
      'I research edge intelligence and energy systems. Prioritize reproducible evaluations and explicit resource budgets.'
    )
    await page.getByRole('button', { name: 'Save personal Discover prompt' }).click()
    await expect(page.getByRole('status')).toContainText('Personal context saved')
    await page.locator('main').evaluate((element) => {
      element.scrollTop = 0
    })
    await capture(page, '05-personal-prompt-settings.png')
    await page.getByRole('tab', { name: 'Model provider' }).click()
    await page.getByRole('textbox', { name: 'Provider name' }).fill('Local fixture')
    await page.getByRole('textbox', { name: 'Provider base URL' }).fill('http://127.0.0.1:11434/v1')
    await page.getByRole('textbox', { name: 'Model name' }).fill('fixture-model')
    await page.getByRole('button', { name: 'Test connection' }).click()
    await expect(page.getByRole('status', { name: 'Provider connection result' })).toContainText(
      'without a network request'
    )
    await page.getByRole('button', { name: 'Save model provider' }).click()
    await expect(page.locator('.provider-save-status')).toContainText('Provider settings saved')
    await expect(page.getByText('Unsaved changes')).toHaveCount(0)
    if (!isBaselineCapture) {
      const cdp = await page.context().newCDPSession(page)
      const accessibilityTree = await cdp.send('Accessibility.getFullAXTree')
      const accessibleNodes = accessibilityTree.nodes.map((node) => ({
        role: node.role?.value,
        name: node.name?.value
      }))
      expect(accessibleNodes).toEqual(
        expect.arrayContaining([
          { role: 'heading', name: 'Settings' },
          { role: 'tab', name: 'Personal context' },
          { role: 'tab', name: 'Model provider' },
          { role: 'button', name: 'Test connection' }
        ])
      )
      await cdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }]
      })
      expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true)
      await page.getByRole('button', { name: 'Save model provider' }).focus()
      await page.keyboard.press('Shift+Tab')
      await expect(page.getByRole('button', { name: 'Test connection' })).toBeFocused()
      await expect(page.getByRole('button', { name: 'Test connection' })).toHaveCSS(
        'outline-style',
        'solid'
      )
      await capture(page, '05f-settings-forced-colors.png')
      await cdp.send('Emulation.setEmulatedMedia', { features: [] })
    }
    await capture(page, '05-models.png')

    await page.locator('main').evaluate((element) => {
      element.scrollTop = 500
    })
    expect(await page.locator('main').evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    await researchUtilities.getByRole('button', { name: '03 Data Analytics' }).click()
    expect(await page.locator('main').evaluate((element) => element.scrollTop)).toBe(0)
    await expect(page.getByRole('heading', { name: 'Data Analytics' })).toBeVisible()
    await capture(page, '05d-navigation-scroll-reset.png')

    await primaryNavigation.getByRole('button', { name: '01 Discover' }).click()
    await expect(page.getByRole('status', { name: 'Personal prompt status' })).toContainText(
      'Personal context on'
    )
    await capture(page, '05b-personalized-discover-ready.png')
    await page.getByRole('button', { name: 'Expand and search' }).click()
    await expect(page.getByText('Search complete')).toBeVisible()
    await page.getByRole('button', { name: /Search details/u }).click()
    await expect(page.getByLabel('Discover search details')).toContainText(
      'semantic-discover-v2 · personal context applied'
    )
    await capture(page, '05c-personalized-discover.png')

    await page.getByRole('button', { name: 'Hide sidebar' }).click()
    await expect(page.locator('.app-shell')).toHaveClass(/app-shell--sidebar-collapsed/)
    await page.getByRole('button', { name: 'Show sidebar' }).click()
    await expect(page.locator('.app-shell')).not.toHaveClass(/app-shell--sidebar-collapsed/)

    await researchUtilities.getByRole('button', { name: '03 Data Analytics' }).click()
    await expect(page.getByRole('heading', { name: 'Data Analytics' })).toBeVisible()
    const searchResults = page.getByLabel('Lifetime returned records')
    await expect(searchResults).toContainText('6')
    await expect(searchResults).toContainText('0 legacy Today · 6 Discover')
    await capture(page, '06-analytics.png')

    if (!isBaselineCapture) {
      await researchUtilities.getByRole('button', { name: '04 Sources' }).click()
      await expect(
        page.getByRole('heading', { name: '22 configured research sources' })
      ).toBeVisible()
      await expect(page.locator('.source-catalog-card')).toHaveCount(22)
      await capture(page, '07-sources-directory.png')
      await page
        .getByRole('button', { name: 'Browse 北京智源人工智能研究院 recent content' })
        .click()
      await expect(page.getByRole('heading', { name: '北京智源人工智能研究院' })).toBeVisible()
      await expect(page.getByText('BAAI structured pruning research fixture')).toBeVisible()
      await expect(page.locator('.source-detail-boundary')).toContainText('rolling 30 days')
      await capture(page, '08-source-detail.png')
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

    if (!isBaselineCapture && platform === 'darwin') {
      const originalBounds = await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]!.getBounds()
      )
      // A fixed 1120x760 only fits on a large display. Both setBounds and the
      // restore-time work-area fit in windowState clamp to the display, so a 1024x768 CI
      // runner reopened at 1024x677 and the equality assertion failed. Derive the
      // expectation from the actual display: request a size that already fits the work
      // area, then expect the reopened window to reproduce exactly the bounds it held.
      const restoredBounds = await application.evaluate(
        ({ BrowserWindow, screen }, requested) => {
          const fitToWorkArea = (bounds: {
            x: number
            y: number
            width: number
            height: number
          }) => {
            const area = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y }).workArea
            return {
              x: bounds.x,
              y: bounds.y,
              width: Math.min(bounds.width, area.x + area.width - bounds.x),
              height: Math.min(bounds.height, area.y + area.height - bounds.y)
            }
          }
          const window = BrowserWindow.getAllWindows()[0]!
          window.setBounds(fitToWorkArea(requested))
          return fitToWorkArea(window.getBounds())
        },
        { x: originalBounds.x, y: originalBounds.y, width: 1120, height: 760 }
      )
      await page.waitForTimeout(350)
      expect(
        await application.evaluate(({ Menu }) => {
          const closeItem = Menu.getApplicationMenu()?.getMenuItemById('close-window')
          return closeItem
            ? {
                role: closeItem.role,
                accelerator: closeItem.accelerator,
                registerAccelerator: closeItem.registerAccelerator
              }
            : null
        })
      ).toEqual({
        role: 'close',
        accelerator: 'CommandOrControl+W',
        registerAccelerator: true
      })
      await application.evaluate(({ app, BrowserWindow }) => {
        app.focus({ steal: true })
        BrowserWindow.getAllWindows()[0]?.focus()
      })
      await expect
        .poll(() =>
          application.evaluate(({ BrowserWindow }) => Boolean(BrowserWindow.getFocusedWindow()))
        )
        .toBe(true)
      await application.evaluate(({ Menu }) => {
        Menu.sendActionToFirstResponder('performClose:')
      })
      await expect.poll(() => page.isClosed()).toBe(true)
      await expect.poll(() => application.windows().length).toBe(0)

      const reopenedWindow = application.waitForEvent('window')
      await application.evaluate(({ app }) => {
        app.emit('activate')
      })
      const reopenedPage = await reopenedWindow
      await expect(
        reopenedPage.getByRole('heading', { name: 'Search across your full source desk' })
      ).toBeVisible()
      expect(
        await application.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0]!.getBounds()
        )
      ).toEqual(restoredBounds)
      await reopenedPage.getByRole('button', { name: 'Settings' }).click()
      const reopenedPrompt = reopenedPage.getByRole('textbox', {
        name: 'Personal Discover prompt'
      })
      await reopenedPrompt.fill('Unsaved shutdown guard fixture')
      await expect(reopenedPage.getByText('Unsaved changes')).toBeVisible()
    }
  } finally {
    await application.close()
    expect(await readdir(poisonVault)).toEqual(['SENTINEL.txt'])
    expect(await readFile(poisonSentinel, 'utf8')).toBe(
      'fixture adapter must not touch this vault\n'
    )
  }
})

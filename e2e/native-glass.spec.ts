import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env } from 'node:process'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'

interface Diagnostic {
  active: boolean
  suspended?: boolean
  revision: number
  modal: boolean
  focusedControl: string
  appearance: string
  reduceTransparency: boolean
  contentScale: number
  originalFrame: { width: number; height: number }
  groups: {
    id: string
    class: string
    ownsContent: boolean
    frame: { width: number; height: number }
  }[]
  controls: string[]
}
async function native(
  application: ElectronApplication,
  action: string,
  id = ''
): Promise<Diagnostic | boolean> {
  if (action !== 'inspect') {
    const page = application.windows()[0]!
    // Fixture actions must target an acknowledged layout, just like the native
    // controls. Never retry an action that might already have changed data.
    await expect
      .poll(async () => {
        const before = await inspect(application)
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            )
        )
        const diagnostic = await inspect(application)
        const stable =
          before.active &&
          diagnostic.active &&
          !diagnostic.suspended &&
          before.revision === diagnostic.revision &&
          diagnostic.revision ===
            Number(await page.evaluate(() => document.documentElement.dataset.nativeRevision))
        if (stable) return true
        const renderer = await page.evaluate(async () => ({
          mode: document.documentElement.dataset.nativeGlass,
          failure: document.documentElement.dataset.nativeFailure,
          geometry: document.documentElement.dataset.nativeGeometry,
          revision: document.documentElement.dataset.nativeRevision,
          viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
          status: await window.therss.nativeGlass!.getStatus()
        }))
        const windowSnapshot = await application.evaluate(({ BrowserWindow }) => {
          const target = BrowserWindow.getAllWindows()[0]!
          return { bounds: target.getBounds(), zoom: target.webContents.getZoomFactor() }
        })
        return JSON.stringify({
          action,
          id,
          before,
          after: diagnostic,
          renderer,
          window: windowSnapshot
        })
      })
      .toBe(true)
  }
  return application.evaluate(
    ({ app, BrowserWindow }, request) => {
      const require = process
        .getBuiltinModule('module')
        .createRequire(app.getAppPath() + '/package.json')
      const binding = require(app.getAppPath() + '/out/native-glass/therss-glass.node') as {
        inspect(handle: Buffer): string
        testAction(handle: Buffer, id: string, action: string): boolean
      }
      const window = BrowserWindow.getAllWindows()[0]!
      const handle = window.getNativeWindowHandle()
      return request.action === 'inspect'
        ? JSON.parse(binding.inspect(handle))
        : binding.testAction(handle, request.id, request.action)
    },
    { action, id }
  )
}
const inspect = async (app: ElectronApplication) => (await native(app, 'inspect')) as Diagnostic

async function constrainFixtureDisplay(application: ElectronApplication): Promise<void> {
  const height = Number(env.THERSS_E2E_MAX_WINDOW_HEIGHT)
  if (Number.isFinite(height)) {
    if (height < 600) throw new Error('Fixture window height must preserve the app minimum')
    await application.evaluate(({ BrowserWindow }, limit) => {
      BrowserWindow.getAllWindows()[0]!.setMaximumSize(16384, limit)
    }, height)
  }
  const rate = Number(env.THERSS_E2E_CPU_THROTTLE)
  if (Number.isFinite(rate)) {
    if (rate < 1) throw new Error('Fixture CPU throttle must be at least one')
    const page = await application.firstWindow()
    const session = await page.context().newCDPSession(page)
    await session.send('Emulation.setCPUThrottlingRate', { rate })
  }
}

test('native glass pilot preserves navigation, modal, focus, appearance and window lifecycle', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'therss-native-e2e-'))
  const application = await electron.launch({
    args: [`--user-data-dir=${directory}`, '.'],
    env: { ...env, THERSS_E2E_FIXTURES: '1', THERSS_UI: 'web', THERSS_NATIVE_GLASS: 'pilot' }
  })
  try {
    const page = await application.firstWindow()
    await constrainFixtureDisplay(application)
    const initialMedia = await page.context().newCDPSession(page)
    await initialMedia.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-color-scheme', value: 'light' },
        { name: 'prefers-reduced-transparency', value: 'no-preference' }
      ]
    })
    await expect(
      page.getByRole('heading', { name: 'Discover research', exact: true })
    ).toBeVisible()
    const status = await page.evaluate(() => window.therss.nativeGlass!.getStatus())
    test.skip(
      !status.available && status.reason === 'unsupported-system',
      'Host OS lacks AppKit Liquid Glass; web fallback is covered separately'
    )
    expect(status.available).toBe(true)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.nativeGlass))
      .toBe('native')
    const first = await inspect(application)
    expect(first.groups.every((group) => group.ownsContent)).toBe(true)
    expect(
      first.groups.filter((group) => group.class === 'TRGlassView').length
    ).toBeGreaterThanOrEqual(2)
    expect(first.controls).toEqual([
      'discover',
      'saved',
      'analytics',
      'sources',
      'settings',
      'source-status',
      'sidebar-toggle'
    ])
    expect(await native(application, 'hit', 'sidebar-toggle')).toBe(true)
    expect(await native(application, 'hit', 'saved')).toBe(true)
    expect(await native(application, 'press', 'saved')).toBe(true)
    await expect(page.getByRole('heading', { name: 'Saved research signals' })).toBeVisible()
    expect(await native(application, 'press', 'sources')).toBe(true)
    await expect(page.getByRole('heading', { name: 'Sources', exact: true })).toBeVisible()
    expect(
      await page.getByRole('listbox', { name: 'Configured sources' }).getByRole('option').count()
    ).toBe(22)
    expect(await native(application, 'press', 'discover')).toBe(true)
    await expect(
      page.getByRole('heading', { name: 'Discover research', exact: true })
    ).toBeVisible()

    const diagnostics = await inspect(application)
    expect(
      await page.evaluate(
        (revision) => window.therss.nativeGlass!.focus('first', revision),
        diagnostics.revision
      )
    ).toBe(true)
    expect((await inspect(application)).focusedControl).toBe('discover')
    await native(application, 'tab', 'discover')
    expect((await inspect(application)).focusedControl).toBe('saved')
    await native(application, 'backtab', 'discover')
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label')))
      .not.toBeNull()

    await application.evaluate(({ Menu }) =>
      Menu.getApplicationMenu()
        ?.items.find((item) => item.label === 'Edit')
        ?.submenu?.items.find((item) => item.label === 'Find Local Research')
        ?.click()
    )
    await expect(page.getByRole('dialog', { name: 'Find research' })).toBeVisible()
    await expect.poll(async () => (await inspect(application)).modal).toBe(true)
    expect(await native(application, 'press', 'sources')).toBe(false)
    await page.getByLabel('Search local research').press('Escape')
    await expect(page.getByRole('dialog', { name: 'Find research' })).toBeHidden()
    await expect.poll(async () => (await inspect(application)).modal).toBe(false)

    const media = await page.context().newCDPSession(page)
    for (const dark of [false, true]) {
      await media.send('Emulation.setEmulatedMedia', {
        features: [
          { name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' },
          { name: 'prefers-contrast', value: 'no-preference' },
          { name: 'prefers-reduced-transparency', value: 'no-preference' }
        ]
      })
      await expect
        .poll(async () => (await inspect(application)).appearance)
        .toContain(dark ? 'DarkAqua' : 'Aqua')
    }
    await media.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-color-scheme', value: 'dark' },
        { name: 'prefers-contrast', value: 'more' },
        { name: 'prefers-reduced-transparency', value: 'reduce' }
      ]
    })
    await expect.poll(async () => (await inspect(application)).reduceTransparency).toBe(true)
    expect(
      (await inspect(application)).groups.every((group) => group.class !== 'TRGlassView')
    ).toBe(true)

    for (const [width, height] of [
      [1360, 880],
      [1024, 677],
      [820, 600],
      [900, 700]
    ] as const) {
      const actual = await application.evaluate(
        ({ BrowserWindow }, bounds) => {
          const window = BrowserWindow.getAllWindows()[0]!
          window.setSize(bounds.width, bounds.height)
          // macOS constrains height to the runner's actual display work area.
          const { width, height } = window.getBounds()
          return { width, height }
        },
        { width, height }
      )
      await expect
        .poll(() => page.evaluate(() => ({ width: innerWidth, height: innerHeight })))
        .toEqual(actual)
      await expect
        .poll(async () => (await inspect(application)).originalFrame)
        .toMatchObject(actual)
    }
    await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(2)
    )
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(450)
    await expect
      .poll(async () => {
        const diagnostic = await inspect(application)
        if (diagnostic.active) return diagnostic.contentScale
        return page.evaluate(async () =>
          JSON.stringify({
            mode: document.documentElement.dataset.nativeGlass,
            failure: document.documentElement.dataset.nativeFailure,
            status: await window.therss.nativeGlass!.getStatus()
          })
        )
      })
      .toBe(2)
    // Scale acknowledgment can precede the sidebar's 180ms grid transition.
    await expect(page.locator('.sidebar')).toHaveCSS('width', '84px')
    await expect
      .poll(
        async () =>
          (await inspect(application)).groups?.find((group) => group.id === 'sidebar')?.frame.width
      )
      .toBe(168)
    expect(await native(application, 'hit', 'saved')).toBe(true)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.nativeGlass))
      .toBe('native')
    await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(1)
    )
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(900)
    await expect.poll(async () => (await inspect(application)).contentScale).toBe(1)
    await page.reload()
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const root = document.documentElement
          return root.dataset.nativeGlass === 'native'
            ? 'native'
            : JSON.stringify({
                mode: root.dataset.nativeGlass,
                failure: root.dataset.nativeFailure,
                geometry: root.dataset.nativeGeometry,
                staleRevision: root.dataset.nativeStaleRevision,
                status: await window.therss.nativeGlass!.getStatus(),
                viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }
              })
        })
      )
      .toBe('native')
    await expect.poll(async () => (await inspect(application)).revision).toBeGreaterThan(0)
    const beforeSuspend = await inspect(application)
    const refused = await page.evaluate(
      (revision) =>
        window.therss.nativeGlass!.present({
          revision,
          scrollRevision: revision,
          appearance: 'light',
          contrast: 'normal',
          reduceTransparency: false,
          modal: false,
          viewport: { width: 1, height: 1 },
          surfaces: []
        }),
      beforeSuspend.revision + 1
    )
    expect(refused.applied).toBe(false)
    expect(refused.geometryMismatch?.viewport).toEqual({ width: 1, height: 1 })
    expect(await inspect(application)).toMatchObject({ active: true, suspended: true })
    expect(
      await page.evaluate(
        (revision) => window.therss.nativeGlass!.focus('first', revision),
        beforeSuspend.revision
      )
    ).toBe(false)
    const nativeBlocked = await application.evaluate(({ app, BrowserWindow }) => {
      const require = process
        .getBuiltinModule('module')
        .createRequire(app.getAppPath() + '/package.json')
      const binding = require(app.getAppPath() + '/out/native-glass/therss-glass.node')
      return binding.testAction(
        BrowserWindow.getAllWindows()[0]!.getNativeWindowHandle(),
        'saved',
        'press'
      )
    })
    expect(nativeBlocked).toBe(false)
    await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]!
      window.setSize(901, window.getBounds().height)
    })
    await expect.poll(async () => (await inspect(application)).suspended).toBe(false)
    expect((await inspect(application)).revision).toBeGreaterThan(beforeSuspend.revision)
    expect(await native(application, 'hit', 'saved')).toBe(true)
    await native(application, 'press', 'saved')
    await expect(page.getByRole('heading', { name: 'Saved research signals' })).toBeVisible()
    await native(application, 'press', 'discover')
    await expect(
      page.getByRole('heading', { name: 'Discover research', exact: true })
    ).toBeVisible()
    await page.evaluate(() => window.therss.nativeGlass!.release())
    expect((await inspect(application)).active).toBe(false)
    const closed = page.waitForEvent('close')
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close())
    await closed
    const reopened = application.waitForEvent('window')
    await application.evaluate(({ app }) => app.emit('activate'))
    const nextPage = await reopened
    await expect(
      nextPage.getByRole('heading', { name: 'Discover research', exact: true })
    ).toBeVisible()
    await expect
      .poll(() => nextPage.evaluate(() => document.documentElement.dataset.nativeGlass))
      .toBe('native')
    expect((await inspect(application)).active).toBe(true)
  } finally {
    await application.close()
  }
})

test('full native actions preserve Discover, Saved, promotion, Undo and keyboard behavior', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'therss-native-full-'))
  const application = await electron.launch({
    args: [`--user-data-dir=${directory}`, '.'],
    env: { ...env, THERSS_E2E_FIXTURES: '1', THERSS_UI: 'web', THERSS_NATIVE_GLASS: 'full' }
  })
  try {
    const page = await application.firstWindow()
    await constrainFixtureDisplay(application)
    const media = await page.context().newCDPSession(page)
    await media.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-color-scheme', value: 'light' },
        { name: 'prefers-reduced-transparency', value: 'no-preference' }
      ]
    })
    await expect(
      page.getByRole('heading', { name: 'Discover research', exact: true })
    ).toBeVisible()
    const status = await page.evaluate(() => window.therss.nativeGlass!.getStatus())
    test.skip(!status.available && status.reason === 'unsupported-system', 'OS lacks native glass')
    expect(status.available).toBe(true)
    await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.setSize(1360, 880)
    )
    await page
      .getByRole('textbox', { name: 'Research question' })
      .fill('structured pruning edge deployment')
    await page.getByRole('combobox', { name: 'Search with' }).selectOption('codex')
    await page.getByRole('button', { name: 'Expand and search' }).click()
    await expect(page.getByLabel('Selected Discover result')).toBeVisible()
    // Only visible controls are projected. A short CI display requires the same
    // scroll a user would perform before interacting with this floating strip.
    await page
      .locator('.signal-detail__actions')
      .evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await expect
      .poll(async () => (await inspect(application)).controls)
      .toEqual(expect.arrayContaining(['save-item', 'analyze-item', 'promote-item']))
    const save = page.locator('[data-native-action="save-item"]')
    await expect(save).toHaveAttribute('data-native-control', 'true')
    await native(application, 'press', 'save-item')
    await expect(save).toHaveAttribute('aria-pressed', 'true')
    await expect(save).toHaveAttribute('data-native-control', 'true')
    await native(application, 'press', 'analyze-item')
    await expect(page.getByLabel('L1 paper analysis result')).toContainText('llm-wiki-paper-l1-v3')
    await native(application, 'press', 'promote-item')
    await expect(page.getByRole('dialog', { name: 'Promote paper to llm-wiki' })).toBeVisible()
    await expect.poll(async () => (await inspect(application)).modal).toBe(true)
    expect(await native(application, 'press', 'save-item')).toBe(false)
    await page.getByRole('button', { name: 'Cancel promotion' }).click()
    await expect.poll(async () => (await inspect(application)).modal).toBe(false)
    const originalTitle = await page.locator('.signal-detail__title').textContent()
    await native(application, 'focus', 'save-item')
    await native(application, 'key:ArrowDown', 'save-item')
    await expect(page.locator('.signal-detail__title')).not.toHaveText(originalTitle!)
    await expect.poll(async () => (await inspect(application)).focusedControl).toBe('web')
    await expect(page.locator('.signal-row__select[aria-current="true"]')).toBeFocused()
    await native(application, 'key:ArrowUp', 'save-item')
    await expect(page.locator('.signal-detail__title')).toHaveText(originalTitle!)
    await native(application, 'press', 'saved')
    await expect(page.getByRole('heading', { name: 'Saved research signals' })).toBeVisible()
    await expect.poll(async () => (await inspect(application)).controls).toContain('dismiss-item')
    await native(application, 'repeat-space', 'dismiss-item')
    await expect(page.locator('.signal-detail__title')).toHaveText(originalTitle!)
    await native(application, 'key:d', 'dismiss-item')
    await expect.poll(async () => (await inspect(application)).controls).toContain('undo')
    await expect(page.locator('.triage-toast > span')).toHaveAttribute(
      'data-native-control',
      'true'
    )
    await native(application, 'key:Meta-z', 'undo')
    await expect(page.locator('.signal-detail__title')).toHaveText(originalTitle!)
    await native(application, 'press', 'dismiss-item')
    await expect.poll(async () => (await inspect(application)).controls).toContain('undo')
    await native(application, 'press', 'undo')
    await expect(page.locator('.signal-detail__title')).toHaveText(originalTitle!)
    await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.setSize(1024, 700)
    )
    const actions = page.locator('.signal-detail__actions')
    await expect.poll(() => actions.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
    await expect.poll(async () => (await inspect(application)).controls).toContain('dismiss-item')
    // Small deltas must survive presentation revisions before hitting an edge.
    // Waiting for acknowledgment between packets would conceal this regression.
    await expect
      .poll(() => actions.evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBeGreaterThanOrEqual(39)
    for (let repetition = 0; repetition < 3; repetition += 1) {
      await actions.evaluate((el) => {
        el.scrollLeft = 0
      })
      expect(await native(application, 'hit', 'analyze-item')).toBe(true)
      const delivered = await application.evaluate(async ({ app, BrowserWindow }) => {
        const require = process
          .getBuiltinModule('module')
          .createRequire(app.getAppPath() + '/package.json')
        const binding = require(app.getAppPath() + '/out/native-glass/therss-glass.node')
        const handle = BrowserWindow.getAllWindows()[0]!.getNativeWindowHandle()
        let count = 0
        for (let packet = 0; packet < 39; packet += 1) {
          if (binding.testAction(handle, 'analyze-item', 'wheel-right-one')) count += 1
          await new Promise((resolve) => setTimeout(resolve, 8))
        }
        return count
      })
      expect(delivered).toBe(39)
      await expect.poll(() => actions.evaluate((el) => el.scrollLeft)).toBe(39)
    }
    await native(application, 'wheel-right', 'analyze-item')
    await expect.poll(() => actions.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
    await native(application, 'wheel-down', 'analyze-item')
    await expect
      .poll(() => page.locator('.signal-detail').evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0)
    await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]!
      window.setSize(900, 700)
      window.webContents.setZoomFactor(2)
    })
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(450)
    await expect(page.locator('.sidebar')).toHaveCSS('width', '84px')
    await expect
      .poll(() => page.locator('.signal-detail').evaluate((el) => el.clientHeight))
      .toBeGreaterThanOrEqual(220)
    expect(
      await page.locator('.inbox-toolbar').evaluate((el) => {
        const sources = el.querySelector('.source-filters')!.getBoundingClientRect()
        const runner = el.querySelector('.analysis-runner-control')!.getBoundingClientRect()
        return (
          Math.min(sources.right, runner.right) > Math.max(sources.left, runner.left) &&
          Math.min(sources.bottom, runner.bottom) > Math.max(sources.top, runner.top)
        )
      })
    ).toBe(false)
    const zoomLayout = await page.locator('main').evaluate((el) => {
      const right = el.getBoundingClientRect().right
      return {
        overflow: el.scrollWidth - el.clientWidth,
        offenders: Array.from(el.querySelectorAll<HTMLElement>('*'))
          .filter((node) => node.getBoundingClientRect().right > right + 1)
          .map((node) => ({
            tag: node.tagName,
            class: node.className,
            right: node.getBoundingClientRect().right
          }))
          .slice(0, 12)
      }
    })
    expect(zoomLayout.overflow, JSON.stringify(zoomLayout.offenders)).toBeLessThanOrEqual(1)
    await expect
      .poll(async () => {
        const diagnostic = await inspect(application)
        if (diagnostic.active) return diagnostic.contentScale
        return page.evaluate(async () =>
          JSON.stringify({
            mode: document.documentElement.dataset.nativeGlass,
            failure: document.documentElement.dataset.nativeFailure,
            status: await window.therss.nativeGlass!.getStatus()
          })
        )
      })
      .toBe(2)
    await actions.evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.querySelector('.signal-detail__actions')!.getBoundingClientRect().top -
            document.querySelector('.topbar')!.getBoundingClientRect().bottom
        )
      )
      .toBeGreaterThanOrEqual(0)
    expect(await native(application, 'hit', 'save-item')).toBe(true)
    const zoomed = await inspect(application)
    expect(zoomed.groups.find((group) => group.id === 'sidebar')).toMatchObject({
      class: 'TRGlassView',
      frame: { width: 168 }
    })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.nativeGlass))
      .toBe('native')
  } finally {
    await application.close()
  }
})

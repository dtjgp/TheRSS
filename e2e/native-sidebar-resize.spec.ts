import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env } from 'node:process'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'

async function sidebar(
  application: ElectronApplication,
  action: 'inspect' | 'resize' | 'divider' | 'layout-divider',
  width = 0
) {
  return application.evaluate(
    ({ app, BrowserWindow }, request) => {
      const binding = process
        .getBuiltinModule('node:module')
        .createRequire(app.getAppPath() + '/package.json')(
        app.getAppPath() + '/out/native-appkit/therss-ui.node'
      ) as {
        inspect(handle: Buffer): string
        interactFixture(handle: Buffer, input: string): void
      }
      const window = BrowserWindow.getAllWindows()[0]!
      const handle = window.getNativeWindowHandle()
      if (request.action === 'resize') window.setBounds({ width: request.width, height: 720 })
      if (request.action === 'divider' || request.action === 'layout-divider')
        binding.interactFixture(
          handle,
          JSON.stringify({ id: 'native-workspace', action: request.action, value: request.width })
        )
      const state = JSON.parse(binding.inspect(handle)) as {
        root: { widthEvents: number }
        toolbar: { sidebarDivider: number }
      }
      return { divider: state.toolbar.sidebarDivider, widthEvents: state.root.widthEvents }
    },
    { action, width }
  )
}

for (const scrollers of ['Automatic', 'Always']) {
  test(`native sidebar restores its preference across repeated resizes (${scrollers})`, async () => {
    const profile = await mkdtemp(join(tmpdir(), 'therss-native-sidebar-'))
    const application = await electron.launch({
      args: [`--user-data-dir=${profile}`, '.', '-AppleShowScrollBars', scrollers],
      env: { ...env, THERSS_E2E_FIXTURES: '1', THERSS_UI: 'appkit' }
    })
    try {
      const page = await application.firstWindow()
      await page.waitForLoadState()
      await expect
        .poll(async () => {
          try {
            return (await sidebar(application, 'inspect')).divider
          } catch (error) {
            if (!String(error).includes('detached')) throw error
            return 0
          }
        })
        .toBeGreaterThan(0)
      await sidebar(application, 'resize', 1360)
      await sidebar(application, 'divider', 248)
      await expect.poll(async () => (await sidebar(application, 'inspect')).divider).toBe(248)
      // The presenter debounces the user preference write; await it before testing preservation.
      await expect
        .poll(
          async () => JSON.parse(await readFile(join(profile, 'native-ui.json'), 'utf8')).sidebar
        )
        .toBe(248)
      const { widthEvents } = await sidebar(application, 'inspect')
      for (let cycle = 0; cycle < 3; cycle++) {
        await sidebar(application, 'resize', 820)
        await expect
          .poll(async () => (await sidebar(application, 'inspect')).divider)
          .toBeLessThanOrEqual(193)
        await sidebar(application, 'resize', 1360)
        await expect.poll(async () => (await sidebar(application, 'inspect')).divider).toBe(248)
        expect((await sidebar(application, 'inspect')).widthEvents).toBe(widthEvents)
        expect(JSON.parse(await readFile(join(profile, 'native-ui.json'), 'utf8')).sidebar).toBe(
          248
        )
      }
      // Replay a late automatic constraints pass without a user width event.
      await sidebar(application, 'layout-divider', 184)
      await expect.poll(async () => (await sidebar(application, 'inspect')).divider).toBe(248)
      expect((await sidebar(application, 'inspect')).widthEvents).toBe(widthEvents)
      expect(JSON.parse(await readFile(join(profile, 'native-ui.json'), 'utf8')).sidebar).toBe(248)
    } finally {
      await application.close()
    }
  })
}

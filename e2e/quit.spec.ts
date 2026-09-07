import { mkdtemp } from 'node:fs/promises'
import { tmpdir, release } from 'node:os'
import { join } from 'node:path'
import { env, platform } from 'node:process'
import { _electron as electron, expect, test } from '@playwright/test'

for (const ui of ['appkit', 'web'] as const) {
  test(`${ui} normal quit terminates the application process after draining`, async () => {
    test.skip(ui === 'appkit' && (platform !== 'darwin' || Number.parseInt(release(), 10) < 25))
    const profile = await mkdtemp(join(tmpdir(), 'therss-quit-e2e-'))
    const application = await electron.launch({
      args: [`--user-data-dir=${profile}`, '.'],
      env: { ...env, THERSS_E2E_FIXTURES: '1', THERSS_UI: ui }
    })
    const child = application.process()
    try {
      await application.firstWindow()
      await expect
        .poll(() =>
          application.evaluate(({ Menu }) =>
            Boolean(Menu.getApplicationMenu()?.items.some((item) => item.label === 'Signal'))
          )
        )
        .toBe(true)
      await application.evaluate(({ app, BrowserWindow }, mode) => {
        if (mode === 'appkit') {
          const { createRequire } = process.getBuiltinModule('node:module')
          const bridge = createRequire(app.getAppPath() + '/package.json')(
            app.getAppPath() + '/out/native-appkit/therss-ui.node'
          )
          bridge.interactFixture(
            BrowserWindow.getAllWindows()[0]!.getNativeWindowHandle(),
            JSON.stringify({ action: 'quit' })
          )
        } else setImmediate(() => app.quit())
      }, ui)
      await expect.poll(() => child.exitCode ?? child.signalCode, { timeout: 5_000 }).toBe(0)
    } finally {
      if (child.exitCode === null && child.signalCode === null) await application.close()
    }
  })
}

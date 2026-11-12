// Repeats the native smoke's Daily Papers group steps in fixture mode with an isolated profile.
// Usage: node <this file> <project root> <runs>
import { mkdtemp } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
const project = process.argv[2]
const runs = Number(process.argv[3] ?? 3)
const { _electron: electron } = createRequire(join(project, 'package.json'))('@playwright/test')
const find = (n, id) =>
  !n ? null : n.id === id ? n : (n.children || []).map((c) => find(c, id)).find(Boolean) || null
let failures = 0
for (let run = 0; run < runs; run++) {
  const profile = await mkdtemp(join(tmpdir(), 'therss-daily-back-'))
  const app = await electron.launch({
    args: [`--user-data-dir=${profile}`, project],
    env: {
      ...process.env,
      THERSS_E2E_FIXTURES: '1',
      THERSS_E2E_LOCALE: 'en-US',
      THERSS_UI: 'appkit'
    },
    timeout: 30000
  })
  try {
    await (await app.firstWindow()).waitForLoadState()
    await app.evaluate(({ app: a, BrowserWindow, shell }) => {
      const { createRequire } = process.getBuiltinModule('node:module')
      globalThis.__b = createRequire(a.getAppPath() + '/package.json')(
        a.getAppPath() + '/out/native-appkit/therss-ui.node'
      )
      globalThis.__w = BrowserWindow.getAllWindows()[0]
      shell.openExternal = async () => {}
    })
    const inspect = () =>
      app.evaluate(() => JSON.parse(globalThis.__b.inspect(globalThis.__w.getNativeWindowHandle())))
    const act = (id, action, value) =>
      app.evaluate(
        (_, d) =>
          globalThis.__b.interactFixture(globalThis.__w.getNativeWindowHandle(), JSON.stringify(d)),
        { id, action, ...(value !== undefined ? { value } : {}) }
      )
    const wait = async (id, pred = (n) => !!n) => {
      let s
      for (let i = 0; i < 150; i++) {
        s = await inspect().catch(() => null)
        const n = s && find(s.root, id)
        if (pred(n)) return s
        await delay(100)
      }
      throw new Error(`state ${id}: ${JSON.stringify(s && find(s.root, id))?.slice(0, 300)}`)
    }
    await wait('discover-query', (n) => n?.enabled === true)
    await act('discover-query', 'fill', 'Fixture unsent daily paper query')
    await wait('discover-daily-papers', (n) => n?.enabled !== false)
    await act('discover-daily-papers', 'click')
    await wait('daily-papers-status', (n) => n?.text?.includes('2 selected'))
    await act('daily-papers-refresh', 'click')
    await wait('daily-papers-refresh', (n) => n?.enabled === true)
    await act('daily-papers-back', 'click')
    await wait('discover-query', (n) => n?.value === 'Fixture unsent daily paper query')
    process.stdout.write(`run ${run}: PASS` + '\n')
  } catch (error) {
    failures++
    process.stdout.write(`run ${run}: FAIL ${String(error.message).slice(0, 400)}` + '\n')
  } finally {
    await app.close().catch(() => {})
  }
}
process.exit(failures ? 1 : 0)

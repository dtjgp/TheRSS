/** Real AppKit text layout, IME, appearance and keyboard checks in a disposable window. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { _electron as electron } from '@playwright/test'

const output = resolve(process.env.THERSS_NATIVE_EVIDENCE_DIR || 'test-results/appkit-controls')
await mkdir(output, { recursive: true })
const profile = await mkdtemp(join(tmpdir(), 'therss-appkit-controls-'))
const application = await electron.launch({
  args: [`--user-data-dir=${profile}`, '.'],
  env: { ...process.env, THERSS_E2E_FIXTURES: '1', THERSS_UI: 'appkit' }
})
const checks = []
const find = (node, id) =>
  node?.id === id ? node : node?.children?.map((child) => find(child, id)).find(Boolean)
const act = (id, action, value, extra = {}) =>
  application.evaluate(
    (_, data) =>
      globalThis.__controls.bridge.interactFixture(
        globalThis.__controls.handle,
        JSON.stringify(data)
      ),
    { id, action, value, ...extra }
  )
const inspect = () =>
  application.evaluate(() =>
    JSON.parse(globalThis.__controls.bridge.inspect(globalThis.__controls.handle))
  )
try {
  await application.firstWindow()
  await application.evaluate(async ({ app, BrowserWindow }) => {
    const window = new BrowserWindow({
      width: 1000,
      height: 760,
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
    })
    await window.loadURL(
      "data:text/html,<meta http-equiv='Content-Security-Policy' content=\"default-src 'none'\">"
    )
    const bridge = process
      .getBuiltinModule('node:module')
      .createRequire(app.getAppPath() + '/package.json')(
      app.getAppPath() + '/out/native-appkit/therss-ui.node'
    )
    const handle = window.getNativeWindowHandle()
    const events = []
    bridge.attach(
      handle,
      (event) => events.push(JSON.parse(event)),
      () => {}
    )
    const scene = {
      version: 1,
      zoom: 1,
      root: {
        id: 'fixture-root',
        kind: 'column',
        gap: 12,
        padding: 20,
        children: [
          {
            id: 'fixture-glass',
            kind: 'column',
            glass: true,
            padding: 12,
            children: [
              { id: 'fixture-title', kind: 'label', text: 'AppKit 原生控件验收', weight: 'title' }
            ]
          },
          {
            id: 'fixture-input',
            kind: 'input',
            multiline: true,
            title: 'Composition',
            value: '',
            maxLength: 2000,
            action: 'input'
          },
          {
            id: 'fixture-text',
            kind: 'text',
            text: '# Complete analysis\n\nA **bold** result and *emphasis*.\n\n| Method | Score | Evidence |\n| :--- | ---: | :---: |\n| Baseline | 89.2 | Measured |\n| 边缘 AI | 90.4 | 单元格保留完整文本 |\n\n- Limits remain explicit.\n\n```python\nvalue = 1 | 2\n```'
          }
        ]
      }
    }
    globalThis.__controls = {
      window,
      bridge,
      handle,
      events,
      scene,
      originalText: scene.root.children[2].text
    }
    bridge.present(handle, JSON.stringify(scene))
    window.show()
    window.focus()
    app.focus({ steal: true })
  })
  let state = await inspect()
  const content = find(state.root, 'fixture-text')
  assert.equal(
    content.tableCells?.length,
    9,
    'Markdown must have nine native NSTextTableBlock cells'
  )
  assert.match(content.text, /单元格保留完整文本/)
  assert(!content.text.includes('---:'))
  assert.match(content.text, /value = 1 \| 2/)
  assert(content.styledRuns?.some((run) => run.bold && run.text === 'bold'))
  assert(content.styledRuns?.some((run) => run.italic && run.text === 'emphasis'))
  checks.push('Native table cells, complete Unicode content, code and inline styles')
  const malformed =
    '| A | B |\n| --- | --- |\n|' + 'wide|'.repeat(40) + '\n' + '| x | y |\n'.repeat(5)
  await application.evaluate((_, text) => {
    const fixture = globalThis.__controls
    fixture.scene.root.children[2].text = text
    fixture.bridge.present(fixture.handle, JSON.stringify(fixture.scene))
  }, malformed)
  state = await inspect()
  assert.equal(
    find(state.root, 'fixture-text').tableCells.length,
    0,
    'Ragged tables must not multiply cell allocations'
  )
  assert(find(state.root, 'fixture-text').text.includes('wide|'.repeat(40)))
  checks.push('Ragged Markdown table preserves text without cell-allocation amplification')
  const oversized = '| A | B |\n| --- | --- |\n' + '| value | evidence |\n'.repeat(2100)
  await application.evaluate((_, text) => {
    const fixture = globalThis.__controls
    fixture.scene.root.children[2].text = text
    fixture.bridge.present(fixture.handle, JSON.stringify(fixture.scene))
  }, oversized)
  state = await inspect()
  assert.equal(find(state.root, 'fixture-text').tableCells.length, 0)
  assert.equal(find(state.root, 'fixture-text').text.match(/evidence/g).length, 2100)
  await application.evaluate(() => {
    const fixture = globalThis.__controls
    fixture.scene.root.children[2].text = fixture.originalText
    fixture.bridge.present(fixture.handle, JSON.stringify(fixture.scene))
  })
  checks.push('Whole-document cell budget falls back to complete literal text')
  await act('fixture-input', 'mark', '边缘')
  state = await inspect()
  assert.equal(find(state.root, 'fixture-input').marked, true)
  assert.equal(
    (await application.evaluate(() => globalThis.__controls.events)).at(-1)?.value,
    '边缘'
  )
  await application.evaluate(() => {
    const fixture = globalThis.__controls
    fixture.scene.root.children[0].children[0].text = 'Async refresh during composition'
    fixture.bridge.present(fixture.handle, JSON.stringify(fixture.scene))
  })
  state = await inspect()
  assert.equal(find(state.root, 'fixture-input').marked, true)
  assert.equal(find(state.root, 'fixture-input').value, '边缘')
  await act('fixture-input', 'type', '边缘计算 🔬')
  state = await inspect()
  assert.equal(find(state.root, 'fixture-input').marked, false)
  assert.equal(find(state.root, 'fixture-input').value, '边缘计算 🔬')
  assert.equal(
    (await application.evaluate(() => globalThis.__controls.events)).at(-1)?.value,
    '边缘计算 🔬'
  )
  checks.push('Real marked-text composition survives asynchronous presentation and commits intact')
  await act('fixture-root', 'appearance', 'contrast-dark')
  state = await inspect()
  // macOS26 normalizes accessibility appearance names to Aqua/DarkAqua. Check
  // the explicit accessibility branch as well as inherited native appearance.
  assert.match(find(state.root, 'fixture-title').appearance, /DarkAqua/)
  assert.equal(find(state.root, 'fixture-glass').material, 'opaque')
  await act('fixture-root', 'appearance', 'contrast-light')
  state = await inspect()
  assert(
    ['NSAppearanceNameAqua', 'NSAppearanceNameAccessibilityAqua'].includes(
      find(state.root, 'fixture-title').appearance
    )
  )
  assert.equal(find(state.root, 'fixture-glass').material, 'opaque')
  await act('fixture-root', 'appearance', 'light')
  await act('fixture-root', 'transparency', false)
  state = await inspect()
  assert.equal(find(state.root, 'fixture-glass').material, 'opaque')
  await act('fixture-root', 'transparency', true)
  state = await inspect()
  assert.equal(find(state.root, 'fixture-glass').material, 'glass')
  checks.push('Native high-contrast appearances and reduced-transparency fallback')
  await act('fixture-root', 'appearance', 'light')
  await application.evaluate(({ app }) => {
    app.focus({ steal: true })
    globalThis.__controls.window.focus()
  })
  await delay(150)
  state = await inspect()
  if (process.env.THERSS_NATIVE_SCREENSHOTS !== '0')
    execFileSync('/usr/sbin/screencapture', [
      '-x',
      `-l${state.windowNumber}`,
      join(output, 'native-controls.png')
    ])
  await writeFile(
    join(output, 'result.json'),
    JSON.stringify(
      { passed: true, screenshots: process.env.THERSS_NATIVE_SCREENSHOTS !== '0', checks, state },
      null,
      2
    )
  )
  process.stdout.write(`Native AppKit component acceptance passed: ${checks.length} groups.\n`)
} catch (error) {
  await writeFile(
    join(output, 'result.json'),
    JSON.stringify({ passed: false, checks, error: String(error), state: await inspect() }, null, 2)
  )
  throw error
} finally {
  await application.close()
}

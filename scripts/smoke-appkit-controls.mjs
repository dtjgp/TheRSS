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
  await application.evaluate(() => {
    const fixture = globalThis.__controls
    fixture.scene.root.children.push(
      {
        id: 'fixture-chart',
        kind: 'chart',
        title: 'Fixture activity',
        text: 'test records',
        height: 120,
        points: [
          { date: '2026-09-04', value: 0 },
          { date: '2026-09-05', value: 10 },
          { date: '2026-09-06', value: 20 }
        ]
      },
      {
        id: 'fixture-compact-label',
        kind: 'label',
        text: 'A long search question '.repeat(40),
        maxLines: 2
      }
    )
    fixture.window.setBounds({ width: 1000, height: 940 })
    fixture.bridge.present(fixture.handle, JSON.stringify(fixture.scene))
  })
  state = await inspect()
  const chart = find(state.root, 'fixture-chart')
  const frameNumbers = (frame) => frame.match(/-?\d+(?:\.\d+)?/gu).map(Number)
  const heights = chart.bars.map((bar) => frameNumbers(bar.frame)[3])
  assert.equal(heights[0], 0)
  assert(heights[2] > 0)
  assert(Math.abs(heights[1] * 2 - heights[2]) < 0.001)
  assert.match(chart.accessibleValues, /2026-09-05: 10 test records/)
  assert(frameNumbers(find(state.root, 'fixture-compact-label').frame)[3] <= 40)
  assert.equal(find(state.root, 'fixture-compact-label').text, 'A long search question '.repeat(40))
  checks.push(
    'Native chart has a zero baseline and proportional bars; compact labels retain complete accessible text'
  )
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
  await application.evaluate(() => {
    const f = globalThis.__controls
    f.scene.root = {
      id: 'large-table-root',
      kind: 'column',
      padding: 20,
      children: [
        {
          id: 'large-native-table',
          kind: 'table',
          flex: 1,
          selected: 'record-999',
          columns: [
            { id: 'date', title: 'Date', width: 120 },
            { id: 'records', title: 'Records', width: 100, alignment: 'right' }
          ],
          rows: Array.from({ length: 1000 }, (_, i) => ({
            id: `record-${i}`,
            title: `Fixture day ${i}`,
            cells: { date: `Fixture ${i}`, records: String(i) }
          }))
        }
      ]
    }
    f.window.setBounds({ width: 1000, height: 760 })
    f.bridge.present(f.handle, JSON.stringify(f.scene))
  })
  await delay(100)
  state = await inspect()
  const largeTable = find(state.root, 'large-native-table')
  assert.equal(largeTable.rows.length, 1000)
  assert.equal(largeTable.rowHeight, 26)
  assert.equal(largeTable.selected, 'record-999')
  assert.notEqual(
    largeTable.scrollOrigin,
    '{0, 0}',
    'A programmatically opened distant record must be scrolled into view'
  )
  assert.equal(largeTable.rows.at(-1).cells.records, '999')
  assert(
    frameNumbers(largeTable.documentFrame)[2] <= frameNumbers(largeTable.viewportSize)[0] + 1,
    'Columns that fit must not be pushed beyond the viewport by research-list insets'
  )
  for (const cell of largeTable.selectedCells) {
    const text = frameNumbers(cell.textFrame),
      frame = frameNumbers(cell.cellFrame)
    assert(
      text[0] >= 0 && text[0] + text[2] <= frame[2] + 1,
      `${cell.column} text must fit inside its visible cell`
    )
    assert(cell.text.length > 0)
  }
  assert.deepEqual(
    largeTable.columns.map((column) => column.title),
    ['Date', 'Records']
  )
  await application.evaluate(() => {
    const f = globalThis.__controls
    f.scene.root.children[0].rows = f.scene.root.children[0].rows.map((row) => ({
      ...row,
      title: row.title + ' refreshed'
    }))
    f.bridge.present(f.handle, JSON.stringify(f.scene))
  })
  const refreshedTable = find((await inspect()).root, 'large-native-table')
  assert.equal(
    refreshedTable.scrollOrigin,
    largeTable.scrollOrigin,
    'Refreshing row content must retain the existing scroll position'
  )
  if (process.env.THERSS_NATIVE_SCREENSHOTS !== '0')
    execFileSync('/usr/sbin/screencapture', [
      '-x',
      `-l${state.windowNumber}`,
      join(output, 'native-data-table.png')
    ])
  checks.push(
    'Native numeric columns retain 1000 exact rows, reveal the selected record and preserve scroll on refresh'
  )
  await application.evaluate(() => {
    const f = globalThis.__controls
    f.scene.root = {
      id: 'retained-workspace',
      kind: 'split',
      compactPane: 'list',
      width: 320,
      children: [
        {
          id: 'retained-list',
          kind: 'table',
          selected: 'paper-900',
          rows: Array.from({ length: 1000 }, (_, i) => ({
            id: `paper-${i}`,
            title: `Research fixture ${i}`,
            subtitle: 'Deterministic long-list fixture'
          }))
        },
        {
          id: 'retained-reader',
          kind: 'scroll',
          children: [
            {
              id: 'retained-text',
              kind: 'text',
              text: 'A complete retained reading paragraph.\n\n'.repeat(200)
            }
          ]
        }
      ]
    }
    f.scene.focus = 'retained-list'
    f.bridge.present(f.handle, JSON.stringify(f.scene))
  })
  const listBefore = find((await inspect()).root, 'retained-list')
  assert.notEqual(listBefore.scrollOrigin, '{0, 0}')
  await application.evaluate(() => {
    const f = globalThis.__controls
    f.scene.root.compactPane = 'detail'
    f.scene.focus = 'retained-text'
    f.bridge.present(f.handle, JSON.stringify(f.scene))
  })
  await act('retained-reader', 'scroll', 400)
  const readingBefore = find((await inspect()).root, 'retained-reader').scrollOrigin
  assert.notEqual(readingBefore, '{0, 0}')
  await application.evaluate(() => {
    const f = globalThis.__controls
    f.scene.root.compactPane = 'list'
    f.scene.focus = 'retained-list'
    f.bridge.present(f.handle, JSON.stringify(f.scene))
  })
  const listAfter = find((await inspect()).root, 'retained-list')
  assert.equal(listAfter.scrollOrigin, listBefore.scrollOrigin)
  assert.equal(listAfter.selected, 'paper-900')
  await application.evaluate(() => {
    const f = globalThis.__controls
    f.scene.root.compactPane = 'detail'
    f.scene.focus = 'retained-text'
    f.bridge.present(f.handle, JSON.stringify(f.scene))
  })
  assert.equal(find((await inspect()).root, 'retained-reader').scrollOrigin, readingBefore)
  checks.push(
    'Compact research navigation preserves a thousand-row list position and independent long-reading position'
  )
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

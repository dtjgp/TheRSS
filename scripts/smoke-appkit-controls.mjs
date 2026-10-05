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
      id: 'layout-root',
      kind: 'column',
      padding: 20,
      children: [
        {
          id: 'layout-status-row',
          kind: 'row',
          children: [
            {
              id: 'layout-kind',
              kind: 'select',
              title: 'Result kind',
              selected: 'all',
              options: [{ id: 'all', title: 'All (100)' }],
              width: 210
            },
            { id: 'layout-status', kind: 'label', text: 'Partial results', flex: 1 },
            { id: 'layout-details', kind: 'button', title: 'Search details' }
          ]
        },
        {
          id: 'layout-actions',
          kind: 'column',
          children: [
            { id: 'layout-standard', kind: 'button', title: 'Open Settings' },
            {
              id: 'layout-navigation',
              kind: 'button',
              title: 'Discover',
              emphasis: 'navigation',
              checked: true
            }
          ]
        },
        {
          id: 'layout-research-list',
          kind: 'table',
          title: 'Research list',
          width: 300,
          minHeight: 160,
          rows: [
            {
              id: 'long',
              title:
                'Energy-Aware Compression-Computation Co-Adaptation for Latency Minimization in Multi-User Semantic Communication',
              subtitle: 'arXiv · 2026-08-13'
            }
          ]
        }
      ]
    }
    f.window.setBounds({ width: 1000, height: 760 })
    f.bridge.present(f.handle, JSON.stringify(f.scene))
  })
  await delay(100)
  state = await inspect()
  const center = (node) => {
    const [, y, , height] = frameNumbers(node.frame)
    return y + height / 2
  }
  // A label draws from the top of its frame, so centering requires a text-height frame.
  assert(
    frameNumbers(find(state.root, 'layout-status').frame)[3] <
      frameNumbers(find(state.root, 'layout-kind').frame)[3],
    'A row label frame must fit its text rather than fill the row'
  )
  assert(
    Math.abs(center(find(state.root, 'layout-status')) - center(find(state.root, 'layout-kind'))) <=
      1,
    'A row label must share the vertical center of its adjacent controls'
  )
  const columnWidth = frameNumbers(find(state.root, 'layout-actions').frame)[2]
  const standardWidth = frameNumbers(find(state.root, 'layout-standard').frame)[2]
  assert(standardWidth < columnWidth / 2, 'A column push button keeps its intrinsic width')
  assert.equal(frameNumbers(find(state.root, 'layout-standard').frame)[0], 0)
  assert.equal(frameNumbers(find(state.root, 'layout-navigation').frame)[2], columnWidth)
  const researchList = find(state.root, 'layout-research-list')
  assert.equal(researchList.titleLines, 2)
  assert.equal(researchList.titleTruncates, true, 'A clipped research title ends with an ellipsis')
  checks.push(
    'Native rows center labels, column buttons keep intrinsic width and clipped titles show an ellipsis'
  )
  await application.evaluate(() => {
    const f = globalThis.__controls
    f.scene.root = {
      id: 'progress-root',
      kind: 'column',
      padding: 20,
      children: [
        {
          id: 'progress-determinate',
          kind: 'progress',
          title: 'Source search progress',
          completed: 3,
          total: 22
        },
        { id: 'progress-indeterminate', kind: 'progress', title: 'Planning progress' }
      ]
    }
    f.bridge.present(f.handle, JSON.stringify(f.scene))
  })
  state = await inspect()
  const determinate = find(state.root, 'progress-determinate')
  assert.equal(determinate.class, 'NSProgressIndicator')
  assert.equal(determinate.indeterminate, false)
  assert.equal(determinate.progressValue, 3)
  assert.equal(determinate.progressMaximum, 22)
  assert.equal(determinate.accessibleValue, '3 of 22')
  assert.equal(determinate.label, 'Source search progress')
  const indeterminate = find(state.root, 'progress-indeterminate')
  assert.equal(indeterminate.class, 'NSProgressIndicator')
  assert.equal(indeterminate.indeterminate, true)
  assert(frameNumbers(indeterminate.frame)[3] <= 24, 'A progress bar keeps a compact height')
  checks.push('Native progress renders as determinate and indeterminate NSProgressIndicator bars')
  await application.evaluate(() => {
    const f = globalThis.__controls
    f.scene.root = {
      id: 'segmented-root',
      kind: 'column',
      padding: 20,
      children: [
        {
          id: 'segmented-row',
          kind: 'row',
          children: [
            {
              id: 'segmented-kind',
              kind: 'segmented',
              title: 'Result kind',
              selected: 'all',
              action: 'segmented-choose',
              options: [
                { id: 'all', title: 'All (3)' },
                { id: 'paper', title: 'Papers (1)' },
                { id: 'repository', title: 'Repositories (2)' },
                { id: 'other', title: 'Other (0)', enabled: false }
              ]
            },
            { id: 'segmented-status', kind: 'label', text: 'Complete', flex: 1 }
          ]
        }
      ]
    }
    f.events.length = 0
    f.bridge.present(f.handle, JSON.stringify(f.scene))
  })
  state = await inspect()
  let segmented = find(state.root, 'segmented-kind')
  assert.equal(segmented.class, 'NSSegmentedControl')
  assert.equal(segmented.label, 'Result kind')
  assert.deepEqual(
    segmented.segments.map((segment) => segment.label),
    ['All (3)', 'Papers (1)', 'Repositories (2)', 'Other (0)']
  )
  assert.equal(segmented.selected, 'all')
  assert.equal(segmented.segments[3].enabled, false)
  const segmentFrame = frameNumbers(segmented.frame)
  assert(
    segmentFrame[2] >= segmented.intrinsicWidth,
    'The row gives the segments their intrinsic width without clipping a count'
  )
  assert(segmentFrame[3] <= 32, 'Segments keep their natural height in the row')
  await act('segmented-kind', 'choose', 'repository')
  let segmentEvents = await application.evaluate(() => globalThis.__controls.events)
  assert.deepEqual(segmentEvents.at(-1), { action: 'segmented-choose', value: 'repository' })
  await assert.rejects(act('segmented-kind', 'choose', 'other'), /disabled/u)
  const emitted = segmentEvents.length
  await application.evaluate(() => {
    const f = globalThis.__controls
    f.scene.root.children[0].children[0].selected = 'paper'
    f.bridge.present(f.handle, JSON.stringify(f.scene))
  })
  segmented = find((await inspect()).root, 'segmented-kind')
  assert.equal(segmented.selected, 'paper')
  segmentEvents = await application.evaluate(() => globalThis.__controls.events)
  assert.equal(segmentEvents.length, emitted, 'A scene update does not emit a choice')
  checks.push('Native segmented control shows every choice, emits clicks and skips scene updates')
  await application.evaluate(() => {
    const f = globalThis.__controls
    f.scene.root = {
      id: 'share-root',
      kind: 'column',
      padding: 20,
      children: [
        {
          id: 'share-list',
          kind: 'table',
          title: 'Research list',
          minHeight: 160,
          rows: [
            {
              id: 'paper',
              title: 'Structured Pruning for Edge Inference',
              subtitle: 'arXiv · 2026-02-14',
              drag: {
                url: 'https://arxiv.org/abs/2501.00001v1',
                title: 'Structured Pruning for Edge Inference',
                text: 'Structured Pruning for Edge Inference. arXiv. 2026-02-14. https://arxiv.org/abs/2501.00001v1'
              }
            }
          ]
        },
        {
          id: 'plain-list',
          kind: 'table',
          title: 'Plain list',
          minHeight: 80,
          rows: [{ id: 'x', title: 'No link' }]
        },
        {
          id: 'share-button',
          kind: 'button',
          title: 'Share',
          symbol: 'square.and.arrow.up',
          share: { url: 'https://arxiv.org/abs/2501.00001v1' }
        }
      ]
    }
    f.events.length = 0
    f.bridge.present(f.handle, JSON.stringify(f.scene))
  })
  state = await inspect()
  const shareList = find(state.root, 'share-list')
  assert.deepEqual(shareList.dragItem, {
    url: 'https://arxiv.org/abs/2501.00001v1',
    title: 'Structured Pruning for Edge Inference',
    text: 'Structured Pruning for Edge Inference. arXiv. 2026-02-14. https://arxiv.org/abs/2501.00001v1'
  })
  assert.equal(shareList.dragOutside, true, 'Rows are copied, not moved, to other apps')
  assert.deepEqual(
    find(state.root, 'plain-list').dragItem,
    {},
    'A row without a link is not draggable'
  )
  await act('share-button', 'click')
  assert.equal(
    find((await inspect()).root, 'share-button').sharedURL,
    'https://arxiv.org/abs/2501.00001v1'
  )
  assert.equal(
    (await application.evaluate(() => globalThis.__controls.events)).length,
    0,
    'Share opens the system picker without a scene event'
  )
  checks.push(
    'Research rows drag a link, title and citation out; Share hands the link to the picker'
  )
  const emptyScene = (zoom) =>
    application.evaluate((_, data) => {
      const f = globalThis.__controls
      f.scene.root = {
        id: 'empty-root',
        kind: 'column',
        children: [
          {
            id: 'empty-state',
            kind: 'column',
            align: 'center',
            gap: 8,
            padding: 18,
            height: 600,
            children: [
              {
                id: 'empty-symbol',
                kind: 'symbol',
                symbol: 'star',
                title: 'No saved research',
                size: 40
              },
              {
                id: 'empty-title',
                kind: 'label',
                text: 'No saved research',
                weight: 'bold',
                size: 17,
                align: 'center',
                maxWidth: 420
              },
              {
                id: 'empty-message',
                kind: 'label',
                text: 'Save papers and repositories from Discover to build your local reading list.',
                weight: 'secondary',
                align: 'center',
                maxWidth: 420
              },
              {
                id: 'empty-actions',
                kind: 'row',
                children: [
                  { id: 'empty-open', kind: 'button', title: 'Open Discover', action: 'empty-open' }
                ]
              }
            ]
          }
        ]
      }
      f.bridge.present(f.handle, JSON.stringify({ ...f.scene, zoom: data }))
    }, zoom)
  for (const zoom of [1, 1.5]) {
    await emptyScene(zoom)
    const empty = find((await inspect()).root, 'empty-state')
    const [, , columnWidth, columnHeight] = frameNumbers(empty.frame)
    const frames = empty.children.map((child) => frameNumbers(child.frame))
    for (const [index, [x, , width]] of frames.entries())
      assert(
        Math.abs(x + width / 2 - columnWidth / 2) <= 1,
        `Child ${empty.children[index].id} is centered horizontally at zoom ${zoom}`
      )
    const top = frames[0][1],
      bottom = frames.at(-1)[1] + frames.at(-1)[3]
    assert(Math.abs((top + bottom) / 2 - columnHeight / 2) <= 2, `Stack centered at zoom ${zoom}`)
    assert(top >= 0 && bottom <= columnHeight, `Stack fits at zoom ${zoom}`)
    for (let index = 1; index < frames.length; index++)
      assert(
        frames[index][1] >= frames[index - 1][1] + frames[index - 1][3],
        'Stack parts do not overlap'
      )
    assert(frames[1][2] <= 420 * zoom + 1, 'The title keeps its maximum width')
    const symbol = find(empty, 'empty-symbol')
    assert.equal(symbol.class, 'NSImageView')
    assert.equal(symbol.hasImage, true)
    assert.equal(symbol.exposed, false, 'The decorative symbol is not a separate VoiceOver element')
    assert.equal(find(empty, 'empty-title').centered, true)
    assert.equal(find(empty, 'empty-message').centered, true)
  }
  await act('empty-open', 'click')
  assert.deepEqual((await application.evaluate(() => globalThis.__controls.events)).at(-1), {
    action: 'empty-open'
  })
  await emptyScene(1)
  checks.push(
    'Empty states center a decorative symbol, title, message and action at zoom 1 and 1.5'
  )
  await application.evaluate(() => {
    const f = globalThis.__controls
    f.scene.root = {
      id: 'glyph-root',
      kind: 'column',
      padding: 20,
      children: [
        {
          id: 'glyph-list',
          kind: 'table',
          title: 'Research list',
          width: 300,
          minHeight: 200,
          rows: [
            {
              id: 'saved-paper',
              title:
                'Energy-Aware Compression-Computation Co-Adaptation for Latency Minimization in Multi-User Semantic Communication',
              subtitle: 'arXiv · 2026-08-13',
              symbol: 'doc.text',
              symbolLabel: 'Paper',
              saved: true
            },
            {
              id: 'repository',
              title: 'TheRSS/semantic-fixture',
              subtitle: 'GitHub · 2026-08-13',
              symbol: 'chevron.left.forwardslash.chevron.right',
              symbolLabel: 'Repository'
            }
          ]
        }
      ]
    }
    f.bridge.present(f.handle, JSON.stringify(f.scene))
  })
  const glyphRows = async () => find((await inspect()).root, 'glyph-list').rowGlyphs
  let glyphs = await glyphRows()
  assert.deepEqual(
    glyphs.map((row) => [row.symbol, row.saved]),
    [
      ['doc.text', true],
      ['chevron.left.forwardslash.chevron.right', false]
    ]
  )
  for (const row of glyphs) {
    const [kindX, , kindWidth] = frameNumbers(row.kindFrame)
    const [titleX, , titleWidth] = frameNumbers(row.titleFrame)
    assert(titleX >= kindX + kindWidth, 'The title starts after the kind glyph')
    if (row.saved)
      assert(
        titleX + titleWidth <= frameNumbers(row.savedFrame)[0],
        'The title stays clear of the Saved star'
      )
  }
  assert.equal(
    glyphs[0].accessibilityLabel,
    'Energy-Aware Compression-Computation Co-Adaptation for Latency Minimization in Multi-User Semantic Communication. Paper. arXiv · 2026-08-13. Saved.'
  )
  assert.equal(
    glyphs[1].accessibilityLabel,
    'TheRSS/semantic-fixture. Repository. GitHub · 2026-08-13.'
  )
  assert.equal(find((await inspect()).root, 'glyph-list').titleTruncates, true)
  for (const appearance of ['light', 'dark']) {
    await act('glyph-list', 'appearance', appearance)
    const [saved] = await glyphRows()
    assert(
      saved.savedContrast >= 3,
      `Saved star on the list, ${appearance}: ${saved.savedContrast}`
    )
    assert(
      saved.savedSelectedContrast >= 3,
      `Saved star on an unfocused selection, ${appearance}: ${saved.savedSelectedContrast}`
    )
  }
  await act('glyph-list', 'appearance', 'contrast-light')
  glyphs = await glyphRows()
  assert.equal(glyphs[0].highContrast, true, 'A live Increase Contrast change reaches the glyphs')
  assert(glyphs[0].savedContrast >= 7, 'Increase Contrast draws the star in the label colour')
  await act('glyph-list', 'appearance', 'light')
  await act('glyph-list', 'select', 'saved-paper')
  await act('glyph-list', 'focus')
  const focusedList = await inspect()
  glyphs = find(focusedList.root, 'glyph-list').rowGlyphs
  assert(
    glyphs.every((row) => row.glyphsFollowSelection),
    'Glyphs follow the selection colour'
  )
  if (focusedList.keyWindow)
    assert.equal(glyphs[0].emphasized, true, 'A focused list draws an emphasized selection')
  checks.push('Research rows show kind glyphs, a readable Saved star and a complete spoken label')
  const popoverScene = (checked, focus) =>
    application.evaluate(
      (_, data) => {
        const f = globalThis.__controls
        f.scene.root = {
          id: 'popover-root',
          kind: 'column',
          padding: 20,
          children: [
            {
              id: 'popover-row',
              kind: 'row',
              children: [
                { id: 'pop-anchor', kind: 'button', title: 'Sources (3/22)', action: 'pop-toggle' }
              ]
            },
            { id: 'pop-below', kind: 'label', text: 'Content below the anchor stays in place' }
          ]
        }
        const popover = {
          anchor: 'pop-anchor',
          close: 'pop-close',
          root: {
            id: 'pop-content',
            kind: 'column',
            padding: 14,
            children: [
              {
                id: 'pop-find',
                kind: 'input',
                title: 'Find sources',
                value: '',
                action: 'pop-find-edit'
              },
              {
                id: 'pop-check',
                kind: 'check',
                title: 'arXiv',
                checked: data.checked,
                action: 'pop-check'
              }
            ]
          }
        }
        f.bridge.present(
          f.handle,
          JSON.stringify({
            ...f.scene,
            ...(data.checked === null ? {} : { popover }),
            ...(data.focus ? { focus: data.focus } : {})
          })
        )
      },
      { checked, focus }
    )
  const popoverEvents = () => application.evaluate(() => globalThis.__controls.events)
  await application.evaluate(() => {
    globalThis.__controls.events.length = 0
  })
  await popoverScene(false, 'pop-find')
  state = await inspect()
  assert(state.popover, 'The popover is shown')
  assert.equal(state.popover.anchor, 'pop-anchor')
  assert.equal(state.popover.behavior, 2, 'The popover is semi-transient')
  assert.equal(state.popover.below, true, 'The popover opens below its anchor')
  assert(find(state.root, 'pop-below'), 'Root content stays in the window, not the popover')
  assert(!find(state.root, 'pop-check'))
  assert.equal(state.popover.keyWindow, true, 'Scene focus makes the popover key')
  await act('pop-find', 'type', 'arx')
  assert.deepEqual((await popoverEvents()).at(-1), { action: 'pop-find-edit', value: 'arx' })
  await act('pop-check', 'click')
  assert.deepEqual((await popoverEvents()).at(-1), { action: 'pop-check', value: true })
  await popoverScene(true)
  state = await inspect()
  assert.equal(
    find(state.popover.root, 'pop-check').checked,
    true,
    'Scene updates reach the popover'
  )
  await popoverScene(null)
  state = await inspect()
  assert.equal(state.popover, null, 'A scene without a popover closes it')
  assert(
    !(await popoverEvents()).some((event) => event.action === 'pop-close'),
    'Programmatic closing emits nothing'
  )
  await popoverScene(false)
  await act('popover', 'dismiss-popover', 'anchor')
  assert.deepEqual((await popoverEvents()).at(-1), { action: 'pop-close' })
  assert.equal((await inspect()).popover, null)
  const beforeAnchor = (await popoverEvents()).length
  await act('pop-anchor', 'click')
  assert.equal(
    (await popoverEvents()).length,
    beforeAnchor,
    'The anchor click that dismissed the popover does not reopen it'
  )
  await act('pop-anchor', 'click')
  assert.deepEqual(
    (await popoverEvents()).at(-1),
    { action: 'pop-toggle' },
    'Only the dismissing click is ignored'
  )
  await popoverScene(false, 'pop-find')
  await act('pop-find', 'key', 'escape')
  assert.deepEqual((await popoverEvents()).at(-1), { action: 'pop-close' }, 'Escape dismisses')
  await act('pop-anchor', 'click')
  assert.deepEqual(
    (await popoverEvents()).at(-1),
    { action: 'pop-toggle' },
    'A quick click after Escape opens the popover again'
  )
  await application.evaluate(() => {
    const f = globalThis.__controls
    const checks = Array.from({ length: 40 }, (_, index) => ({
      id: `pop-tall-${index}`,
      kind: 'check',
      title: `Source ${index}`,
      checked: false,
      action: 'pop-tall'
    }))
    f.bridge.present(
      f.handle,
      JSON.stringify({
        ...f.scene,
        popover: {
          anchor: 'pop-anchor',
          close: 'pop-close',
          root: { id: 'pop-tall', kind: 'column', padding: 14, children: checks }
        }
      })
    )
  })
  const tall = (await inspect()).popover
  assert(tall.documentHeight > tall.visibleHeight, 'Tall popover content scrolls')
  const windowHeight = await application.evaluate(
    ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds().height
  )
  assert(tall.visibleHeight <= windowHeight - 120, 'The popover stays within the window cap')
  await act('pop-tall-39', 'click')
  assert.deepEqual((await popoverEvents()).at(-1), { action: 'pop-tall', value: true })
  await popoverScene(null)
  checks.push(
    'Native popover anchors below its button, takes focus and reports only user dismissal'
  )
  await application.evaluate(() => {
    const f = globalThis.__controls
    f.scene.root = {
      id: 'keyboard-root',
      kind: 'column',
      padding: 20,
      children: [
        {
          id: 'keyboard-question',
          kind: 'input',
          title: 'Research question',
          multiline: true,
          value: '',
          action: 'keyboard-question-edit'
        },
        {
          id: 'keyboard-search',
          kind: 'button',
          title: 'Search',
          shortcut: 'command-return',
          action: 'keyboard-search-action'
        },
        {
          id: 'keyboard-list',
          kind: 'table',
          title: 'Keyboard list',
          minHeight: 120,
          rows: [{ id: 'one', title: 'One', subtitle: 'Fixture' }]
        }
      ]
    }
    f.events.length = 0
    f.bridge.present(f.handle, JSON.stringify(f.scene))
  })
  await act('keyboard-list', 'focus')
  assert.equal(
    await application.evaluate(() =>
      globalThis.__controls.bridge.edit(globalThis.__controls.handle, 'undo')
    ),
    false,
    'Undo outside a text view is left to the application (triage undo)'
  )
  state = await inspect()
  assert.equal(find(state.root, 'keyboard-search').keyEquivalent, '\r')
  assert.equal(find(state.root, 'keyboard-search').keyModifiers, 'command')
  const searches = async () =>
    (await application.evaluate(() => globalThis.__controls.events)).filter(
      (event) => event.action === 'keyboard-search-action'
    ).length
  await act('keyboard-question', 'focus')
  await act('keyboard-question', 'key', 'enter')
  assert.equal(await searches(), 0, 'A plain Return in the question must not submit')
  assert.equal(find((await inspect()).root, 'keyboard-question').value, '\n')
  await act('keyboard-question', 'shortcut', 'command-return')
  assert.equal(await searches(), 1, 'Command-Return submits while the question is focused')
  await act('keyboard-question', 'focus')
  assert.equal(
    await application.evaluate(() =>
      globalThis.__controls.bridge.edit(globalThis.__controls.handle, 'undo')
    ),
    true,
    'Undo inside a text view stays with the text view'
  )
  checks.push(
    'Command-Return reaches its button from a focused text view; Undo outside text is not swallowed'
  )
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
  const searchItem = {
    id: 'local-search-query',
    kind: 'search',
    title: 'Search local research',
    placeholder: 'Search local research',
    symbol: 'magnifyingglass',
    value: '',
    action: 'search-text',
    activate: 'search-enter'
  }
  await application.evaluate((_, item) => {
    const f = globalThis.__controls
    f.scene.root = {
      id: 'search-root',
      kind: 'column',
      padding: 20,
      children: [
        { id: 'search-status', kind: 'label', text: 'Toolbar search fixture' },
        { id: 'search-note', kind: 'input', title: 'Note', value: '', action: 'search-note-edit' }
      ]
    }
    f.scene.toolbar = { title: 'Search', items: [item] }
    f.events.length = 0
    f.bridge.present(f.handle, JSON.stringify(f.scene))
  }, searchItem)
  const toolbarSearch = (current) =>
    current.toolbar?.items?.find((item) => item.id === 'local-search-query')
  const events = () => application.evaluate(() => globalThis.__controls.events)
  let field = toolbarSearch(await inspect())
  assert.equal(field?.kind, 'search')
  assert.equal(field.placeholder, 'Search local research')
  const instance = field.instance
  await act('local-search-query', 'fill', 'edge')
  assert.deepEqual((await events()).at(-1), { action: 'search-text', value: 'edge' })
  await act('local-search-query', 'mark', '边缘')
  assert.notEqual((await events()).at(-1)?.value, 'edge边缘', 'Marked IME text is not searched')
  await act('local-search-query', 'type', '边缘计算')
  assert.deepEqual((await events()).at(-1), { action: 'search-text', value: 'edge边缘计算' })
  await application.evaluate((_, item) => {
    const f = globalThis.__controls
    f.scene.toolbar = {
      title: 'Search',
      items: [
        { id: 'return-local-search', title: 'Back', symbol: 'chevron.backward', action: 'back' },
        { ...item, value: 'stale programmatic value' }
      ]
    }
    f.bridge.present(f.handle, JSON.stringify(f.scene))
  }, searchItem)
  field = toolbarSearch(await inspect())
  assert.equal(field.instance, instance, 'Adding a toolbar item keeps the same search field')
  assert.equal(field.value, 'edge边缘计算', 'An edited field is not overwritten by the scene')
  await act('local-search-query', 'key', 'enter')
  assert.equal((await events()).at(-1)?.action, 'search-enter')
  await act('search-status', 'focus')
  await application.evaluate(() => {
    const f = globalThis.__controls
    f.bridge.present(f.handle, JSON.stringify({ ...f.scene, focus: 'local-search-query' }))
  })
  assert.equal(toolbarSearch(await inspect()).editing, true, 'Scene focus reaches the search field')
  // A later scene that repeats the focus (results arriving) must not end the edit: ending it
  // used to send the field action with an empty editor and clear the query.
  await act('local-search-query', 'fill', 'pruning')
  const typed = (await events()).length
  await application.evaluate(() => {
    const f = globalThis.__controls
    f.bridge.present(f.handle, JSON.stringify({ ...f.scene, focus: 'local-search-query' }))
  })
  field = toolbarSearch(await inspect())
  assert.equal(field.editing, true, 'Repeated scene focus keeps the edit')
  assert.equal(field.value, 'pruning')
  assert.equal((await events()).length, typed, 'Repeated scene focus emits nothing')
  await act('search-note', 'focus')
  assert(
    !(await events()).slice(typed).some((event) => event.action === 'search-text'),
    'Moving focus out of the search field does not clear the query'
  )
  assert.equal(toolbarSearch(await inspect()).value, 'pruning')
  await application.evaluate(() => {
    const f = globalThis.__controls
    delete f.scene.toolbar
  })
  checks.push(
    'Toolbar search emits committed text and Return, skips IME marking and survives item changes'
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

import { describe, expect, it, vi } from 'vitest'
import { NativePresentation, type NativeNode, type NativeToolbar } from './presentation'
import { Controls } from './common'
import { nativeHarness } from './testSupport'

describe('native presentation boundary', () => {
  it('bounds chart dates and nonnegative counts before native drawing', () => {
    const view = new NativePresentation()
    const chart: NativeNode = {
      id: 'trend',
      kind: 'chart',
      points: [{ date: '2026-09-06', value: 0 }]
    }
    expect(JSON.parse(view.finish(chart)).root.points).toEqual(chart.points)
    expect(() => view.finish({ ...chart, points: [{ date: '2026-09-06', value: -1 }] })).toThrow()
    expect(() => view.finish({ ...chart, points: [{ date: 'invalid', value: 2 }] })).toThrow()
    expect(() =>
      view.finish({ ...chart, points: Array.from({ length: 91 }, () => chart.points![0]!) })
    ).toThrow()
    expect(() => view.finish({ id: 'label', kind: 'label', maxLines: 0 })).toThrow()
  })
  it('accepts bounded native visual roles and rejects arbitrary styling or symbol paths', () => {
    const view = new NativePresentation()
    const node = {
      id: 'search',
      kind: 'button',
      title: 'Search',
      emphasis: 'primary',
      symbol: 'magnifyingglass',
      surface: 'panel'
    } as NativeNode
    expect(JSON.parse(view.finish(node)).root).toMatchObject(node)
    expect(() =>
      view.finish({ ...node, emphasis: 'remote-style' } as unknown as NativeNode)
    ).toThrow()
    expect(() =>
      view.finish({ ...node, symbol: 'https://example.com/icon' } as unknown as NativeNode)
    ).toThrow()
    expect(() =>
      view.finish({ ...node, surface: 'arbitrary-css' } as unknown as NativeNode)
    ).toThrow()
  })
  it('validates the window toolbar and source-list sidebar and binds only their live actions', async () => {
    const view = new NativePresentation(),
      toggled = vi.fn(),
      chosen = vi.fn()
    view.begin()
    const toolbar: NativeToolbar = {
      title: 'Discover',
      items: [
        {
          id: 'sidebar-toggle',
          title: 'Hide Sidebar',
          symbol: 'sidebar.left',
          action: view.action('toggle', toggled)
        }
      ]
    }
    const sidebar: NativeNode = {
      id: 'native-navigation',
      kind: 'sidebar',
      title: 'Workspaces',
      selected: 'discover',
      rows: [
        { id: 'discover', title: 'Discover', symbol: 'sparkle.magnifyingglass' },
        { id: 'saved', title: 'Saved', symbol: 'star' }
      ],
      action: view.action('navigate', chosen, { type: 'choice', values: ['discover', 'saved'] })
    }
    const scene = JSON.parse(view.finish(sidebar, undefined, undefined, 1, undefined, toolbar))
    expect(scene.toolbar).toEqual(toolbar)
    expect(scene.root.rows[1].symbol).toBe('star')
    await view.dispatch(JSON.stringify({ action: toolbar.items[0]!.action }))
    await view.dispatch(JSON.stringify({ action: sidebar.action, value: 'saved' }))
    expect(toggled).toHaveBeenCalledOnce()
    expect(chosen).toHaveBeenCalledWith('saved')
    expect(() =>
      view.finish(sidebar, undefined, undefined, 1, undefined, {
        ...toolbar,
        items: [{ ...toolbar.items[0]!, symbol: 'file:///icon' }]
      } as unknown as NativeToolbar)
    ).toThrow()
    expect(() =>
      view.finish({
        ...sidebar,
        rows: [{ id: 'x', title: 'X', symbol: 'https://example.com/icon' }]
      } as unknown as NativeNode)
    ).toThrow()
  })
  it('bounds native progress to integer completed-of-total values on progress nodes', () => {
    const view = new NativePresentation()
    const node: NativeNode = {
      id: 'run',
      kind: 'progress',
      title: 'Discover run progress',
      completed: 3,
      total: 22
    }
    expect(JSON.parse(view.finish(node)).root).toMatchObject(node)
    const indeterminate = { id: 'run', kind: 'progress', title: 'Planning' } as NativeNode
    expect(JSON.parse(view.finish(indeterminate)).root.total).toBeUndefined()
    for (const invalid of [
      { ...node, completed: 23 },
      { ...node, completed: 1.5 },
      { ...node, completed: 0, total: 0 },
      { ...node, total: undefined },
      { id: 'label', kind: 'label', completed: 1, total: 2 }
    ])
      expect(() => view.finish(invalid as NativeNode)).toThrow()
  })
  it('bounds segmented controls to 2-6 options with a listed selection', () => {
    const view = new NativePresentation()
    const options = [
      { id: 'all', title: 'All (3)' },
      { id: 'paper', title: 'Papers (1)' },
      { id: 'other', title: 'Other (0)', enabled: false }
    ]
    const node: NativeNode = {
      id: 'kind',
      kind: 'segmented',
      title: 'Result kind',
      selected: 'all',
      options
    }
    expect(JSON.parse(view.finish(node)).root).toMatchObject(node)
    const many = Array.from({ length: 7 }, (_, index) => ({ id: `o${index}`, title: `${index}` }))
    for (const invalid of [
      { ...node, options: options.slice(0, 1) },
      { ...node, options: many, selected: 'o0' },
      { ...node, selected: 'repository' },
      { ...node, selected: undefined },
      { id: 'label', kind: 'label', options }
    ])
      expect(() => view.finish(invalid as NativeNode)).toThrow()
  })
  it('anchors a popover to a root node with unique ids and keeps its actions live', async () => {
    const view = new NativePresentation()
    const received: string[] = []
    view.begin()
    const close = view.action('popover:close', () => {
      received.push('close')
    })
    const toggle = view.action('popover:toggle', () => {
      received.push('toggle')
    })
    const opener = view.action('popover:open', () => {
      received.push('root')
    })
    const root: NativeNode = {
      id: 'page',
      kind: 'column',
      children: [{ id: 'open', kind: 'button', title: 'Sources', action: opener }]
    }
    const content: NativeNode = {
      id: 'picker',
      kind: 'column',
      children: [{ id: 'all', kind: 'button', title: 'Select all', action: toggle }]
    }
    const scene = JSON.parse(
      view.finish(root, undefined, undefined, 1, undefined, undefined, {
        anchor: 'open',
        close,
        root: content
      })
    )
    expect(scene.popover).toMatchObject({ anchor: 'open', close, root: { id: 'picker' } })
    await view.dispatch(JSON.stringify({ action: toggle }))
    await view.dispatch(JSON.stringify({ action: close }))
    // The window stays interactive: root actions remain live while the popover is open.
    await view.dispatch(JSON.stringify({ action: opener }))
    expect(received).toEqual(['toggle', 'close', 'root'])
    for (const popover of [
      { anchor: 'missing', close, root: content },
      { anchor: 'open', close, root: { ...content, id: 'open' } },
      { anchor: 'open', close: '', root: content }
    ])
      expect(() =>
        view.finish(root, undefined, undefined, 1, undefined, undefined, popover)
      ).toThrow()
    const sheet: NativeNode = { id: 'sheet', kind: 'column', children: [] }
    expect(() =>
      view.finish(root, sheet, undefined, 1, undefined, undefined, {
        anchor: 'open',
        close,
        root: content
      })
    ).toThrow()
  })
  it('accepts kind glyphs, accessible kind names and the Saved marker on research rows', () => {
    const view = new NativePresentation()
    const table = {
      id: 'results',
      kind: 'table',
      title: 'Results',
      rows: [
        { id: 'a', title: 'A', symbol: 'doc.text', symbolLabel: 'Paper', saved: true },
        { id: 'b', title: 'B', symbol: 'chevron.left.forwardslash.chevron.right' }
      ]
    } as NativeNode
    expect(JSON.parse(view.finish(table)).root.rows[0]).toMatchObject({ saved: true })
    for (const row of [
      { id: 'a', title: 'A', saved: 'yes' },
      { id: 'a', title: 'A', symbolLabel: 'x'.repeat(41) },
      { id: 'a', title: 'A', symbol: 'flag' }
    ])
      expect(() => view.finish({ ...table, rows: [row] } as unknown as NativeNode)).toThrow()
  })
  it('accepts keyboard shortcuts on buttons only', () => {
    const view = new NativePresentation()
    const button = {
      id: 'go',
      kind: 'button',
      title: 'Search',
      shortcut: 'command-return'
    } as NativeNode
    expect(JSON.parse(view.finish(button)).root.shortcut).toBe('command-return')
    expect(() =>
      view.finish({ ...button, shortcut: 'command-q' } as unknown as NativeNode)
    ).toThrow()
    expect(() =>
      view.finish({ id: 'text', kind: 'label', text: 'x', shortcut: 'return' } as NativeNode)
    ).toThrow()
  })
  it('rejects queued input and selection changes after controls become disabled', async () => {
    const h = nativeHarness(),
      controls = new Controls(h.context),
      changed = vi.fn(),
      selected = vi.fn()
    h.context.presentation.begin()
    const input = controls.input('input', 'Input', 'original', changed, 80)
    const select = controls.select(
      'select',
      'Select',
      'a',
      [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' }
      ],
      selected
    )
    h.context.presentation.finish({ id: 'root', kind: 'column', children: [input, select] })
    h.context.presentation.begin()
    h.context.presentation.finish({
      id: 'root',
      kind: 'column',
      children: [
        controls.input('input', 'Input', 'original', changed, 80, { enabled: false }),
        controls.select(
          'select',
          'Select',
          'a',
          [
            { id: 'a', title: 'A' },
            { id: 'b', title: 'B' }
          ],
          selected,
          { enabled: false }
        )
      ]
    })
    await h.context.presentation.dispatch(
      JSON.stringify({ action: input.action, value: 'late edit' })
    )
    await h.context.presentation.dispatch(JSON.stringify({ action: select.action, value: 'b' }))
    expect(changed).not.toHaveBeenCalled()
    expect(selected).not.toHaveBeenCalled()
  })
  it('blocks background actions while a native sheet is visible and clears hidden secure drafts explicitly', async () => {
    const view = new NativePresentation(),
      background = vi.fn(),
      close = vi.fn()
    view.begin()
    const action = view.action('background', background)
    view.finish({ id: 'main', kind: 'button', action })
    view.begin()
    const current = view.action('background', background),
      modalAction = view.action('close', close)
    view.clearSecure('provider-key')
    const scene = JSON.parse(
      view.finish(
        { id: 'main', kind: 'button', action: current },
        { id: 'sheet', kind: 'button', action: modalAction }
      )
    )
    expect(scene.clearSecure).toEqual(['provider-key'])
    await view.dispatch(JSON.stringify({ action }))
    expect(background).not.toHaveBeenCalled()
    await view.dispatch(JSON.stringify({ action: modalAction }))
    expect(close).toHaveBeenCalledOnce()
  })
  it('rejects actions from controls or records that have left the scene', async () => {
    const view = new NativePresentation()
    const first = vi.fn()
    const second = vi.fn()
    view.begin()
    const action = view.action('save:paper-1', first)
    view.finish({ id: 'root', kind: 'button', title: 'Save', action })
    view.begin()
    const next = view.action('save:paper-2', second)
    view.finish({ id: 'root', kind: 'button', title: 'Save', action: next })
    await view.dispatch(JSON.stringify({ action }))
    expect(first).not.toHaveBeenCalled()
    expect(second).not.toHaveBeenCalled()
    await view.dispatch(JSON.stringify({ action: next }))
    expect(second).toHaveBeenCalledOnce()
  })

  it('keeps a live text action stable across unrelated async renders', async () => {
    const view = new NativePresentation()
    const receive = vi.fn()
    view.begin()
    const before = view.action('query', receive, { type: 'text', max: 2000 })
    view.finish({ id: 'query', kind: 'input', action: before })
    view.begin()
    const after = view.action('query', receive, { type: 'text', max: 2000 })
    view.finish({ id: 'query', kind: 'input', action: after })
    expect(after).toBe(before)
    await view.dispatch(JSON.stringify({ action: before, value: '边缘计算 🔬' }))
    expect(receive).toHaveBeenCalledWith('边缘计算 🔬')
    await view.dispatch(JSON.stringify({ action: before, value: 'x'.repeat(2001) }))
    expect(receive).toHaveBeenCalledTimes(1)
  })

  it('separates secure input from scenes and ordinary event dispatch', async () => {
    const view = new NativePresentation()
    const receive = vi.fn()
    view.begin()
    const action = view.action('key', receive, { type: 'secret', max: 2000 })
    const scene = view.finish({ id: 'key', kind: 'secure', action, clearRevision: 1 })
    expect(scene).not.toContain('apiKey')
    await view.dispatch(JSON.stringify({ action, value: 'fixture-secret' }))
    expect(receive).not.toHaveBeenCalled()
    await view.dispatchSecret(JSON.stringify({ action, value: 'fixture-secret' }))
    expect(receive).toHaveBeenCalledWith('fixture-secret')
    expect(() =>
      view.finish({ id: 'key', kind: 'secure', value: 'oops' } as unknown as NativeNode)
    ).toThrow()
  })

  it('rejects mismatched or unbounded native data-table columns and preserves complete cell values', () => {
    const view = new NativePresentation()
    const table: NativeNode = {
      id: 'daily',
      kind: 'table',
      columns: [{ id: 'date', title: 'Date', width: 100 }],
      rows: [{ id: 'day', title: 'Day', cells: { date: '2026-09-07' } }]
    }
    expect(JSON.parse(view.finish(table)).root.rows[0].cells.date).toBe('2026-09-07')
    expect(() =>
      view.finish({ ...table, rows: [{ id: 'day', title: 'Day', cells: { other: '10' } }] })
    ).toThrow()
    expect(() =>
      view.finish({ ...table, columns: [...table.columns!, ...table.columns!] })
    ).toThrow()
    expect(() =>
      view.finish({ ...table, columns: [{ id: 'date', title: 'Date', width: Infinity }] })
    ).toThrow()
  })

  it('accepts only current row IDs and bounded layouts, preserves full research content', async () => {
    const view = new NativePresentation()
    const selected = vi.fn()
    view.begin()
    const action = view.action('table', selected, { type: 'choice', values: ['paper-1'] })
    const content = 'Long research paragraph. '.repeat(10000)
    const scene = view.finish({
      id: 'root',
      kind: 'column',
      children: [
        { id: 'table', kind: 'table', action, rows: [{ id: 'paper-1', title: 'Paper' }] },
        { id: 'reading', kind: 'text', text: content }
      ]
    })
    expect(JSON.parse(scene).root.children[1].text).toBe(content)
    await view.dispatch(JSON.stringify({ action, value: 'paper-2' }))
    expect(selected).not.toHaveBeenCalled()
    await view.dispatch(JSON.stringify({ action, value: 'paper-1' }))
    expect(selected).toHaveBeenCalledWith('paper-1')
    expect(() => view.finish({ id: 'root', kind: 'column', width: -1 })).toThrow()
    view.dispose()
    await view.dispatch(JSON.stringify({ action, value: 'paper-1' }))
    expect(selected).toHaveBeenCalledTimes(1)
  })
})

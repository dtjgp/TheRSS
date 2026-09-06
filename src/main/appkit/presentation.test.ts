import { describe, expect, it, vi } from 'vitest'
import { NativePresentation, type NativeNode } from './presentation'
import { Controls } from './common'
import { nativeHarness } from './testSupport'

describe('native presentation boundary', () => {
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
    expect(() => view.finish({ id: 'key', kind: 'secure', value: 'oops' } as NativeNode)).toThrow()
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

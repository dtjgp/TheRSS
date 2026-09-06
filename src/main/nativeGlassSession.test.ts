import { describe, expect, it, vi } from 'vitest'
import { NativeGlassSession } from './nativeGlassSession'
import type { NativeGlassState } from '../shared/nativeGlass'

const scene = (revision = 1): NativeGlassState => ({
  appearance: 'light',
  contrast: 'normal',
  reduceTransparency: false,
  revision,
  viewport: { width: 1000, height: 700 },
  modal: false,
  surfaces: [
    {
      id: 'sidebar',
      rect: { x: 0, y: 0, width: 224, height: 700 },
      controls: [
        {
          id: 'discover',
          label: 'Discover',
          rect: { x: 12, y: 80, width: 200, height: 34 },
          enabled: true,
          selected: true,
          iconOnly: false
        }
      ],
      labels: []
    }
  ]
})
function harness() {
  let callback: (event: string) => void = () => undefined
  const binding = {
    attach: vi.fn((_handle, listener) => {
      callback = listener
    }),
    present: vi.fn(),
    focus: vi.fn(() => true),
    suspend: vi.fn(() => true),
    release: vi.fn(),
    inspect: vi.fn(() => '{}')
  }
  const port = {
    getNativeWindowHandle: () => Buffer.alloc(8),
    getBounds: () => ({ width: 1000, height: 700 }),
    isDestroyed: () => false,
    isFocused: () => true,
    webContents: { getZoomFactor: () => 1, focus: vi.fn() }
  }
  const events = vi.fn()
  const session = new NativeGlassSession(port, binding, 'pilot', events)
  return {
    session,
    binding,
    port,
    events,
    event: (data: unknown) => callback(JSON.stringify(data)),
    callback: () => callback
  }
}

describe('NativeGlassSession', () => {
  it('suspends stale geometry without detaching or accepting old native input', () => {
    const h = harness()
    h.session.present(scene())
    expect(h.session.present({ ...scene(2), viewport: { width: 300, height: 700 } }).applied).toBe(
      false
    )
    expect(h.binding.suspend).toHaveBeenCalledOnce()
    h.session.present({ ...scene(3), viewport: { width: 301, height: 700 } })
    expect(h.binding.suspend).toHaveBeenCalledOnce()
    expect(h.port.webContents.focus).toHaveBeenCalledOnce()
    expect(h.binding.release).not.toHaveBeenCalled()
    expect(h.session.status().active).toBe(true)
    h.event({ kind: 'activate', id: 'discover', revision: 1 })
    expect(h.events).not.toHaveBeenCalled()
    expect(h.session.focus('first', 1)).toBe(false)
    expect(h.session.present(scene(4)).applied).toBe(true)
    expect(h.binding.attach).toHaveBeenCalledOnce()
    h.event({ kind: 'activate', id: 'discover', revision: 4 })
    expect(h.events).toHaveBeenCalledOnce()
  })
  it('attaches once, converts with actual zoom, and ignores old layouts', () => {
    const h = harness()
    expect(h.session.present(scene())).toEqual({ applied: true, revision: 1 })
    expect(h.binding.attach).toHaveBeenCalledTimes(1)
    expect(JSON.parse(h.binding.present.mock.calls[0]![1])).toMatchObject({ scale: 1, revision: 1 })
    expect(h.session.present(scene())).toEqual({ applied: false, revision: 1, staleRevision: 1 })
    h.session.present(scene(2))
    expect(h.binding.attach).toHaveBeenCalledTimes(1)
  })
  it('rejects invalid, wrong-scope, and mismatched-window geometry before native calls', () => {
    const h = harness()
    expect(() => h.session.present({ ...scene(), pointer: 'no' })).toThrow('Invalid native')
    expect(() =>
      h.session.present({
        ...scene(),
        surfaces: [{ ...scene().surfaces[0], id: 'actions', controls: [] }]
      })
    ).toThrow('pilot')
    expect(h.session.present({ ...scene(), viewport: { width: 300, height: 700 } }).applied).toBe(
      false
    )
    expect(h.binding.attach).not.toHaveBeenCalled()
  })
  it('accepts only enabled current-revision controls and locks them behind modals', () => {
    const h = harness()
    h.session.present(scene())
    h.event({ kind: 'activate', id: 'discover', revision: 1 })
    expect(h.events).toHaveBeenCalledTimes(1)
    h.event({ kind: 'activate', id: 'settings', revision: 1 })
    h.event({ kind: 'activate', id: 'discover', revision: 2 })
    h.event({ kind: 'exec', command: 'bad' })
    expect(h.events).toHaveBeenCalledTimes(1)
    h.session.present({ ...scene(2), modal: true })
    h.event({ kind: 'activate', id: 'discover', revision: 2 })
    expect(h.events).toHaveBeenCalledTimes(1)
    expect(h.session.focus('first', 2)).toBe(false)
  })
  it('hands focus to the web only for the current native scene', () => {
    const h = harness()
    h.session.present(scene())
    expect(h.session.focus('last', 1)).toBe(true)
    expect(h.session.focus('last', 2)).toBe(false)
    h.event({ kind: 'focus-content', edge: 'first', revision: 1 })
    expect(h.port.webContents.focus).toHaveBeenCalledTimes(1)
    expect(h.events).toHaveBeenLastCalledWith({ kind: 'focus-content', edge: 'first', revision: 1 })
  })
  it('invalidates callbacks on release and can start a fresh renderer generation', () => {
    const h = harness()
    h.session.present(scene())
    const old = h.callback()
    h.session.release()
    h.session.present(scene())
    old(JSON.stringify({ kind: 'activate', id: 'discover', revision: 1 }))
    expect(h.events).not.toHaveBeenCalled()
    expect(h.binding.release).toHaveBeenCalledTimes(1)
  })
  it('restores fallback on a native failure without leaking the exception', () => {
    const h = harness()
    h.binding.present.mockImplementation(() => {
      throw new Error('sensitive local detail')
    })
    expect(h.session.present(scene()).applied).toBe(false)
    expect(h.session.status()).toMatchObject({
      available: false,
      active: false,
      reason: 'native-failure'
    })
    expect(h.events).toHaveBeenCalledWith({ kind: 'fallback', reason: 'native-failure' })
    expect(h.binding.release).toHaveBeenCalled()
  })
  it('validates keyboard source and revision before crossing into renderer', () => {
    const h = harness()
    h.session.present(scene())
    const key = {
      kind: 'key',
      id: 'discover',
      key: 'z',
      metaKey: true,
      shiftKey: false,
      repeat: false,
      revision: 1
    }
    h.event(key)
    expect(h.events).toHaveBeenLastCalledWith(key)
    h.event({ ...key, revision: 2 })
    h.event({ ...key, id: 'save-item' })
    h.event({ ...key, key: 'v' })
    expect(h.events).toHaveBeenCalledTimes(1)
    h.session.present({ ...scene(2), modal: true })
    h.event({ ...key, revision: 2 })
    expect(h.events).toHaveBeenCalledTimes(1)
  })
  it('releases partial native initialization when attach throws', () => {
    const h = harness()
    h.binding.attach.mockImplementation(() => {
      throw new Error('attach failed')
    })
    expect(h.session.present(scene()).applied).toBe(false)
    expect(h.binding.release).toHaveBeenCalledOnce()
    expect(h.session.status().reason).toBe('native-failure')
  })
  it('hands lost native focus back transactionally with the presentation acknowledgment', () => {
    const h = harness()
    h.binding.present.mockReturnValue(true)
    expect(h.session.present(scene())).toEqual({ applied: true, revision: 1, focusContent: true })
    expect(h.port.webContents.focus).toHaveBeenCalledOnce()
  })
})

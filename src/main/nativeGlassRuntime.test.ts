import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: IpcMainInvokeEvent, input?: unknown) => unknown>(),
  loadNative: vi.fn()
}))
vi.mock('electron', () => ({
  app: { getAppPath: () => '/fixture' },
  BrowserWindow: class {},
  ipcMain: {
    handle: (channel: string, handler: (event: IpcMainInvokeEvent, input?: unknown) => unknown) =>
      mocks.handlers.set(channel, handler)
  }
}))
vi.mock('node:module', () => ({ createRequire: () => mocks.loadNative }))
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!
const originalVersion = Object.getOwnPropertyDescriptor(process, 'getSystemVersion')
const binding = {
  attach: vi.fn(),
  present: vi.fn(),
  focus: vi.fn(() => true),
  release: vi.fn(),
  inspect: vi.fn(() => '{}')
}
let sequence = 0
function windowFixture() {
  const contents = Object.assign(new EventEmitter(), {
    id: ++sequence,
    mainFrame: {},
    isDestroyed: () => false,
    getZoomFactor: () => 1,
    focus: vi.fn(),
    send: vi.fn()
  })
  const window = Object.assign(new EventEmitter(), {
    webContents: contents,
    getNativeWindowHandle: () => Buffer.alloc(8),
    getBounds: () => ({ width: 1000, height: 700 }),
    isDestroyed: () => false,
    isFocused: () => true,
    setVibrancy: vi.fn()
  })
  const event = {
    sender: contents,
    senderFrame: contents.mainFrame
  } as unknown as IpcMainInvokeEvent
  const invoke = (channel: string, input?: unknown) => mocks.handlers.get(channel)!(event, input)
  return { window, event, invoke }
}
const state = {
  appearance: 'light',
  contrast: 'normal',
  reduceTransparency: false,
  revision: 1,
  viewport: { width: 1000, height: 700 },
  modal: false,
  surfaces: []
}
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.handlers.clear()
  mocks.loadNative.mockReset().mockReturnValue(binding)
  Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
  Object.defineProperty(process, 'getSystemVersion', { value: () => '27.0', configurable: true })
  vi.stubEnv('THERSS_NATIVE_GLASS', 'full')
})
afterEach(() => {
  vi.unstubAllEnvs()
  Object.defineProperty(process, 'platform', originalPlatform)
  if (originalVersion) Object.defineProperty(process, 'getSystemVersion', originalVersion)
  else Reflect.deleteProperty(process, 'getSystemVersion')
})

describe('native glass Electron boundary', () => {
  it('selects the verified full material scope by default', async () => {
    vi.stubEnv('THERSS_NATIVE_GLASS', undefined)
    const { attachNativeGlass } = await import('./nativeGlassRuntime')
    const f = windowFixture()
    attachNativeGlass(f.window as unknown as BrowserWindow, '/fixture/native.node')
    expect(f.invoke(IPC_CHANNELS.nativeGlassStatus)).toMatchObject({
      available: true,
      scope: 'full'
    })
  })
  it('rejects foreign frames and invalid IPC before entering native code', async () => {
    const { attachNativeGlass } = await import('./nativeGlassRuntime')
    const f = windowFixture()
    attachNativeGlass(f.window as unknown as BrowserWindow, '/fixture/native.node')
    expect(f.invoke(IPC_CHANNELS.nativeGlassStatus)).toMatchObject({
      available: true,
      scope: 'full'
    })
    expect(() =>
      mocks.handlers.get(IPC_CHANNELS.nativeGlassStatus)!({
        ...f.event,
        senderFrame: {}
      } as IpcMainInvokeEvent)
    ).toThrow('owning main frame')
    expect(() => f.invoke(IPC_CHANNELS.nativeGlassPresent, { ...state, pointer: 1 })).toThrow(
      'Invalid native glass state'
    )
    expect(() =>
      f.invoke(IPC_CHANNELS.nativeGlassFocus, { edge: 'arbitrary', revision: 1 })
    ).toThrow('Invalid native focus request')
    expect(binding.attach).not.toHaveBeenCalled()
    expect(f.invoke(IPC_CHANNELS.nativeGlassPresent, state)).toEqual({ applied: true, revision: 1 })
    expect(f.window.setVibrancy).toHaveBeenCalledWith(null)
    expect(f.invoke(IPC_CHANNELS.nativeGlassFocus, { edge: 'first', revision: 1 })).toBe(true)
    f.window.emit('blur')
    expect(f.window.webContents.send).toHaveBeenCalledWith(IPC_CHANNELS.nativeGlassEvent, {
      kind: 'window-active',
      active: true
    })
    f.window.webContents.emit('did-start-navigation', { isMainFrame: true })
    expect(binding.release).toHaveBeenCalledOnce()
    expect(f.window.setVibrancy).toHaveBeenLastCalledWith('sidebar')
    f.window.emit('closed')
    expect(() => f.invoke(IPC_CHANNELS.nativeGlassStatus)).toThrow('owning main frame')
  })
  it('restores vibrancy after native initialization throws', async () => {
    const { attachNativeGlass } = await import('./nativeGlassRuntime')
    const f = windowFixture()
    binding.attach.mockImplementationOnce(() => {
      throw new Error('native attach failed')
    })
    attachNativeGlass(f.window as unknown as BrowserWindow, '/fixture/native.node')
    expect(f.invoke(IPC_CHANNELS.nativeGlassPresent, state)).toMatchObject({ applied: false })
    expect(f.window.setVibrancy).toHaveBeenLastCalledWith('sidebar')
    expect(f.invoke(IPC_CHANNELS.nativeGlassStatus)).toMatchObject({
      available: false,
      reason: 'native-failure'
    })
  })
  it('keeps the web fallback for the off switch, old OS, other platforms and missing modules', async () => {
    const { attachNativeGlass } = await import('./nativeGlassRuntime')
    for (const [mode, platform, version, reason] of [
      ['off', 'darwin', '27.0', 'disabled'],
      ['full', 'linux', '27.0', 'unsupported-platform'],
      ['full', 'darwin', '25.0', 'unsupported-system'],
      ['full', 'darwin', '27.0', 'module-unavailable']
    ]) {
      vi.stubEnv('THERSS_NATIVE_GLASS', mode)
      Object.defineProperty(process, 'platform', { value: platform, configurable: true })
      Object.defineProperty(process, 'getSystemVersion', {
        value: () => version,
        configurable: true
      })
      mocks.loadNative.mockImplementationOnce(() => {
        throw new Error('module unavailable')
      })
      const f = windowFixture()
      attachNativeGlass(f.window as unknown as BrowserWindow, '/fixture/native.node')
      expect(f.invoke(IPC_CHANNELS.nativeGlassStatus)).toMatchObject({ available: false, reason })
      expect(f.invoke(IPC_CHANNELS.nativeGlassPresent, state)).toEqual({
        applied: false,
        revision: 1
      })
      expect(f.invoke(IPC_CHANNELS.nativeGlassFocus, { edge: 'first', revision: 1 })).toBe(false)
      expect(() => f.invoke(IPC_CHANNELS.nativeGlassRelease)).not.toThrow()
      expect(f.window.setVibrancy).not.toHaveBeenCalled()
      f.window.emit('closed')
    }
  })
})

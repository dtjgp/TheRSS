import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import type { WindowApplication } from './windowApplication'

const f = vi.hoisted(() => {
  const bridge = {
    attach: vi.fn(),
    present: vi.fn(),
    flush: vi.fn(),
    detach: vi.fn(),
    edit: vi.fn(() => true)
  }
  const presenter = {
    start: vi.fn(async () => undefined),
    receive: vi.fn(),
    dispose: vi.fn(),
    flushPreferences: vi.fn(async () => undefined),
    zoom: vi.fn(),
    layoutChanged: vi.fn(),
    command: vi.fn(async () => undefined),
    settingsChanged: vi.fn(async () => undefined)
  }
  const settings = {
    start: vi.fn(async () => undefined),
    receive: vi.fn(),
    dispose: vi.fn(),
    flushPreferences: vi.fn(async () => undefined),
    zoom: vi.fn(),
    layoutChanged: vi.fn(),
    command: vi.fn(async () => undefined),
    select: vi.fn()
  }
  return {
    bridge,
    presenter,
    settings,
    settingsOptions: [] as unknown[],
    presenterOptions: [] as unknown[],
    create: vi.fn(),
    read: vi.fn(async () => ({
      version: 1,
      sidebar: 224,
      discover: 320,
      saved: 320,
      collapsed: false,
      zoom: 1
    })),
    write: vi.fn(async () => undefined),
    open: vi.fn()
  }
})
vi.mock('node:module', () => ({ createRequire: () => () => f.bridge }))
vi.mock('electron', () => ({
  app: { getPath: () => '/private/tmp/fixture-native-user-data', getSystemLocale: () => 'en-US' },
  shell: { openExternal: f.open }
}))
vi.mock('./windowApplicationRuntime', () => ({
  isSafeExternalUrl: (url: string) => {
    try {
      return new URL(url).protocol === 'https:'
    } catch {
      return false
    }
  }
}))
vi.mock('./appkit/preferences', () => ({
  readNativePreferences: f.read,
  writeNativePreferences: f.write
}))
vi.mock('./appkit/presenter', () => ({
  NativePresenter: class {
    constructor(_api: unknown, options: unknown) {
      f.presenterOptions.push(options)
      return f.presenter
    }
  }
}))
vi.mock('./appkit/settingsPresenter', () => ({
  NativeSettingsPresenter: class {
    constructor(_api: unknown, options: unknown) {
      f.settingsOptions.push(options)
      return f.settings
    }
  }
}))
import {
  attachAppKit,
  attachSettingsAppKit,
  selectSettingsPane,
  dispatchNativeMenu,
  displayLocale,
  drainNativePreferences,
  flushNativeInterface,
  shouldUseAppKit
} from './nativeAppKitRuntime'

function windowFixture() {
  let closed: (() => void) | undefined
  let resize: (() => void) | undefined
  const window = {
    getNativeWindowHandle: () => Buffer.alloc(8),
    getContentBounds: () => ({ width: 820, height: 568 }),
    on: vi.fn((event: string, handler: () => void) => {
      if (event === 'resize') resize = handler
    }),
    removeListener: vi.fn(),
    isDestroyed: vi.fn(() => false),
    webContents: { executeJavaScript: vi.fn(async () => ({ sidebar: '245' })) },
    once: vi.fn((_event: string, handler: () => void) => {
      closed = handler
    })
  } as unknown as BrowserWindow
  return { window, close: () => closed?.(), resize: () => resize?.() }
}

describe('AppKit runtime wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    f.presenterOptions.length = 0
    f.settingsOptions.length = 0
    f.bridge.edit.mockReturnValue(true)
  })
  afterEach(() => vi.unstubAllEnvs())
  it('migrates only known preferences and keeps input callbacks in the main process', async () => {
    const w = windowFixture()
    await attachAppKit(w.window, { api: {} } as WindowApplication)
    expect(f.read).toHaveBeenCalledWith('/private/tmp/fixture-native-user-data/native-ui.json', {
      sidebar: '245'
    })
    const [handle, event, secret] = f.bridge.attach.mock.calls[0]!
    event('{"action":"fixture"}')
    secret('{"action":"fixture-secret"}')
    expect(f.presenter.receive.mock.calls).toEqual([
      ['{"action":"fixture"}'],
      ['{"action":"fixture-secret"}', true]
    ])
    const options = f.presenterOptions[0] as {
      contentSize(): { width: number; height: number }
      present(scene: string): void
      persist(value: unknown): Promise<void>
      openExternal(url: string): void
    }
    expect(options.contentSize()).toEqual({ width: 820, height: 568 })
    w.resize()
    expect(f.presenter.layoutChanged).toHaveBeenCalledOnce()
    options.present('scene')
    expect(f.bridge.present).toHaveBeenCalledWith(handle, 'scene')
    options.openExternal('file:///private/tmp/no')
    options.openExternal('https://arxiv.org/abs/1')
    expect(f.open).toHaveBeenCalledTimes(1)
    await options.persist({ fixture: true })
    expect(f.write).toHaveBeenCalledWith(expect.stringContaining('native-ui.json'), {
      fixture: true
    })
    w.close()
    await drainNativePreferences()
    expect(f.presenter.dispose).toHaveBeenCalledOnce()
  })
  it('flushes input before native editing/zoom and gives non-editing Undo to triage', async () => {
    const w = windowFixture()
    await attachAppKit(w.window, { api: {} } as WindowApplication)
    flushNativeInterface(w.window)
    dispatchNativeMenu(w.window, 'zoom-in')
    dispatchNativeMenu(w.window, 'zoom-out')
    dispatchNativeMenu(w.window, 'zoom-reset')
    expect(f.presenter.zoom.mock.calls).toEqual([['in'], ['out'], ['reset']])
    dispatchNativeMenu(w.window, 'copy')
    expect(f.bridge.edit).toHaveBeenCalledWith(expect.any(Buffer), 'copy')
    f.bridge.edit.mockReturnValue(false)
    dispatchNativeMenu(w.window, 'undo')
    expect(f.presenter.command).toHaveBeenCalledWith('undo-triage')
    expect(f.bridge.flush).toHaveBeenCalledTimes(6)
    await drainNativePreferences()
    w.close()
    await drainNativePreferences()
    flushNativeInterface(w.window)
    dispatchNativeMenu(w.window, 'copy')
    expect(f.bridge.flush).toHaveBeenCalledTimes(6)
  })
  it('opens Settings on a pane and reloads the other windows after a save there', async () => {
    const main = windowFixture(),
      settings = windowFixture()
    const openSettings = vi.fn()
    await attachAppKit(main.window, { api: {} } as WindowApplication, { openSettings })
    expect((f.presenterOptions[0] as { openSettings: unknown }).openSettings).toBe(openSettings)
    await attachSettingsAppKit(settings.window, { api: {} } as WindowApplication, 'provider')
    expect(f.settings.select).toHaveBeenCalledWith('provider')
    expect(f.settings.start).toHaveBeenCalledOnce()
    selectSettingsPane(settings.window, 'personal')
    expect(f.settings.select).toHaveBeenLastCalledWith('personal')
    selectSettingsPane(main.window, 'personal')
    expect(f.settings.select).toHaveBeenCalledTimes(2)
    ;(f.settingsOptions[0] as { changed(): void }).changed()
    expect(f.presenter.settingsChanged).toHaveBeenCalledOnce()
    settings.close()
    main.close()
    await drainNativePreferences()
  })
  it('keeps the native toolbar title instead of the host page title', async () => {
    const w = windowFixture()
    await attachAppKit(w.window, { api: {} } as WindowApplication)
    const calls = vi.mocked(w.window.on).mock.calls as unknown as [string, unknown][]
    const registration = calls.find(([event]) => event === 'page-title-updated')
    expect(registration, 'native windows cancel page-title updates').toBeDefined()
    const preventDefault = vi.fn()
    ;(registration![1] as (event: { preventDefault(): void }) => void)({ preventDefault })
    expect(preventDefault).toHaveBeenCalled()
  })
  it('uses the system locale for dates; only fixture runs may pin another', () => {
    const saved = {
      fixtures: process.env.THERSS_E2E_FIXTURES,
      locale: process.env.THERSS_E2E_LOCALE
    }
    try {
      process.env.THERSS_E2E_LOCALE = 'zh-CN'
      delete process.env.THERSS_E2E_FIXTURES
      expect(displayLocale()).toBe('en-US')
      process.env.THERSS_E2E_FIXTURES = '1'
      expect(displayLocale()).toBe('zh-CN')
    } finally {
      if (saved.fixtures === undefined) delete process.env.THERSS_E2E_FIXTURES
      else process.env.THERSS_E2E_FIXTURES = saved.fixtures
      if (saved.locale === undefined) delete process.env.THERSS_E2E_LOCALE
      else process.env.THERSS_E2E_LOCALE = saved.locale
    }
  })
  it('defaults supported macOS to AppKit and retains an explicit compatibility route', () => {
    vi.stubEnv('THERSS_UI', undefined)
    expect(shouldUseAppKit('darwin', '26.0.0')).toBe(true)
    expect(shouldUseAppKit('darwin', '24.0.0')).toBe(false)
    expect(shouldUseAppKit('linux', '6.0.0')).toBe(false)
    vi.stubEnv('THERSS_UI', 'web')
    expect(shouldUseAppKit('darwin', '26.0.0')).toBe(false)
    vi.stubEnv('THERSS_UI', 'appkit')
    expect(shouldUseAppKit('darwin', '25.0.0')).toBe(true)
  })
})

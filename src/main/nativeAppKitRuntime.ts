import { createRequire } from 'node:module'
import { join } from 'node:path'
import { release } from 'node:os'
import { app, type BrowserWindow, shell } from 'electron'
import { NativePresenter } from './appkit/presenter'
import { readNativePreferences, writeNativePreferences } from './appkit/preferences'
import type { WindowApplication } from './windowApplication'
import { isSafeExternalUrl } from './windowApplicationRuntime'

interface NativeBridge {
  attach(handle: Buffer, onEvent: (json: string) => void, onSecret: (json: string) => void): void
  present(handle: Buffer, scene: string): void
  flush(handle: Buffer): void
  detach(handle: Buffer): void
  edit(handle: Buffer, command: string): boolean
}
interface NativeSession {
  readonly presenter: NativePresenter
  readonly bridge: NativeBridge
  readonly handle: Buffer
}
const sessions = new Map<BrowserWindow, NativeSession>()
const drainingPreferences = new Set<Promise<void>>()

/** macOS26 is Darwin25. Older systems and explicit rollback use the compatibility UI. */
export function shouldUseAppKit(
  platform: NodeJS.Platform = process.platform,
  kernel = release()
): boolean {
  return (
    platform === 'darwin' && Number.parseInt(kernel, 10) >= 25 && process.env.THERSS_UI !== 'web'
  )
}

export async function attachAppKit(
  window: BrowserWindow,
  application: WindowApplication
): Promise<void> {
  const require = createRequire(import.meta.url)
  const bridge = require(join(__dirname, '../native-appkit/therss-ui.node')) as NativeBridge
  const handle = window.getNativeWindowHandle()
  const path = join(app.getPath('userData'), 'native-ui.json')
  await drainNativePreferences()
  // Only these three former preferences are migrated. The page has no scripts or UI.
  const legacy = await window.webContents.executeJavaScript(
    `(() => { try { return { sidebar: localStorage.getItem('therss.sidebar-width'), discover: localStorage.getItem('therss.discover-list-width'), saved: localStorage.getItem('therss.saved-list-width') } } catch { return {} } })()`
  )
  const preferences = await readNativePreferences(path, legacy)
  await writeNativePreferences(path, preferences).catch(() => undefined)
  const presenter = new NativePresenter(application.api, {
    preferences,
    present: (scene) => {
      if (!window.isDestroyed()) bridge.present(handle, scene)
    },
    persist: (next) => writeNativePreferences(path, next),
    openExternal: (url) => {
      if (isSafeExternalUrl(url)) void shell.openExternal(url)
    },
    contentSize: () => {
      const { width, height } = window.getContentBounds()
      return { width, height }
    }
  })
  bridge.attach(
    handle,
    (json) => presenter.receive(json),
    (json) => presenter.receive(json, true)
  )
  sessions.set(window, { presenter, bridge, handle })
  const resize = () => presenter.layoutChanged()
  window.on('resize', resize)
  window.once('closed', () => {
    window.removeListener('resize', resize)
    sessions.delete(window)
    presenter.dispose()
    const work = presenter.flushPreferences()
    drainingPreferences.add(work)
    void work.then(() => drainingPreferences.delete(work))
  })
  await presenter.start()
}

export function flushNativeInterface(window: BrowserWindow): void {
  const session = sessions.get(window)
  if (session && !window.isDestroyed()) session.bridge.flush(session.handle)
}
export function dispatchNativeMenu(window: BrowserWindow, command: string): void {
  const session = sessions.get(window)
  if (!session) return
  session.bridge.flush(session.handle)
  if (command === 'zoom-in' || command === 'zoom-out' || command === 'zoom-reset')
    session.presenter.zoom(command === 'zoom-in' ? 'in' : command === 'zoom-out' ? 'out' : 'reset')
  else if (!session.bridge.edit(session.handle, command) && command === 'undo')
    void session.presenter.command('undo-triage')
}
export async function drainNativePreferences(): Promise<void> {
  await Promise.allSettled(
    [...sessions.values()]
      .map((session) => session.presenter.flushPreferences())
      .concat([...drainingPreferences])
  )
}

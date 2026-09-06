import { createRequire } from 'node:module'
import { join } from 'node:path'
import { app, BrowserWindow, ipcMain } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../shared/ipc'
import { nativeGlassStateSchema } from '../shared/nativeGlassSchema'
import type { NativeGlassStatus } from '../shared/nativeGlass'
import { NativeGlassSession, type NativeGlassBinding } from './nativeGlassSession'

const runtimes = new Map<
  number,
  { window: BrowserWindow; session: NativeGlassSession | null; status: NativeGlassStatus }
>()
const focusSchema = z
  .object({ edge: z.enum(['first', 'last']), revision: z.number().int().min(1).max(2147483647) })
  .strict()
let registered = false

function owner(event: Electron.IpcMainInvokeEvent) {
  const runtime = runtimes.get(event.sender.id)
  if (!runtime || runtime.window.isDestroyed() || event.senderFrame !== event.sender.mainFrame)
    throw new Error('Native UI requires the owning main frame')
  return runtime
}
function registerIpc(): void {
  if (registered) return
  registered = true
  ipcMain.handle(IPC_CHANNELS.nativeGlassStatus, (event) => {
    const runtime = owner(event)
    return (
      runtime.session?.status() ?? { ...runtime.status, windowActive: runtime.window.isFocused() }
    )
  })
  ipcMain.handle(IPC_CHANNELS.nativeGlassPresent, (event, input: unknown) => {
    const runtime = owner(event)
    const parsed = nativeGlassStateSchema.safeParse(input)
    if (!parsed.success) throw new Error('Invalid native glass state')
    return (
      runtime.session?.present(parsed.data) ?? { applied: false, revision: parsed.data.revision }
    )
  })
  ipcMain.handle(IPC_CHANNELS.nativeGlassFocus, (event, input: unknown) => {
    const runtime = owner(event)
    const parsed = focusSchema.safeParse(input)
    if (!parsed.success) throw new Error('Invalid native focus request')
    return runtime.session?.focus(parsed.data.edge, parsed.data.revision) ?? false
  })
  ipcMain.handle(IPC_CHANNELS.nativeGlassRelease, (event) => owner(event).session?.release())
}

export function attachNativeGlass(window: BrowserWindow, nativePath: string): void {
  registerIpc()
  const mode = process.env.THERSS_NATIVE_GLASS ?? 'full'
  const scope = mode === 'full' ? 'full' : 'pilot'
  let reason: NativeGlassStatus['reason'] = null
  let session: NativeGlassSession | null = null
  if (mode !== 'pilot' && mode !== 'full') reason = 'disabled'
  else if (process.platform !== 'darwin') reason = 'unsupported-platform'
  else if (Number.parseInt(process.getSystemVersion().split('.')[0] ?? '0', 10) < 26)
    reason = 'unsupported-system'
  else {
    try {
      const require = createRequire(join(app.getAppPath(), 'package.json'))
      const native = require(nativePath) as NativeGlassBinding
      if (
        ['attach', 'present', 'focus', 'release', 'inspect'].some(
          (method) => typeof native[method as keyof NativeGlassBinding] !== 'function'
        )
      )
        throw new Error('Native module contract mismatch')
      const binding: NativeGlassBinding = {
        ...native,
        attach: (_handle, callback) => {
          window.setVibrancy(null)
          native.attach(window.getNativeWindowHandle(), callback)
        },
        present: (handle, scene) => native.present(handle, scene),
        focus: (handle, edge) => native.focus(handle, edge),
        release: (handle) => {
          native.release(handle)
          if (!window.isDestroyed()) window.setVibrancy('sidebar')
        },
        inspect: (handle) => native.inspect(handle)
      }
      session = new NativeGlassSession(window, binding, scope, (event) => {
        if (!window.webContents.isDestroyed())
          window.webContents.send(IPC_CHANNELS.nativeGlassEvent, event)
      })
    } catch {
      reason = 'module-unavailable'
    }
  }
  const runtime: {
    window: BrowserWindow
    session: NativeGlassSession | null
    status: NativeGlassStatus
  } = {
    window,
    session,
    status: {
      available: Boolean(session),
      active: false,
      scope,
      windowActive: window.isFocused(),
      reason
    }
  }
  runtimes.set(window.webContents.id, runtime)
  const sendActivity = () => {
    if (!window.webContents.isDestroyed())
      window.webContents.send(IPC_CHANNELS.nativeGlassEvent, {
        kind: 'window-active',
        active: window.isFocused()
      })
  }
  window.on('focus', sendActivity)
  window.on('blur', sendActivity)
  window.webContents.on('did-start-navigation', (details) => {
    if (details.isMainFrame) session?.release()
  })
  const id = window.webContents.id
  window.once('closed', () => {
    session?.release()
    runtimes.delete(id)
  })
}

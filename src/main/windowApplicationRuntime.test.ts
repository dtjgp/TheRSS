import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import type { ApplicationServices } from './windowApplication'
import { IPC_CHANNELS } from '../shared/ipc'

const f = vi.hoisted(() => ({
  handles: new Map<string, (...args: unknown[]) => unknown>(),
  events: new Map<string, (...args: unknown[]) => unknown>(),
  owners: new Map<unknown, unknown>(),
  choice: vi.fn(async () => ({ response: 0 })),
  open: vi.fn(),
  copy: vi.fn(),
  menuPick: '',
  template: [] as { label?: string; click?: () => void }[]
}))
vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: (sender: unknown) => f.owners.get(sender) ?? null },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
      f.handles.set(channel, handler),
    on: (channel: string, handler: (...args: unknown[]) => unknown) =>
      f.events.set(channel, handler)
  },
  dialog: { showMessageBox: f.choice },
  shell: { openExternal: f.open },
  clipboard: { writeText: f.copy },
  Menu: {
    buildFromTemplate: (template: typeof f.template) => {
      f.template = template
      return {
        popup: ({ callback }: { callback: () => void }) => {
          template.find((item) => item.label === f.menuPick)?.click?.()
          callback()
        }
      }
    }
  }
}))
import {
  WindowApplicationRuntime,
  dirtySettingsWindows,
  isSafeExternalUrl
} from './windowApplicationRuntime'

function fixture() {
  const closed: (() => void)[] = []
  const webContents = { id: 7, mainFrame: {}, send: vi.fn() }
  const window = {
    webContents,
    isDestroyed: vi.fn(() => false),
    once: vi.fn((_event: string, listener: () => void) => closed.push(listener))
  } as unknown as BrowserWindow
  f.owners.set(webContents, window)
  const promotion = {
    confirm: vi.fn(async () => ({ status: 'completed' })),
    cancel: vi.fn(async () => ({ status: 'skipped' })),
    disposeOwner: vi.fn(async () => undefined)
  }
  const services = {
    repository: { getDashboardSnapshot: () => ({ date: 'fixture' }) },
    promotion
  } as unknown as ApplicationServices
  const runtime = new WindowApplicationRuntime(services, () => 'blue', false)
  const session = runtime.bind(window)
  runtime.registerCompatibilityIpc()
  const event = { sender: webContents, senderFrame: webContents.mainFrame }
  return { runtime, session, window, webContents, promotion, event, closed }
}

describe('native and compatibility window runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    f.handles.clear()
    f.events.clear()
    f.owners.clear()
    f.menuPick = ''
    f.choice.mockResolvedValue({ response: 0 })
  })
  it('rejects frames without a registered main-frame owner and ignores forged dirty notifications', async () => {
    const x = fixture()
    expect(await f.handles.get(IPC_CHANNELS.getDashboard)!(x.event)).toEqual({ date: 'fixture' })
    expect(() =>
      f.handles.get(IPC_CHANNELS.getDashboard)!({ ...x.event, senderFrame: {} })
    ).toThrow('Untrusted')
    expect(() =>
      f.handles.get(IPC_CHANNELS.getDashboard)!({ sender: {}, senderFrame: {} })
    ).toThrow('Untrusted')
    f.events.get(IPC_CHANNELS.setSettingsDirty)!({ ...x.event, senderFrame: {} }, true)
    f.events.get(IPC_CHANNELS.setSettingsDirty)!(x.event, 'bad')
    expect(dirtySettingsWindows.has(x.window.webContents)).toBe(false)
    f.events.get(IPC_CHANNELS.setSettingsDirty)!(x.event, true)
    expect(dirtySettingsWindows.has(x.window.webContents)).toBe(true)
    expect(await x.session.api.confirmDiscardSettings()).toBe(false)
    f.choice.mockResolvedValue({ response: 1 })
    expect(await x.session.api.confirmDiscardSettings()).toBe(true)
    expect(dirtySettingsWindows.has(x.window.webContents)).toBe(false)
    expect(() =>
      f.handles.get(IPC_CHANNELS.previewLlmWikiPromotion)!(x.event, {
        itemId: 'paper',
        extra: true
      })
    ).toThrow()
    expect(() =>
      f.handles.get(IPC_CHANNELS.confirmLlmWikiPromotion)!(x.event, { previewId: 'bad' })
    ).toThrow()
    await x.runtime.shutdown()
  })

  it('uses safe native menus and a final default-cancel promotion confirmation', async () => {
    const x = fixture()
    const target = {
      kind: 'saved-item' as const,
      itemId: 'arxiv:1',
      title: 'Paper',
      url: 'https://arxiv.org/abs/1',
      sourceLabel: 'arXiv',
      publishedAt: 'now',
      isSaved: true,
      canAnalyze: true,
      canPromote: true
    }
    f.menuPick = 'Copy Link'
    await x.session.api.showContextMenu(target)
    expect(f.copy).toHaveBeenCalledWith(target.url)
    f.menuPick = 'Open in Browser'
    await x.session.api.showContextMenu(target)
    expect(f.open).toHaveBeenCalledWith(target.url)
    await x.session.api.showContextMenu({ ...target, url: 'file:///private/tmp/no' })
    expect(f.open).toHaveBeenCalledOnce()
    f.menuPick = 'Analyze…'
    expect(await x.session.api.showContextMenu(target)).toEqual({
      action: 'analyze',
      itemId: target.itemId
    })
    const preview = 'a0000000-0000-4000-8000-000000000001'
    await x.session.api.confirmLlmWikiPromotion(preview)
    expect(f.choice).toHaveBeenCalledWith(
      x.window,
      expect.objectContaining({ defaultId: 0, cancelId: 0 })
    )
    expect(x.promotion.cancel).toHaveBeenCalledWith(preview, '7')
    expect(x.promotion.confirm).not.toHaveBeenCalled()
    f.choice.mockResolvedValue({ response: 1 })
    await x.session.api.confirmLlmWikiPromotion(preview)
    expect(x.promotion.confirm).toHaveBeenCalledWith(preview, '7')
    await x.runtime.shutdown()
  })

  it('forwards commands and releases a closed owner before runtime shutdown completes', async () => {
    const x = fixture()
    expect(x.runtime.bind(x.window)).toBe(x.session)
    x.session.command('show-saved')
    x.session.accentChanged('red')
    expect(x.webContents.send.mock.calls).toEqual([
      [IPC_CHANNELS.appCommand, 'show-saved'],
      [IPC_CHANNELS.systemAccentChanged, 'red']
    ])
    x.closed.forEach((listener) => listener())
    await x.runtime.shutdown()
    expect(x.promotion.disposeOwner).toHaveBeenCalledWith('7')
    expect(x.runtime.get(x.window)).toBeUndefined()
    expect(() => f.handles.get(IPC_CHANNELS.getDashboard)!(x.event)).toThrow('closed')
    expect(() => x.runtime.bind(x.window)).toThrow('shutting down')
    expect(isSafeExternalUrl('broken')).toBe(false)
    expect(isSafeExternalUrl('https://arxiv.org')).toBe(true)
  })
})

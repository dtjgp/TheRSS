import { BrowserWindow, Menu, clipboard, dialog, ipcMain, shell } from 'electron'
import { buildContextMenuTemplate, buildCopyPayload } from '../core/menus/contextMenu'
import {
  isRendererContextMenuAction,
  type ContextMenuOutcome,
  type ContextMenuTarget
} from '../shared/contextMenu'
import type { TheRSSApi } from '../shared/api'
import type { SystemAccentName } from '../shared/appearance'
import { IPC_CHANNELS } from '../shared/ipc'
import {
  llmWikiPromotionPreviewRequestSchema,
  llmWikiPromotionConfirmRequestSchema
} from '../shared/llmWikiPromotion'
import { WindowApplication, type ApplicationServices } from './windowApplication'

export const dirtySettingsWindows = new WeakSet<Electron.WebContents>()

export function isSafeExternalUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export async function confirmDiscardSettings(window: BrowserWindow): Promise<boolean> {
  const choice = await dialog.showMessageBox(window, {
    type: 'warning',
    title: 'Discard unsaved settings?',
    message: 'Your Settings changes have not been saved.',
    detail: 'Discard the edits and leave Settings?',
    buttons: ['Keep Editing', 'Discard Changes'],
    cancelId: 0,
    defaultId: 0,
    noLink: true
  })
  return choice.response === 1
}

function contextMenu(
  window: BrowserWindow,
  target: ContextMenuTarget
): Promise<ContextMenuOutcome> {
  return new Promise((resolve) => {
    let outcome: ContextMenuOutcome = { action: 'none' }
    const template = buildContextMenuTemplate(target).map((entry) => {
      if (entry.type === 'separator') return { type: 'separator' as const }
      return {
        label: entry.label,
        click: () => {
          if (entry.action === 'open-external') {
            if (isSafeExternalUrl(target.url)) void shell.openExternal(target.url)
            return
          }
          const payload = buildCopyPayload(target, entry.action)
          if (payload !== null) {
            clipboard.writeText(payload)
            return
          }
          if (!isRendererContextMenuAction(entry.action)) return
          outcome = target.sessionId
            ? { action: entry.action, itemId: target.itemId, sessionId: target.sessionId }
            : { action: entry.action, itemId: target.itemId }
        }
      }
    })
    Menu.buildFromTemplate(template).popup({ window, callback: () => resolve(outcome) })
  })
}

export class WindowApplicationRuntime {
  private readonly byWindow = new Map<BrowserWindow, WindowApplication>()
  private readonly draining = new Set<Promise<void>>()
  private stopping = false

  constructor(
    private readonly services: ApplicationServices,
    private readonly accent: () => SystemAccentName | null,
    private readonly fixture: boolean
  ) {}

  bind(window: BrowserWindow): WindowApplication {
    if (this.stopping) throw new Error('Application is shutting down')
    const existing = this.byWindow.get(window)
    if (existing) return existing
    const session = new WindowApplication(this.services, {
      ownerId: String(window.webContents.id),
      isAvailable: () => !window.isDestroyed(),
      setDirty: (value) => {
        if (value) dirtySettingsWindows.add(window.webContents)
        else dirtySettingsWindows.delete(window.webContents)
      },
      confirmDiscard: () => (this.fixture ? Promise.resolve(true) : confirmDiscardSettings(window)),
      confirmPromotion: async () => {
        if (window.isDestroyed()) return false
        if (this.fixture) return true
        const choice = await dialog.showMessageBox(window, {
          type: 'warning',
          title: 'Confirm llm-wiki write',
          message: 'Write the previewed paper artifacts to your local llm-wiki vault?',
          detail:
            'TheRSS will create the verified PDF, paper record, analysis note, backlinks, indexes, log entry, and audit record shown in the preview.',
          buttons: ['Cancel', 'Write to llm-wiki'],
          cancelId: 0,
          defaultId: 0,
          noLink: true
        })
        return choice.response === 1
      },
      contextMenu: (target) => contextMenu(window, target),
      accent: this.accent
    })
    this.byWindow.set(window, session)
    session.api.onAppCommand((command) => {
      if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.appCommand, command)
    })
    session.api.onDiscoverProgress((progress) => {
      if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.discoverProgress, progress)
    })
    session.api.onSystemAccentChange((accent) => {
      if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.systemAccentChanged, accent)
    })
    window.once('closed', () => {
      this.byWindow.delete(window)
      const draining = session.shutdown()
      this.draining.add(draining)
      void draining.then(() => this.draining.delete(draining))
    })
    return session
  }

  get(window: BrowserWindow): WindowApplication | undefined {
    return this.byWindow.get(window)
  }

  async shutdown(): Promise<void> {
    this.stopping = true
    await Promise.all(
      [...this.byWindow.values()].map((session) => session.shutdown()).concat([...this.draining])
    )
  }

  registerCompatibilityIpc(): void {
    const apiFor = (event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent): TheRSSApi => {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window || event.senderFrame !== event.sender.mainFrame)
        throw new Error('Untrusted application frame')
      const session = this.byWindow.get(window)
      if (!session) throw new Error('Application window is closed')
      return session.api
    }
    const methods = [
      'showContextMenu',
      'getSystemAccent',
      'getDashboard',
      'getSourceContent',
      'refreshSourceContent',
      'getInterestProfile',
      'saveInterestProfile',
      'refresh',
      'searchLocal',
      'getLocalResearch',
      'searchDiscover',
      'retryDiscover',
      'cancelDiscover',
      'getLatestDiscover',
      'getAnalytics',
      'saveDiscoverResult',
      'setTriageState',
      'getSavedSourceUpdate',
      'applySavedSourceUpdate',
      'getModelProvider',
      'saveModelProvider',
      'testModelProvider',
      'clearModelProviderCredential',
      'confirmDiscardSettings',
      'getLocalAgentStatuses',
      'analyzeItem',
      'analyzeDiscoverResult',
      'getLatestAnalysis',
      'getAnalysisArtifact',
      'getLatestLlmWikiPromotion'
    ] as const
    for (const method of methods) {
      ipcMain.handle(IPC_CHANNELS[method], (event, ...args: unknown[]) =>
        Reflect.apply(apiFor(event)[method], undefined, args)
      )
    }
    ipcMain.on(IPC_CHANNELS.setSettingsDirty, (event, candidate: unknown) => {
      if (typeof candidate !== 'boolean' || event.senderFrame !== event.sender.mainFrame) return
      const window = BrowserWindow.fromWebContents(event.sender)
      if (window) this.byWindow.get(window)?.api.setSettingsDirty(candidate)
    })
    ipcMain.handle(IPC_CHANNELS.getDiscoverPersonalizationSettings, (event) =>
      apiFor(event).getDiscoverPersonalizationSettings()
    )
    ipcMain.handle(IPC_CHANNELS.saveDiscoverPersonalizationPrompt, (event, prompt) =>
      apiFor(event).saveDiscoverPersonalizationPrompt(prompt)
    )
    ipcMain.handle(IPC_CHANNELS.previewLlmWikiPromotion, (event, candidate: unknown) => {
      const input = llmWikiPromotionPreviewRequestSchema.parse(candidate)
      return apiFor(event).previewLlmWikiPromotion(input.itemId, input.sessionId)
    })
    for (const method of ['confirmLlmWikiPromotion', 'cancelLlmWikiPromotion'] as const) {
      ipcMain.handle(IPC_CHANNELS[method], (event, candidate: unknown) =>
        apiFor(event)[method](llmWikiPromotionConfirmRequestSchema.parse(candidate).previewId)
      )
    }
  }
}

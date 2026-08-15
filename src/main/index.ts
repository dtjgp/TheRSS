import { join } from 'node:path'
import Database from 'better-sqlite3'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { z } from 'zod'
import { DiscoveryService } from '../core/discovery/discoveryService'
import { interestProfileSchema } from '../core/interests/interestProfile'
import { ResearchRepository } from '../core/storage/researchRepository'
import { IPC_CHANNELS } from '../shared/ipc'

const triageInputSchema = z.object({
  id: z.string().trim().min(1).max(300),
  state: z.enum(['new', 'viewed', 'saved', 'dismissed'])
})

function registerIpcHandlers(
  repository: ResearchRepository,
  discoveryService: DiscoveryService
): void {
  ipcMain.handle(IPC_CHANNELS.getDashboard, () => repository.getDashboardSnapshot())
  ipcMain.handle(IPC_CHANNELS.getInterestProfile, () => repository.getInterestProfile())
  ipcMain.handle(IPC_CHANNELS.saveInterestProfile, (_event, candidate: unknown) => {
    repository.saveInterestProfile(interestProfileSchema.parse(candidate))
    return repository.getDashboardSnapshot()
  })
  ipcMain.handle(IPC_CHANNELS.refresh, () => discoveryService.refresh())
  ipcMain.handle(IPC_CHANNELS.setTriageState, (_event, id: unknown, state: unknown) => {
    const validated = triageInputSchema.parse({ id, state })
    repository.setTriageState(validated.id, validated.state)
    return repository.getDashboardSnapshot()
  })
}

function isSafeExternalUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1040,
    minHeight: 680,
    title: 'TheRSS',
    backgroundColor: '#f2eee5',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

app.whenReady().then(() => {
  const repository = new ResearchRepository(
    new Database(join(app.getPath('userData'), 'therss.sqlite'))
  )
  const discoveryService = new DiscoveryService(repository)
  registerIpcHandlers(repository, discoveryService)
  createWindow()

  app.once('before-quit', () => repository.close())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

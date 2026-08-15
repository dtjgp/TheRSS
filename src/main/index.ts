import { join } from 'node:path'
import { env } from 'node:process'
import Database from 'better-sqlite3'
import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron'
import { z } from 'zod'
import { AnalysisService } from '../core/analysis/analysisService'
import { DiscoveryService } from '../core/discovery/discoveryService'
import { interestProfileSchema } from '../core/interests/interestProfile'
import { ProviderService, type SecretCipher } from '../core/models/providerService'
import { ResearchRepository } from '../core/storage/researchRepository'
import { IPC_CHANNELS } from '../shared/ipc'
import { e2eAnalysis, e2ePaper, e2eRepository } from './e2eFixtures'

const triageInputSchema = z.object({
  id: z.string().trim().min(1).max(300),
  state: z.enum(['new', 'viewed', 'saved', 'dismissed'])
})

const itemIdSchema = z.string().trim().min(1).max(300)

class ElectronSecretCipher implements SecretCipher {
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  encrypt(value: string): Buffer {
    return safeStorage.encryptString(value)
  }

  decrypt(value: Buffer): string {
    return safeStorage.decryptString(value)
  }
}

function registerIpcHandlers(
  repository: ResearchRepository,
  discoveryService: DiscoveryService,
  providerService: ProviderService,
  analysisService: AnalysisService
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
  ipcMain.handle(IPC_CHANNELS.getModelProvider, () => providerService.getSummary())
  ipcMain.handle(IPC_CHANNELS.saveModelProvider, (_event, candidate: unknown) =>
    providerService.save(candidate)
  )
  ipcMain.handle(IPC_CHANNELS.analyzeItem, (_event, id: unknown) =>
    analysisService.analyzeItem(itemIdSchema.parse(id))
  )
  ipcMain.handle(IPC_CHANNELS.getLatestAnalysis, (_event, id: unknown) =>
    repository.getLatestAnalysis(itemIdSchema.parse(id))
  )
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
      preload: join(__dirname, '../preload/index.cjs'),
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
  const useE2eFixtures = env.THERSS_E2E_FIXTURES === '1'
  const discoveryService = new DiscoveryService(
    repository,
    useE2eFixtures
      ? {
          fetchArxiv: async () => [e2ePaper],
          fetchGitHub: async () => [e2eRepository]
        }
      : {}
  )
  const providerService = new ProviderService(repository, new ElectronSecretCipher())
  const analysisService = new AnalysisService(
    repository,
    providerService,
    useE2eFixtures ? e2eAnalysis : undefined
  )
  registerIpcHandlers(repository, discoveryService, providerService, analysisService)
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

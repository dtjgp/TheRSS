import { join } from 'node:path'
import { env } from 'node:process'
import Database from 'better-sqlite3'
import { app, BrowserWindow, ipcMain, Menu, safeStorage, shell } from 'electron'
import { z } from 'zod'
import { LocalAgentService } from '../core/agents/localAgentService'
import { AnalysisService } from '../core/analysis/analysisService'
import { DiscoverPlannerService } from '../core/discover/discoverPlanner'
import { DiscoverService } from '../core/discover/discoverService'
import { DiscoveryService } from '../core/discovery/discoveryService'
import { interestProfileSchema } from '../core/interests/interestProfile'
import { runPromptWithModel } from '../core/models/modelGateway'
import { ProviderService, type SecretCipher } from '../core/models/providerService'
import { ResearchRepository } from '../core/storage/researchRepository'
import { discoverSearchRequestSchema } from '../shared/discover'
import type { DiscoverySource } from '../shared/discovery'
import { IPC_CHANNELS } from '../shared/ipc'
import { isDiscoverySource } from '../shared/sourceIdentity'
import { createApplicationMenuTemplate } from './applicationMenu'
import {
  e2eAnalysis,
  e2eDiscoverConfiguredArticle,
  e2eDiscoverPaper,
  e2eDiscoverRepository,
  e2eConfiguredArticle,
  e2ePaper,
  e2eRepository
} from './e2eFixtures'
import { githubTokenFromEnvironment, huggingFaceTokenFromEnvironment } from './sourceCredentials'

const triageInputSchema = z.object({
  id: z.string().trim().min(1).max(300),
  state: z.enum(['new', 'viewed', 'saved', 'dismissed'])
})

const itemIdSchema = z.string().trim().min(1).max(300)
const discoverySourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(isDiscoverySource, 'Unknown or inactive source')
  .transform((source) => source as DiscoverySource)
const analysisInputSchema = z.object({
  id: itemIdSchema,
  runner: z.enum(['model-provider', 'codex', 'claude']).default('model-provider')
})
const discoverResultInputSchema = z
  .object({ sessionId: itemIdSchema, itemId: itemIdSchema })
  .strict()

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
  discoverService: DiscoverService,
  providerService: ProviderService,
  analysisService: AnalysisService,
  localAgentService: LocalAgentService
): void {
  ipcMain.handle(IPC_CHANNELS.getDashboard, () => repository.getDashboardSnapshot())
  ipcMain.handle(IPC_CHANNELS.getSourceContent, (_event, source: unknown) =>
    repository.getSourceContentSnapshot(discoverySourceSchema.parse(source))
  )
  ipcMain.handle(IPC_CHANNELS.refreshSourceContent, (_event, source: unknown) => {
    const githubToken = githubTokenFromEnvironment(env)
    const huggingFaceToken = huggingFaceTokenFromEnvironment(env)
    return discoveryService.refreshSourceContent(discoverySourceSchema.parse(source), {
      ...(githubToken ? { githubToken } : {}),
      ...(huggingFaceToken ? { huggingFaceToken } : {})
    })
  })
  ipcMain.handle(IPC_CHANNELS.getInterestProfile, () => repository.getInterestProfile())
  ipcMain.handle(IPC_CHANNELS.saveInterestProfile, (_event, candidate: unknown) => {
    repository.saveInterestProfile(interestProfileSchema.parse(candidate))
    return repository.getDashboardSnapshot()
  })
  ipcMain.handle(IPC_CHANNELS.refresh, () => {
    const githubToken = githubTokenFromEnvironment(env)
    const huggingFaceToken = huggingFaceTokenFromEnvironment(env)
    return discoveryService.refresh({
      ...(githubToken ? { githubToken } : {}),
      ...(huggingFaceToken ? { huggingFaceToken } : {})
    })
  })
  ipcMain.handle(IPC_CHANNELS.searchDiscover, (_event, candidate: unknown) => {
    const githubToken = githubTokenFromEnvironment(env)
    const huggingFaceToken = huggingFaceTokenFromEnvironment(env)
    return discoverService.search(discoverSearchRequestSchema.parse(candidate), {
      ...(githubToken ? { githubToken } : {}),
      ...(huggingFaceToken ? { huggingFaceToken } : {})
    })
  })
  ipcMain.handle(IPC_CHANNELS.getLatestDiscover, () => repository.getLatestDiscoverSnapshot())
  ipcMain.handle(IPC_CHANNELS.getAnalytics, () => repository.getAnalyticsSnapshot())
  ipcMain.handle(IPC_CHANNELS.saveDiscoverResult, (_event, sessionId: unknown, itemId: unknown) => {
    const validated = discoverResultInputSchema.parse({ sessionId, itemId })
    repository.saveDiscoverResult(validated.sessionId, validated.itemId)
    return repository.getDashboardSnapshot()
  })
  ipcMain.handle(IPC_CHANNELS.setTriageState, (_event, id: unknown, state: unknown) => {
    const validated = triageInputSchema.parse({ id, state })
    repository.setTriageState(validated.id, validated.state)
    return repository.getDashboardSnapshot()
  })
  ipcMain.handle(IPC_CHANNELS.getModelProvider, () => providerService.getSummary())
  ipcMain.handle(IPC_CHANNELS.saveModelProvider, (_event, candidate: unknown) =>
    providerService.save(candidate)
  )
  ipcMain.handle(IPC_CHANNELS.getLocalAgentStatuses, () => localAgentService.getStatuses())
  ipcMain.handle(IPC_CHANNELS.analyzeItem, (_event, id: unknown, runner: unknown) => {
    const validated = analysisInputSchema.parse({ id, runner })
    return analysisService.analyzeItem(validated.id, { runner: validated.runner })
  })
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
  const isMac = process.platform === 'darwin'
  const window = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 820,
    minHeight: 600,
    title: 'TheRSS',
    backgroundColor: isMac ? '#00000000' : '#f5f5f7',
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset' as const,
          vibrancy: 'sidebar' as const,
          visualEffectState: 'followWindow' as const
        }
      : {}),
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
  const database = new Database(join(app.getPath('userData'), 'therss.sqlite'))
  const repository = new ResearchRepository(database)
  const useE2eFixtures = env.THERSS_E2E_FIXTURES === '1'
  const discoveryService = new DiscoveryService(
    repository,
    useE2eFixtures
      ? {
          fetchArxiv: async () => [e2ePaper],
          fetchGitHub: async () => [e2eRepository],
          fetchConfiguredSource: async (definition) => ({
            items: definition.id === 'folo:302' ? [e2eConfiguredArticle] : [],
            rejectedCount: 0
          })
        }
      : undefined
  )
  const providerService = new ProviderService(repository, new ElectronSecretCipher())
  const localAgentService = new LocalAgentService(
    useE2eFixtures
      ? {
          resolveExecutable: async (runner) => `/fixture/${runner}`,
          execute: async () =>
            '## Research fit\nE2E local agent analysis passed.\n\n## Evidence boundary\nDiscovery metadata only.',
          workingDirectory: app.getPath('temp')
        }
      : { workingDirectory: app.getPath('temp') }
  )
  const fixturePlan = JSON.stringify({
    version: 'discover-plan-v1',
    intentSummary: 'Fixture semantic search for pruning-aware edge intelligence.',
    arxiv: {
      categories: ['cs.LG'],
      keywords: ['structured pruning', 'semantic communication'],
      excludeKeywords: []
    },
    github: {
      keywords: ['model compression'],
      topics: ['model-compression'],
      languages: ['Python']
    },
    rationale: 'Exercise bounded paper and repository expansion in the desktop fixture.'
  })
  const discoverPlanner = new DiscoverPlannerService({
    getModelProfile: useE2eFixtures
      ? () => ({
          id: 'fixture-provider',
          name: 'Fixture model',
          protocol: 'openai-compatible',
          baseUrl: 'https://fixture.invalid',
          model: 'fixture-model',
          hasCredential: false,
          updatedAt: '2026-08-16T00:00:00.000Z',
          apiKey: null
        })
      : providerService.getExecutionProfile.bind(providerService),
    planWithModel: useE2eFixtures
      ? async () => ({ content: fixturePlan, inputTokens: 20, outputTokens: 50 })
      : (prompt, profile) =>
          runPromptWithModel(prompt, profile, {
            systemPrompt:
              'You generate bounded academic search plans. Return one JSON object only and never claim retrieval.',
            maxTokens: 800
          }),
    planWithLocalAgent: useE2eFixtures
      ? async (_prompt, runner) => ({
          content: fixturePlan,
          providerId: `local-agent:${runner}`,
          providerName: runner === 'codex' ? 'Codex CLI' : 'Claude Code',
          model: runner === 'codex' ? 'codex-cli' : 'claude-code',
          inputTokens: null,
          outputTokens: null
        })
      : localAgentService.planDiscovery.bind(localAgentService)
  })
  const discoverService = new DiscoverService({
    planner: discoverPlanner,
    repository,
    ...(useE2eFixtures
      ? {
          fetchArxiv: async () => [e2eDiscoverPaper],
          fetchGitHub: async () => [e2eDiscoverRepository],
          fetchConfiguredSource: async (definition) => ({
            items: definition.id === 'folo:302' ? [e2eDiscoverConfiguredArticle] : [],
            rejectedCount: 0
          })
        }
      : {})
  })
  const analysisService = new AnalysisService(
    repository,
    providerService,
    useE2eFixtures ? e2eAnalysis : undefined,
    localAgentService.analyze.bind(localAgentService)
  )
  registerIpcHandlers(
    repository,
    discoveryService,
    discoverService,
    providerService,
    analysisService,
    localAgentService
  )
  createWindow()
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      createApplicationMenuTemplate((command) => {
        BrowserWindow.getFocusedWindow()?.webContents.send(IPC_CHANNELS.appCommand, command)
      }, process.platform === 'darwin')
    )
  )

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

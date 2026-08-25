import { join } from 'node:path'
import { env } from 'node:process'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  clipboard,
  Menu,
  safeStorage,
  screen,
  shell,
  systemPreferences
} from 'electron'
import { z } from 'zod'
import { resolveSystemAccentName } from '../core/appearance/systemAccent'
import { buildContextMenuTemplate, buildCopyPayload } from '../core/menus/contextMenu'
import { LocalAgentService } from '../core/agents/localAgentService'
import { AnalysisService } from '../core/analysis/analysisService'
import { DiscoverPlannerService } from '../core/discover/discoverPlanner'
import { DiscoverService } from '../core/discover/discoverService'
import { DiscoveryService } from '../core/discovery/discoveryService'
import { interestProfileSchema } from '../core/interests/interestProfile'
import { runPromptWithModel, testModelProviderConnection } from '../core/models/modelGateway'
import { ProviderService, type SecretCipher } from '../core/models/providerService'
import { ResearchRepository } from '../core/storage/researchRepository'
import { LlmWikiPromotionService } from '../core/integrations/llmWikiPromotionService'
import { LlmWikiVaultAdapter } from '../core/integrations/llmWikiVaultAdapter'
import { discoverSearchRequestSchema } from '../shared/discover'
import type { DiscoverySource } from '../shared/discovery'
import type { SystemAccentName } from '../shared/appearance'
import {
  contextMenuTargetSchema,
  isRendererContextMenuAction,
  type ContextMenuOutcome
} from '../shared/contextMenu'
import { IPC_CHANNELS } from '../shared/ipc'
import {
  LLM_WIKI_PROMOTION_PREVIEW_VERSION,
  LLM_WIKI_PROMOTION_PROMPT_VERSION,
  LLM_WIKI_PROMOTION_RECEIPT_VERSION,
  llmWikiPromotionConfirmRequestSchema,
  llmWikiPromotionPreviewRequestSchema
} from '../shared/llmWikiPromotion'
import { discoverPersonalizationPromptSchema } from '../shared/personalization'
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
import { createLlmWikiPromotionRuntime } from './llmWikiPromotionRuntime'
import { readWindowState, writeWindowState, type WindowBounds } from './windowState'

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
const discoverAnalysisInputSchema = discoverResultInputSchema.extend({
  runner: z.enum(['model-provider', 'codex', 'claude']).default('model-provider')
})
const settingsDirtySchema = z.boolean()
const dirtySettingsWindows = new WeakSet<Electron.WebContents>()

async function confirmDiscardSettings(window: BrowserWindow): Promise<boolean> {
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

/**
 * Only macOS and Windows expose an accent colour. Any failure resolves to null so the
 * renderer keeps its default blue rather than surfacing an appearance error.
 */
function readSystemAccent(): SystemAccentName | null {
  if (process.platform !== 'darwin' && process.platform !== 'win32') return null
  try {
    return resolveSystemAccentName(systemPreferences.getAccentColor())
  } catch {
    return null
  }
}

function registerIpcHandlers(
  repository: ResearchRepository,
  discoveryService: DiscoveryService,
  discoverService: DiscoverService,
  providerService: ProviderService,
  analysisService: AnalysisService,
  localAgentService: LocalAgentService,
  promotionService: LlmWikiPromotionService,
  useE2eFixtures: boolean
): void {
  ipcMain.handle(
    IPC_CHANNELS.showContextMenu,
    async (event, candidate: unknown): Promise<ContextMenuOutcome> => {
      const target = contextMenuTargetSchema.parse(candidate)
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) return { action: 'none' }

      // Every label and behaviour is derived here from the typed descriptor. The
      // renderer supplies data only, so no feed- or model-derived string can become
      // an executable menu command.
      return await new Promise<ContextMenuOutcome>((resolve) => {
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

        Menu.buildFromTemplate(template).popup({
          window,
          callback: () => resolve(outcome)
        })
      })
    }
  )
  ipcMain.handle(IPC_CHANNELS.getSystemAccent, () => readSystemAccent())
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
  ipcMain.handle(IPC_CHANNELS.testModelProvider, (_event, candidate: unknown) => {
    const profile = providerService.getConnectionTestProfile(candidate)
    return useE2eFixtures
      ? {
          status: 'connected' as const,
          message: `Fixture connection accepted ${profile.model} without a network request.`,
          testedAt: new Date().toISOString()
        }
      : testModelProviderConnection(profile)
  })
  ipcMain.handle(IPC_CHANNELS.clearModelProviderCredential, () => providerService.clearCredential())
  ipcMain.on(IPC_CHANNELS.setSettingsDirty, (event, candidate: unknown) => {
    const parsed = settingsDirtySchema.safeParse(candidate)
    if (!parsed.success) return
    if (parsed.data) dirtySettingsWindows.add(event.sender)
    else dirtySettingsWindows.delete(event.sender)
  })
  ipcMain.handle(IPC_CHANNELS.confirmDiscardSettings, async (event) => {
    if (!dirtySettingsWindows.has(event.sender)) return true
    if (useE2eFixtures) {
      dirtySettingsWindows.delete(event.sender)
      return true
    }
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window || window.isDestroyed()) return false
    const shouldDiscard = await confirmDiscardSettings(window)
    if (shouldDiscard) dirtySettingsWindows.delete(event.sender)
    return shouldDiscard
  })
  ipcMain.handle(IPC_CHANNELS.getDiscoverPersonalizationSettings, () =>
    repository.getDiscoverPersonalizationSettings()
  )
  ipcMain.handle(IPC_CHANNELS.saveDiscoverPersonalizationPrompt, (_event, candidate: unknown) =>
    repository.saveDiscoverPersonalizationPrompt(
      discoverPersonalizationPromptSchema.parse(candidate)
    )
  )
  ipcMain.handle(IPC_CHANNELS.getLocalAgentStatuses, () => localAgentService.getStatuses())
  ipcMain.handle(IPC_CHANNELS.analyzeItem, (_event, id: unknown, runner: unknown) => {
    const validated = analysisInputSchema.parse({ id, runner })
    return analysisService.analyzeItem(validated.id, { runner: validated.runner })
  })
  ipcMain.handle(
    IPC_CHANNELS.analyzeDiscoverResult,
    (_event, sessionId: unknown, itemId: unknown, runner: unknown) => {
      const validated = discoverAnalysisInputSchema.parse({ sessionId, itemId, runner })
      repository.materializeDiscoverResultForAnalysis(validated.sessionId, validated.itemId)
      return analysisService.analyzeItem(validated.itemId, { runner: validated.runner })
    }
  )
  ipcMain.handle(IPC_CHANNELS.getLatestAnalysis, (_event, id: unknown) =>
    repository.getLatestAnalysis(itemIdSchema.parse(id))
  )
  ipcMain.handle(IPC_CHANNELS.previewLlmWikiPromotion, (event, candidate: unknown) => {
    const validated = llmWikiPromotionPreviewRequestSchema.parse(candidate)
    if (validated.sessionId) {
      repository.materializeDiscoverResultForLlmWikiPromotion(validated.sessionId, validated.itemId)
    }
    return promotionService.preview(validated.itemId, String(event.sender.id))
  })
  ipcMain.handle(IPC_CHANNELS.confirmLlmWikiPromotion, async (event, candidate: unknown) => {
    const validated = llmWikiPromotionConfirmRequestSchema.parse(candidate)
    const ownerId = String(event.sender.id)
    if (!useE2eFixtures) {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window || window.isDestroyed()) {
        throw new Error('The promotion window is no longer available')
      }
      const choice = await dialog.showMessageBox(window, {
        type: 'warning',
        title: 'Confirm llm-wiki write',
        message: 'Write the previewed paper artifacts to your local llm-wiki vault?',
        detail:
          'TheRSS will create the verified PDF, paper record, analysis note, backlinks, indexes, log entry, and audit record shown in the preview.',
        buttons: ['Cancel', 'Write to llm-wiki'],
        cancelId: 0,
        defaultId: 1,
        noLink: true
      })
      if (choice.response !== 1) {
        return promotionService.cancel(validated.previewId, ownerId)
      }
    }
    return promotionService.confirm(validated.previewId, ownerId)
  })
  ipcMain.handle(IPC_CHANNELS.cancelLlmWikiPromotion, (event, candidate: unknown) => {
    const validated = llmWikiPromotionConfirmRequestSchema.parse(candidate)
    return promotionService.cancel(validated.previewId, String(event.sender.id))
  })
  ipcMain.handle(IPC_CHANNELS.getLatestLlmWikiPromotion, (_event, itemId: unknown) =>
    promotionService.getLatest(itemIdSchema.parse(itemId))
  )
}

function isSafeExternalUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

async function createWindow(useE2eFixtures: boolean): Promise<BrowserWindow> {
  const isMac = process.platform === 'darwin'
  const fallbackBounds: WindowBounds = { x: 80, y: 60, width: 1360, height: 880 }
  const statePath = join(app.getPath('userData'), 'window-state.json')
  const workAreas = screen.getAllDisplays().map((display) => display.workArea)
  const restoredState = await readWindowState(statePath, fallbackBounds, workAreas)
  const window = new BrowserWindow({
    ...restoredState.bounds,
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

  window.once('ready-to-show', () => {
    if (restoredState.maximized) window.maximize()
    window.show()
  })
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

  let stateSaveTimer: ReturnType<typeof setTimeout> | null = null
  const persistWindowState = () => {
    if (window.isDestroyed()) return
    if (stateSaveTimer) clearTimeout(stateSaveTimer)
    stateSaveTimer = setTimeout(() => {
      stateSaveTimer = null
      void writeWindowState(statePath, {
        bounds: window.getNormalBounds(),
        maximized: window.isMaximized()
      }).catch(() => undefined)
    }, 200)
  }
  window.on('move', persistWindowState)
  window.on('resize', persistWindowState)
  window.on('maximize', persistWindowState)
  window.on('unmaximize', persistWindowState)

  let allowClose = false
  let closePromptPending = false
  window.on('close', (event) => {
    if (allowClose || !dirtySettingsWindows.has(window.webContents)) return
    event.preventDefault()
    if (closePromptPending) return
    closePromptPending = true
    const decision = useE2eFixtures ? Promise.resolve(true) : confirmDiscardSettings(window)
    void decision
      .then((shouldDiscard) => {
        if (!shouldDiscard || window.isDestroyed()) return
        dirtySettingsWindows.delete(window.webContents)
        allowClose = true
        window.close()
      })
      .finally(() => {
        closePromptPending = false
      })
  })
  window.on('closed', () => {
    if (stateSaveTimer) clearTimeout(stateSaveTimer)
  })

  return window
}

app.whenReady().then(async () => {
  const database = new Database(join(app.getPath('userData'), 'therss.sqlite'))
  const repository = new ResearchRepository(database)
  repository.reconcileInterruptedLlmWikiPromotions()
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
    getPersonalizationPrompt: () => repository.getDiscoverPersonalizationSettings()?.prompt ?? null,
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
  const promotionAdapter = useE2eFixtures
    ? {
        prepare: async (
          item: Parameters<LlmWikiVaultAdapter['prepare']>[0],
          context: Parameters<LlmWikiVaultAdapter['prepare']>[1]
        ) => {
          const base = 'Fixture et al. - 2026 - Deterministic promotion fixture'
          const paths = [
            `raw/papers/${base}.pdf`,
            `raw/paper_records/${base}.md`,
            'Literature/Paper_Notes/L2_Structured/Model_Compression/Fixture_2026_DeterministicPromotion.md',
            'Topics/Edge_AI/Model_Compression/Structured_Pruning.md',
            'Literature/Paper_Notes/Paper_Notes_Index.md',
            'index.md',
            'log.md',
            'Automation_Conversations/2026-08-21__therss-paper-promotion__fixture.md'
          ]
          return {
            preview: {
              version: LLM_WIKI_PROMOTION_PREVIEW_VERSION,
              previewId: context.previewId,
              itemId: item.id,
              arxivId: item.externalId.replace(/v\d+$/u, ''),
              title: item.title,
              ready: true,
              vaultLabel: 'llm-wiki' as const,
              level: 'L2' as const,
              routingRationale: 'Deterministic Electron fixture route.',
              intendedPaths: paths,
              pdf: { pageCount: 12, byteSize: 120_000, sha256: 'd'.repeat(64) },
              evidenceBoundary: 'Fixture only; no real vault write or network call occurred.',
              blockers: [],
              sourceHash: '0'.repeat(64),
              contractHash: 'e'.repeat(64),
              expiresAt: context.expiresAt
            },
            opaqueHandle: { fixture: true }
          }
        },
        confirm: async (prepared: Parameters<LlmWikiVaultAdapter['confirm']>[0]) => ({
          version: LLM_WIKI_PROMOTION_RECEIPT_VERSION,
          id: `e2e:${randomUUID()}`,
          itemId: prepared.preview.itemId,
          arxivId: prepared.preview.arxivId,
          status: 'completed' as const,
          runner: 'codex' as const,
          promptVersion: LLM_WIKI_PROMOTION_PROMPT_VERSION,
          sourceHash: prepared.preview.sourceHash,
          contractHash: prepared.preview.contractHash,
          evidenceTier: 'full-text-verified' as const,
          summary: 'Deterministic fixture promotion completed without writing the real vault.',
          createdPaths: prepared.preview.intendedPaths.slice(0, 3),
          updatedPaths: prepared.preview.intendedPaths.slice(3, -1),
          pdfPath: prepared.preview.intendedPaths[0] ?? null,
          sidecarPath: prepared.preview.intendedPaths[1] ?? null,
          notePath: prepared.preview.intendedPaths[2] ?? null,
          auditPath: prepared.preview.intendedPaths.at(-1) ?? null,
          blockers: [],
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        }),
        dispose: async () => undefined
      }
    : new LlmWikiVaultAdapter(createLlmWikiPromotionRuntime())
  const promotionService = new LlmWikiPromotionService(repository, promotionAdapter)
  registerIpcHandlers(
    repository,
    discoveryService,
    discoverService,
    providerService,
    analysisService,
    localAgentService,
    promotionService,
    useE2eFixtures
  )
  await createWindow(useE2eFixtures)
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      createApplicationMenuTemplate((command) => {
        BrowserWindow.getFocusedWindow()?.webContents.send(IPC_CHANNELS.appCommand, command)
      }, process.platform === 'darwin')
    )
  )

  if (process.platform === 'darwin' || process.platform === 'win32') {
    systemPreferences.on('accent-color-changed', () => {
      const accent = readSystemAccent()
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(IPC_CHANNELS.systemAccentChanged, accent)
      }
    })
  }

  let shutdownStarted = false
  let shutdownCompleted = false
  app.on('before-quit', (event) => {
    if (shutdownCompleted) return
    event.preventDefault()
    if (shutdownStarted) return
    shutdownStarted = true
    void (async () => {
      const dirtyWindow = BrowserWindow.getAllWindows().find((window) =>
        dirtySettingsWindows.has(window.webContents)
      )
      const shouldQuit = dirtyWindow
        ? useE2eFixtures || (await confirmDiscardSettings(dirtyWindow))
        : true
      if (!shouldQuit) {
        shutdownStarted = false
        return
      }
      for (const window of BrowserWindow.getAllWindows()) {
        dirtySettingsWindows.delete(window.webContents)
      }
      await promotionService.disposeAll()
      repository.close()
      shutdownCompleted = true
      app.quit()
    })()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow(useE2eFixtures)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

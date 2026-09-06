import {
  attachAppKit,
  shouldUseAppKit,
  flushNativeInterface,
  dispatchNativeMenu,
  drainNativePreferences
} from './nativeAppKitRuntime'
import {
  WindowApplicationRuntime,
  dirtySettingsWindows,
  confirmDiscardSettings,
  isSafeExternalUrl
} from './windowApplicationRuntime'
import { attachNativeGlass } from './nativeGlassRuntime'
import { join } from 'node:path'
import { env } from 'node:process'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { app, BrowserWindow, Menu, safeStorage, screen, shell, systemPreferences } from 'electron'
import { resolveSystemAccentName } from '../core/appearance/systemAccent'
import { LocalAgentService } from '../core/agents/localAgentService'
import { AnalysisService } from '../core/analysis/analysisService'
import { DiscoverPlannerService } from '../core/discover/discoverPlanner'
import { DiscoverService } from '../core/discover/discoverService'
import { DiscoveryService } from '../core/discovery/discoveryService'
import { runPromptWithModel, testModelProviderConnection } from '../core/models/modelGateway'
import { ProviderService, type SecretCipher } from '../core/models/providerService'
import { ResearchRepository } from '../core/storage/researchRepository'
import { LlmWikiPromotionService } from '../core/integrations/llmWikiPromotionService'
import { LlmWikiVaultAdapter } from '../core/integrations/llmWikiVaultAdapter'
import type { SystemAccentName } from '../shared/appearance'
import {
  LLM_WIKI_PROMOTION_PREVIEW_VERSION,
  LLM_WIKI_PROMOTION_PROMPT_VERSION,
  LLM_WIKI_PROMOTION_RECEIPT_VERSION
} from '../shared/llmWikiPromotion'
import { createApplicationMenuTemplate } from './applicationMenu'
import {
  createE2eDiscoverFetchers,
  e2eAnalysis,
  e2eConfiguredArticle,
  e2ePaper,
  e2eRepository,
  waitForE2eDiscoverStage
} from './e2eFixtures'
import { githubTokenFromEnvironment, huggingFaceTokenFromEnvironment } from './sourceCredentials'
import { createLlmWikiPromotionRuntime } from './llmWikiPromotionRuntime'
import { readWindowState, writeWindowState, type WindowBounds } from './windowState'

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

async function createWindow(
  useE2eFixtures: boolean,
  applicationRuntime: WindowApplicationRuntime
): Promise<BrowserWindow> {
  const isMac = process.platform === 'darwin'
  const nativeUi = shouldUseAppKit()
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

  const application = applicationRuntime.bind(window)
  if (!nativeUi) attachNativeGlass(window, join(__dirname, '../native-glass/therss-glass.node'))

  if (!nativeUi)
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

  if (nativeUi) {
    await window.loadFile(join(__dirname, '../renderer/native-host.html'))
    await attachAppKit(window, application)
    if (restoredState.maximized) window.maximize()
    window.show()
  } else if (process.env.ELECTRON_RENDERER_URL) {
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
    flushNativeInterface(window)
    if (allowClose || !dirtySettingsWindows.has(window.webContents)) return
    event.preventDefault()
    if (closePromptPending) return
    closePromptPending = true
    const decision =
      useE2eFixtures && env.THERSS_E2E_NATIVE_DIALOGS !== '1'
        ? Promise.resolve(true)
        : confirmDiscardSettings(window)
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
  const delayE2eDiscover = useE2eFixtures && env.THERSS_E2E_DISCOVER_DELAY === '1'
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
      ? async () => {
          await waitForE2eDiscoverStage(delayE2eDiscover)
          return { content: fixturePlan, inputTokens: 20, outputTokens: 50 }
        }
      : (prompt, profile, signal) =>
          runPromptWithModel(prompt, profile, {
            systemPrompt:
              'You generate bounded academic search plans. Return one JSON object only and never claim retrieval.',
            maxTokens: 800,
            ...(signal ? { signal } : {})
          }),
    getPersonalizationPrompt: () => repository.getDiscoverPersonalizationSettings()?.prompt ?? null,
    planWithLocalAgent: useE2eFixtures
      ? async (_prompt, runner) => {
          await waitForE2eDiscoverStage(delayE2eDiscover)
          return {
            content: fixturePlan,
            providerId: `local-agent:${runner}`,
            providerName: runner === 'codex' ? 'Codex CLI' : 'Claude Code',
            model: runner === 'codex' ? 'codex-cli' : 'claude-code',
            inputTokens: null,
            outputTokens: null
          }
        }
      : localAgentService.planDiscovery.bind(localAgentService)
  })
  const discoverService = new DiscoverService({
    planner: discoverPlanner,
    repository,
    ...(useE2eFixtures ? createE2eDiscoverFetchers(delayE2eDiscover) : {})
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
  const applicationRuntime = new WindowApplicationRuntime(
    {
      repository,
      discovery: discoveryService,
      discover: discoverService,
      provider: providerService,
      analysis: analysisService,
      agents: localAgentService,
      promotion: promotionService,
      credentials: () => {
        const githubToken = githubTokenFromEnvironment(env)
        const huggingFaceToken = huggingFaceTokenFromEnvironment(env)
        return {
          ...(githubToken ? { githubToken } : {}),
          ...(huggingFaceToken ? { huggingFaceToken } : {})
        }
      },
      testProvider: async (profile) =>
        useE2eFixtures
          ? {
              status: 'connected',
              message: `Fixture connection accepted ${profile.model} without a network request.`,
              testedAt: new Date().toISOString()
            }
          : testModelProviderConnection(profile)
    },
    readSystemAccent,
    useE2eFixtures && env.THERSS_E2E_NATIVE_DIALOGS !== '1'
  )
  applicationRuntime.registerCompatibilityIpc()
  await createWindow(useE2eFixtures, applicationRuntime)
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      createApplicationMenuTemplate(
        (command) => {
          const targetWindow =
            BrowserWindow.getFocusedWindow() ??
            BrowserWindow.getAllWindows().find((window) => !window.isDestroyed())
          if (targetWindow) {
            flushNativeInterface(targetWindow)
            applicationRuntime.get(targetWindow)?.command(command)
          }
        },
        process.platform === 'darwin',
        shouldUseAppKit()
          ? (command) => {
              const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
              if (window) dispatchNativeMenu(window, command)
            }
          : undefined
      )
    )
  )

  if (process.platform === 'darwin' || process.platform === 'win32') {
    systemPreferences.on('accent-color-changed', () => {
      const accent = readSystemAccent()
      for (const window of BrowserWindow.getAllWindows()) {
        applicationRuntime.get(window)?.accentChanged(accent)
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
      BrowserWindow.getAllWindows().forEach(flushNativeInterface)
      const dirtyWindow = BrowserWindow.getAllWindows().find((window) =>
        dirtySettingsWindows.has(window.webContents)
      )
      const shouldQuit = dirtyWindow
        ? (useE2eFixtures && env.THERSS_E2E_NATIVE_DIALOGS !== '1') ||
          (await confirmDiscardSettings(dirtyWindow))
        : true
      if (!shouldQuit) {
        shutdownStarted = false
        return
      }
      for (const window of BrowserWindow.getAllWindows()) {
        dirtySettingsWindows.delete(window.webContents)
      }
      await drainNativePreferences()
      await applicationRuntime.shutdown()
      await promotionService.disposeAll()
      repository.close()
      shutdownCompleted = true
      app.quit()
    })()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow(useE2eFixtures, applicationRuntime)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

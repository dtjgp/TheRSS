import { contextBridge, ipcRenderer } from 'electron'
import type { TheRSSApi } from '../shared/api'
import { IPC_CHANNELS, isAppCommand } from '../shared/ipc'
import { isSystemAccentName } from '../shared/appearance'
import type { DiscoverRunProgress } from '../shared/discover'

const DISCOVER_RUN_ID_PATTERN = /^[A-Za-z0-9:_-]{1,100}$/u
const DISCOVER_PROGRESS_PHASES = new Set(['planning', 'searching', 'cancel_requested'])
const DISCOVER_SOURCE_STATUSES = new Set([
  'not_searched',
  'healthy',
  'partial',
  'no_results',
  'failed',
  'canceled'
])

function assertDiscoverRunId(value: string): string {
  if (!DISCOVER_RUN_ID_PATTERN.test(value)) throw new Error('Invalid Discover run ID')
  return value
}

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
  )
}

function parseDiscoverProgress(value: unknown): DiscoverRunProgress | null {
  if (typeof value !== 'object' || value === null) return null
  const progress = value as Record<string, unknown>
  if (
    typeof progress.runId !== 'string' ||
    !DISCOVER_RUN_ID_PATTERN.test(progress.runId) ||
    typeof progress.phase !== 'string' ||
    !DISCOVER_PROGRESS_PHASES.has(progress.phase) ||
    !isBoundedInteger(progress.completedSources, 0, 22) ||
    !isBoundedInteger(progress.totalSources, 1, 22) ||
    progress.completedSources > progress.totalSources
  ) {
    return null
  }
  if (progress.source === null && progress.outcome === null) {
    return progress as unknown as DiscoverRunProgress
  }
  if (
    typeof progress.source !== 'string' ||
    typeof progress.outcome !== 'object' ||
    progress.outcome === null
  ) {
    return null
  }
  const outcome = progress.outcome as Record<string, unknown>
  if (
    typeof outcome.status !== 'string' ||
    !DISCOVER_SOURCE_STATUSES.has(outcome.status) ||
    !isBoundedInteger(outcome.resultCount, 0, 100) ||
    (outcome.error !== null && typeof outcome.error !== 'string')
  ) {
    return null
  }
  return progress as unknown as DiscoverRunProgress
}

const api: TheRSSApi = {
  onAppCommand: (listener) => {
    const handleCommand = (_event: Electron.IpcRendererEvent, command: unknown) => {
      if (isAppCommand(command)) listener(command)
    }
    ipcRenderer.on(IPC_CHANNELS.appCommand, handleCommand)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.appCommand, handleCommand)
  },
  showContextMenu: (target) => ipcRenderer.invoke(IPC_CHANNELS.showContextMenu, target),
  getSystemAccent: () => ipcRenderer.invoke(IPC_CHANNELS.getSystemAccent),
  onSystemAccentChange: (listener) => {
    const handleAccent = (_event: Electron.IpcRendererEvent, accent: unknown) => {
      listener(isSystemAccentName(accent) ? accent : null)
    }
    ipcRenderer.on(IPC_CHANNELS.systemAccentChanged, handleAccent)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.systemAccentChanged, handleAccent)
  },
  getDashboard: () => ipcRenderer.invoke(IPC_CHANNELS.getDashboard),
  getSourceContent: (source) => ipcRenderer.invoke(IPC_CHANNELS.getSourceContent, source),
  refreshSourceContent: (source) => ipcRenderer.invoke(IPC_CHANNELS.refreshSourceContent, source),
  getInterestProfile: () => ipcRenderer.invoke(IPC_CHANNELS.getInterestProfile),
  saveInterestProfile: (profile) => ipcRenderer.invoke(IPC_CHANNELS.saveInterestProfile, profile),
  refresh: () => ipcRenderer.invoke(IPC_CHANNELS.refresh),
  searchLocal: (query) => ipcRenderer.invoke(IPC_CHANNELS.searchLocal, query),
  onDiscoverProgress: (listener) => {
    const handleProgress = (_event: Electron.IpcRendererEvent, progress: unknown) => {
      const parsed = parseDiscoverProgress(progress)
      if (parsed) listener(parsed)
    }
    ipcRenderer.on(IPC_CHANNELS.discoverProgress, handleProgress)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.discoverProgress, handleProgress)
  },
  searchDiscover: (request, runId) =>
    ipcRenderer.invoke(IPC_CHANNELS.searchDiscover, request, assertDiscoverRunId(runId)),
  retryDiscover: (sessionId, sources, runId) =>
    ipcRenderer.invoke(IPC_CHANNELS.retryDiscover, sessionId, sources, assertDiscoverRunId(runId)),
  cancelDiscover: (runId) =>
    ipcRenderer.invoke(IPC_CHANNELS.cancelDiscover, assertDiscoverRunId(runId)),
  getLatestDiscover: () => ipcRenderer.invoke(IPC_CHANNELS.getLatestDiscover),
  getAnalytics: () => ipcRenderer.invoke(IPC_CHANNELS.getAnalytics),
  saveDiscoverResult: (sessionId, itemId) =>
    ipcRenderer.invoke(IPC_CHANNELS.saveDiscoverResult, sessionId, itemId),
  setTriageState: (id, state) => ipcRenderer.invoke(IPC_CHANNELS.setTriageState, id, state),
  getModelProvider: () => ipcRenderer.invoke(IPC_CHANNELS.getModelProvider),
  saveModelProvider: (input) => ipcRenderer.invoke(IPC_CHANNELS.saveModelProvider, input),
  testModelProvider: (input) => ipcRenderer.invoke(IPC_CHANNELS.testModelProvider, input),
  clearModelProviderCredential: () => ipcRenderer.invoke(IPC_CHANNELS.clearModelProviderCredential),
  setSettingsDirty: (isDirty) => ipcRenderer.send(IPC_CHANNELS.setSettingsDirty, isDirty),
  confirmDiscardSettings: () => ipcRenderer.invoke(IPC_CHANNELS.confirmDiscardSettings),
  getDiscoverPersonalizationSettings: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getDiscoverPersonalizationSettings),
  saveDiscoverPersonalizationPrompt: (prompt) =>
    ipcRenderer.invoke(IPC_CHANNELS.saveDiscoverPersonalizationPrompt, prompt),
  getLocalAgentStatuses: () => ipcRenderer.invoke(IPC_CHANNELS.getLocalAgentStatuses),
  analyzeItem: (id, runner) => ipcRenderer.invoke(IPC_CHANNELS.analyzeItem, id, runner),
  analyzeDiscoverResult: (sessionId, itemId, runner) =>
    ipcRenderer.invoke(IPC_CHANNELS.analyzeDiscoverResult, sessionId, itemId, runner),
  getLatestAnalysis: (id) => ipcRenderer.invoke(IPC_CHANNELS.getLatestAnalysis, id),
  getAnalysisArtifact: (analysisId) =>
    ipcRenderer.invoke(IPC_CHANNELS.getAnalysisArtifact, analysisId),
  previewLlmWikiPromotion: (itemId, sessionId) =>
    ipcRenderer.invoke(IPC_CHANNELS.previewLlmWikiPromotion, { itemId, sessionId }),
  confirmLlmWikiPromotion: (previewId) =>
    ipcRenderer.invoke(IPC_CHANNELS.confirmLlmWikiPromotion, { previewId }),
  cancelLlmWikiPromotion: (previewId) =>
    ipcRenderer.invoke(IPC_CHANNELS.cancelLlmWikiPromotion, { previewId }),
  getLatestLlmWikiPromotion: (itemId) =>
    ipcRenderer.invoke(IPC_CHANNELS.getLatestLlmWikiPromotion, itemId)
}

contextBridge.exposeInMainWorld('therss', api)

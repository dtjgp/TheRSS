import { contextBridge, ipcRenderer } from 'electron'
import type { TheRSSApi } from '../shared/api'
import { IPC_CHANNELS, isAppCommand } from '../shared/ipc'

const api: TheRSSApi = {
  onAppCommand: (listener) => {
    const handleCommand = (_event: Electron.IpcRendererEvent, command: unknown) => {
      if (isAppCommand(command)) listener(command)
    }
    ipcRenderer.on(IPC_CHANNELS.appCommand, handleCommand)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.appCommand, handleCommand)
  },
  getDashboard: () => ipcRenderer.invoke(IPC_CHANNELS.getDashboard),
  getSourceContent: (source) => ipcRenderer.invoke(IPC_CHANNELS.getSourceContent, source),
  refreshSourceContent: (source) => ipcRenderer.invoke(IPC_CHANNELS.refreshSourceContent, source),
  getInterestProfile: () => ipcRenderer.invoke(IPC_CHANNELS.getInterestProfile),
  saveInterestProfile: (profile) => ipcRenderer.invoke(IPC_CHANNELS.saveInterestProfile, profile),
  refresh: () => ipcRenderer.invoke(IPC_CHANNELS.refresh),
  searchDiscover: (request) => ipcRenderer.invoke(IPC_CHANNELS.searchDiscover, request),
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

import { contextBridge, ipcRenderer } from 'electron'
import type { TheRSSApi } from '../shared/api'
import { IPC_CHANNELS } from '../shared/ipc'

const api: TheRSSApi = {
  getDashboard: () => ipcRenderer.invoke(IPC_CHANNELS.getDashboard),
  getInterestProfile: () => ipcRenderer.invoke(IPC_CHANNELS.getInterestProfile),
  saveInterestProfile: (profile) => ipcRenderer.invoke(IPC_CHANNELS.saveInterestProfile, profile),
  refresh: () => ipcRenderer.invoke(IPC_CHANNELS.refresh),
  setTriageState: (id, state) => ipcRenderer.invoke(IPC_CHANNELS.setTriageState, id, state),
  getModelProvider: () => ipcRenderer.invoke(IPC_CHANNELS.getModelProvider),
  saveModelProvider: (input) => ipcRenderer.invoke(IPC_CHANNELS.saveModelProvider, input),
  analyzeItem: (id) => ipcRenderer.invoke(IPC_CHANNELS.analyzeItem, id),
  getLatestAnalysis: (id) => ipcRenderer.invoke(IPC_CHANNELS.getLatestAnalysis, id)
}

contextBridge.exposeInMainWorld('therss', api)

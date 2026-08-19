export const APP_COMMANDS = [
  'open-settings',
  'show-today',
  'show-saved',
  'show-discover',
  'toggle-sidebar',
  'refresh-sources',
  'save-selected',
  'dismiss-selected',
  'analyze-selected',
  'undo-triage'
] as const

export type AppCommand = (typeof APP_COMMANDS)[number]

export function isAppCommand(value: unknown): value is AppCommand {
  return typeof value === 'string' && APP_COMMANDS.some((command) => command === value)
}

export const IPC_CHANNELS = {
  appCommand: 'app:command',
  getDashboard: 'dashboard:get',
  getSourceContent: 'sources:get-content',
  refreshSourceContent: 'sources:refresh-content',
  refresh: 'dashboard:refresh',
  searchDiscover: 'discover:search',
  getLatestDiscover: 'discover:get-latest',
  getAnalytics: 'analytics:get',
  saveDiscoverResult: 'discover:save-result',
  getInterestProfile: 'interests:get',
  saveInterestProfile: 'interests:save',
  setTriageState: 'triage:set',
  getModelProvider: 'models:get-provider',
  saveModelProvider: 'models:save-provider',
  getLocalAgentStatuses: 'agents:get-statuses',
  analyzeItem: 'analysis:run',
  getLatestAnalysis: 'analysis:get-latest'
} as const

export const APP_COMMANDS = [
  'open-settings',
  'show-saved',
  'show-discover',
  'toggle-sidebar',
  'save-selected',
  'dismiss-selected',
  'analyze-selected',
  'undo-triage',
  'open-help'
] as const

export type AppCommand = (typeof APP_COMMANDS)[number]

export function isAppCommand(value: unknown): value is AppCommand {
  return typeof value === 'string' && APP_COMMANDS.some((command) => command === value)
}

export const IPC_CHANNELS = {
  appCommand: 'app:command',
  getSystemAccent: 'appearance:get-system-accent',
  systemAccentChanged: 'appearance:system-accent-changed',
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
  testModelProvider: 'models:test-provider',
  clearModelProviderCredential: 'models:clear-provider-credential',
  setSettingsDirty: 'settings:set-dirty',
  confirmDiscardSettings: 'settings:confirm-discard',
  getDiscoverPersonalizationSettings: 'models:get-discover-personalization',
  saveDiscoverPersonalizationPrompt: 'models:save-discover-personalization',
  getLocalAgentStatuses: 'agents:get-statuses',
  analyzeItem: 'analysis:run',
  analyzeDiscoverResult: 'analysis:run-discover-result',
  getLatestAnalysis: 'analysis:get-latest',
  previewLlmWikiPromotion: 'llm-wiki-promotion:preview',
  confirmLlmWikiPromotion: 'llm-wiki-promotion:confirm',
  cancelLlmWikiPromotion: 'llm-wiki-promotion:cancel',
  getLatestLlmWikiPromotion: 'llm-wiki-promotion:get-latest'
} as const

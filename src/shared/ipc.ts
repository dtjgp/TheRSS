export const IPC_CHANNELS = {
  getDashboard: 'dashboard:get',
  refresh: 'dashboard:refresh',
  getInterestProfile: 'interests:get',
  saveInterestProfile: 'interests:save',
  setTriageState: 'triage:set',
  getModelProvider: 'models:get-provider',
  saveModelProvider: 'models:save-provider',
  analyzeItem: 'analysis:run',
  getLatestAnalysis: 'analysis:get-latest'
} as const

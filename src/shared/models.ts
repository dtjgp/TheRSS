export type ModelProtocol = 'openai-compatible' | 'anthropic-compatible'
export type AnalysisRunner = 'model-provider' | 'codex' | 'claude'
export type LocalAgentRunner = Exclude<AnalysisRunner, 'model-provider'>

export interface LocalAgentStatus {
  readonly runner: LocalAgentRunner
  readonly label: string
  readonly available: boolean
}

export interface ModelProviderInput {
  readonly name: string
  readonly protocol: ModelProtocol
  readonly baseUrl: string
  readonly model: string
  readonly apiKey?: string | undefined
}

export interface ModelProviderSummary {
  readonly id: string
  readonly name: string
  readonly protocol: ModelProtocol
  readonly baseUrl: string
  readonly model: string
  readonly hasCredential: boolean
  readonly updatedAt: string
}

export interface AnalysisArtifact {
  readonly id: string
  readonly itemId: string
  readonly providerId: string
  readonly providerName: string
  readonly model: string
  readonly promptVersion: string
  readonly sourceHash: string
  readonly content: string
  readonly createdAt: string
}

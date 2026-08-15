export type ModelProtocol = 'openai-compatible' | 'anthropic-compatible'

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

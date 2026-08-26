import { randomUUID } from 'node:crypto'
import type {
  AnalysisArtifact,
  AnalysisArtifactState,
  AnalysisRunner,
  LocalAgentRunner
} from '../../shared/models'
import type { LocalAgentAnalysisResponse } from '../agents/localAgentService'
import {
  analysisPromptVersionFor,
  analyzeWithModel,
  type ModelAnalysisResponse
} from '../models/modelGateway'
import type { ModelExecutionProfile, ProviderService } from '../models/providerService'
import type { ResearchRepository } from '../storage/researchRepository'
import type { DashboardItem } from '../../shared/api'
import { hashAnalysisSource } from './sourceSnapshot'

type AnalysisGateway = (
  item: DashboardItem,
  profile: ModelExecutionProfile
) => Promise<ModelAnalysisResponse>

interface AnalyzeOptions {
  readonly runner?: AnalysisRunner
  readonly now?: Date
  readonly idFactory?: () => string
}

type LocalAgentGateway = (
  item: DashboardItem,
  runner: LocalAgentRunner
) => Promise<LocalAgentAnalysisResponse>

export class AnalysisService {
  readonly #repository: ResearchRepository
  readonly #providers: ProviderService
  readonly #gateway: AnalysisGateway
  readonly #localAgentGateway: LocalAgentGateway | null

  constructor(
    repository: ResearchRepository,
    providers: ProviderService,
    gateway: AnalysisGateway = analyzeWithModel,
    localAgentGateway: LocalAgentGateway | null = null
  ) {
    this.#repository = repository
    this.#providers = providers
    this.#gateway = gateway
    this.#localAgentGateway = localAgentGateway
  }

  async analyzeItem(itemId: string, options: AnalyzeOptions = {}): Promise<AnalysisArtifact> {
    const item = this.#repository.getDiscoveryItem(itemId)
    if (!item) throw new Error(`Unknown discovery item: ${itemId}`)

    const runner = options.runner ?? 'model-provider'
    let response: ModelAnalysisResponse | LocalAgentAnalysisResponse
    let providerId: string
    let providerName: string
    let model: string
    if (runner === 'model-provider') {
      const provider = this.#providers.getExecutionProfile()
      response = await this.#gateway(item, provider)
      providerId = provider.id
      providerName = provider.name
      model = provider.model
    } else {
      if (!this.#localAgentGateway) throw new Error('Local agent analysis is unavailable')
      const localResponse = await this.#localAgentGateway(item, runner)
      response = localResponse
      providerId = localResponse.providerId
      providerName = localResponse.providerName
      model = localResponse.model
    }
    const artifact: AnalysisArtifact = {
      id: (options.idFactory ?? randomUUID)(),
      itemId,
      providerId,
      providerName,
      model,
      promptVersion: analysisPromptVersionFor(item),
      sourceHash: hashAnalysisSource(item),
      content: response.content,
      createdAt: (options.now ?? new Date()).toISOString()
    }
    this.#repository.saveAnalysis(artifact, response)
    return artifact
  }

  async getAnalysisArtifact(analysisId: string): Promise<AnalysisArtifactState | null> {
    const artifact = this.#repository.getAnalysisArtifact(analysisId)
    if (!artifact) return null
    if (artifact.sourceHash === 'legacy-unavailable') {
      return { artifact, freshness: 'legacy_unavailable', currentSourceHash: null }
    }
    const item = this.#repository.getDiscoveryItem(artifact.itemId)
    if (!item) return { artifact, freshness: 'source_missing', currentSourceHash: null }
    const currentSourceHash = hashAnalysisSource(item)
    return {
      artifact,
      freshness: currentSourceHash === artifact.sourceHash ? 'current' : 'stale',
      currentSourceHash
    }
  }
}

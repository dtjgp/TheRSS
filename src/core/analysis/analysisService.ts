import { randomUUID } from 'node:crypto'
import type { AnalysisArtifact } from '../../shared/models'
import { analyzeWithModel, type ModelAnalysisResponse } from '../models/modelGateway'
import type { ModelExecutionProfile, ProviderService } from '../models/providerService'
import type { ResearchRepository } from '../storage/researchRepository'
import type { DashboardItem } from '../../shared/api'

const PROMPT_VERSION = 'discovery-analysis-v1'

type AnalysisGateway = (
  item: DashboardItem,
  profile: ModelExecutionProfile
) => Promise<ModelAnalysisResponse>

interface AnalyzeOptions {
  readonly now?: Date
  readonly idFactory?: () => string
}

export class AnalysisService {
  readonly #repository: ResearchRepository
  readonly #providers: ProviderService
  readonly #gateway: AnalysisGateway

  constructor(
    repository: ResearchRepository,
    providers: ProviderService,
    gateway: AnalysisGateway = analyzeWithModel
  ) {
    this.#repository = repository
    this.#providers = providers
    this.#gateway = gateway
  }

  async analyzeItem(itemId: string, options: AnalyzeOptions = {}): Promise<AnalysisArtifact> {
    const item = this.#repository.getDiscoveryItem(itemId)
    if (!item) throw new Error(`Unknown discovery item: ${itemId}`)

    const provider = this.#providers.getExecutionProfile()
    const response = await this.#gateway(item, provider)
    const artifact: AnalysisArtifact = {
      id: (options.idFactory ?? randomUUID)(),
      itemId,
      providerId: provider.id,
      providerName: provider.name,
      model: provider.model,
      promptVersion: PROMPT_VERSION,
      content: response.content,
      createdAt: (options.now ?? new Date()).toISOString()
    }
    this.#repository.saveAnalysis(artifact, response)
    return artifact
  }
}

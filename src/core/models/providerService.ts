import { z } from 'zod'
import { validateProviderBaseUrl } from '../security/providerUrl'
import type { ResearchRepository, StoredModelProvider } from '../storage/researchRepository'
import type { ModelProviderSummary } from '../../shared/models'

export interface SecretCipher {
  isAvailable(): boolean
  encrypt(value: string): Buffer
  decrypt(value: Buffer): string
}

export interface ModelExecutionProfile extends ModelProviderSummary {
  readonly apiKey: string | null
}

const providerInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  protocol: z.enum(['openai-compatible', 'anthropic-compatible']),
  baseUrl: z.string().trim().min(1).max(2_000).transform(validateProviderBaseUrl),
  model: z.string().trim().min(1).max(200),
  apiKey: z.string().trim().max(20_000).optional()
})

function toSummary(provider: StoredModelProvider): ModelProviderSummary {
  return {
    id: provider.id,
    name: provider.name,
    protocol: provider.protocol,
    baseUrl: provider.baseUrl,
    model: provider.model,
    hasCredential: provider.secretCiphertext !== null,
    updatedAt: provider.updatedAt
  }
}

export class ProviderService {
  readonly #repository: ResearchRepository
  readonly #cipher: SecretCipher

  constructor(repository: ResearchRepository, cipher: SecretCipher) {
    this.#repository = repository
    this.#cipher = cipher
  }

  save(input: unknown, updatedAt = new Date().toISOString()): ModelProviderSummary {
    const validated = providerInputSchema.parse(input)
    const apiKey = validated.apiKey || undefined
    if (apiKey && !this.#cipher.isAvailable()) {
      throw new Error('OS-backed credential encryption is unavailable')
    }

    const provider = this.#repository.saveModelProvider(
      {
        id: 'default',
        name: validated.name,
        protocol: validated.protocol,
        baseUrl: validated.baseUrl,
        model: validated.model,
        updatedAt
      },
      apiKey ? this.#cipher.encrypt(apiKey) : undefined
    )
    return toSummary(provider)
  }

  getSummary(): ModelProviderSummary | null {
    const provider = this.#repository.getModelProvider()
    return provider ? toSummary(provider) : null
  }

  getExecutionProfile(): ModelExecutionProfile {
    const provider = this.#repository.getModelProvider()
    if (!provider) throw new Error('Configure a model provider first')

    return {
      ...toSummary(provider),
      apiKey: provider.secretCiphertext ? this.#cipher.decrypt(provider.secretCiphertext) : null
    }
  }
}

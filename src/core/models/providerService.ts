import { z } from 'zod'
import { validateProviderBaseUrl } from '../security/providerUrl'
import type { ResearchRepository, StoredModelProvider } from '../storage/researchRepository'
import type { ModelProviderSummary } from '../../shared/models'

/** OS-backed encryption for provider credentials; Electron exposes it only asynchronously. */
export interface SecretCipher {
  isAvailable(): Promise<boolean>
  encrypt(value: string): Promise<Buffer>
  decrypt(value: Buffer): Promise<string>
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

function hasSameCredentialScope(
  existing: StoredModelProvider | null,
  candidate: { readonly protocol: ModelExecutionProfile['protocol']; readonly baseUrl: string }
): boolean {
  return existing?.protocol === candidate.protocol && existing.baseUrl === candidate.baseUrl
}

export class ProviderService {
  readonly #repository: ResearchRepository
  readonly #cipher: SecretCipher

  constructor(repository: ResearchRepository, cipher: SecretCipher) {
    this.#repository = repository
    this.#cipher = cipher
  }

  async save(input: unknown, updatedAt = new Date().toISOString()): Promise<ModelProviderSummary> {
    const validated = providerInputSchema.parse(input)
    const apiKey = validated.apiKey || undefined
    const existing = this.#repository.getModelProvider()
    if (existing?.secretCiphertext && !apiKey && !hasSameCredentialScope(existing, validated)) {
      throw new Error(
        'Enter a replacement credential or clear the protected credential before changing provider protocol or endpoint'
      )
    }
    if (apiKey && !(await this.#cipher.isAvailable())) {
      throw new Error('OS-backed credential encryption is unavailable')
    }
    const ciphertext = apiKey ? await this.#cipher.encrypt(apiKey) : undefined

    const provider = this.#repository.saveModelProvider(
      {
        id: 'default',
        name: validated.name,
        protocol: validated.protocol,
        baseUrl: validated.baseUrl,
        model: validated.model,
        updatedAt
      },
      ciphertext
    )
    return toSummary(provider)
  }

  getSummary(): ModelProviderSummary | null {
    const provider = this.#repository.getModelProvider()
    return provider ? toSummary(provider) : null
  }

  clearCredential(updatedAt = new Date().toISOString()): ModelProviderSummary {
    return toSummary(this.#repository.clearModelProviderCredential('default', updatedAt))
  }

  async getConnectionTestProfile(input: unknown): Promise<ModelExecutionProfile> {
    const validated = providerInputSchema.parse(input)
    const existing = this.#repository.getModelProvider()
    const replacementKey = validated.apiKey || null
    const existingKey =
      hasSameCredentialScope(existing, validated) && existing?.secretCiphertext
        ? await this.#cipher.decrypt(existing.secretCiphertext)
        : null
    const apiKey = replacementKey ?? existingKey

    return {
      id: existing?.id ?? 'default',
      name: validated.name,
      protocol: validated.protocol,
      baseUrl: validated.baseUrl,
      model: validated.model,
      hasCredential: apiKey !== null,
      updatedAt: existing?.updatedAt ?? new Date().toISOString(),
      apiKey
    }
  }

  async getExecutionProfile(): Promise<ModelExecutionProfile> {
    const provider = this.#repository.getModelProvider()
    if (!provider) throw new Error('Configure a model provider first')

    return {
      ...toSummary(provider),
      apiKey: provider.secretCiphertext
        ? await this.#cipher.decrypt(provider.secretCiphertext)
        : null
    }
  }
}

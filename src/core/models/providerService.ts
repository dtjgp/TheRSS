import { z } from 'zod'
import { validateProviderBaseUrl } from '../security/providerUrl'
import type { ResearchRepository, StoredModelProvider } from '../storage/researchRepository'
import type { ModelProviderSummary } from '../../shared/models'

/** A decrypted credential; `shouldReEncrypt` means the OS key changed since encryption. */
export interface DecryptedSecret {
  readonly value: string
  readonly shouldReEncrypt: boolean
}

/** OS-backed encryption for provider credentials; Electron exposes it only asynchronously. */
export interface SecretCipher {
  isAvailable(): Promise<boolean>
  encrypt(value: string): Promise<Buffer>
  decrypt(value: Buffer): Promise<DecryptedSecret>
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

const providerId = 'default'

export class ProviderService {
  readonly #repository: ResearchRepository
  readonly #cipher: SecretCipher
  /** Credential writes for the single provider run in call order, so the last call wins. */
  #credentialWrites: Promise<unknown> = Promise.resolve()

  constructor(repository: ResearchRepository, cipher: SecretCipher) {
    this.#repository = repository
    this.#cipher = cipher
  }

  async save(input: unknown, updatedAt = new Date().toISOString()): Promise<ModelProviderSummary> {
    const validated = providerInputSchema.parse(input)
    return this.#serializeCredentialWrite(() => this.#save(validated, updatedAt))
  }

  async #save(
    validated: z.infer<typeof providerInputSchema>,
    updatedAt: string
  ): Promise<ModelProviderSummary> {
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
        id: providerId,
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

  clearCredential(updatedAt = new Date().toISOString()): Promise<ModelProviderSummary> {
    return this.#serializeCredentialWrite(() =>
      toSummary(this.#repository.clearModelProviderCredential(providerId, updatedAt))
    )
  }

  async getConnectionTestProfile(input: unknown): Promise<ModelExecutionProfile> {
    const validated = providerInputSchema.parse(input)
    const existing = this.#repository.getModelProvider()
    const replacementKey = validated.apiKey || null
    const existingKey =
      hasSameCredentialScope(existing, validated) && existing?.secretCiphertext
        ? await this.#readCredential(existing.secretCiphertext)
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
        ? await this.#readCredential(provider.secretCiphertext)
        : null
    }
  }

  async #readCredential(ciphertext: Buffer): Promise<string> {
    const { value, shouldReEncrypt } = await this.#cipher.decrypt(ciphertext)
    if (shouldReEncrypt) await this.#reEncrypt(ciphertext, value)
    return value
  }

  /**
   * Moves the credential to the current OS key. The swap fails closed when a clear or a new key
   * reached the row first. On failure the old ciphertext stays valid and the next read retries.
   */
  async #reEncrypt(previous: Buffer, value: string): Promise<void> {
    try {
      await this.#serializeCredentialWrite(async () => {
        const replacement = await this.#cipher.encrypt(value)
        this.#repository.replaceModelProviderCredential(providerId, previous, replacement)
      })
    } catch {
      // Silent by design: no log may carry the credential, and the read must still succeed.
    }
  }

  #serializeCredentialWrite<T>(operation: () => T | Promise<T>): Promise<T> {
    const write = this.#credentialWrites.then(() => operation())
    this.#credentialWrites = write.catch(() => undefined)
    return write
  }
}

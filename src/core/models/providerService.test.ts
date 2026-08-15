import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { ResearchRepository } from '../storage/researchRepository'
import { ProviderService, type SecretCipher } from './providerService'

const placeholderCredential = ['test', 'credential'].join('-')
const existingPlaceholder = ['existing', 'placeholder'].join('-')

class FakeSecretCipher implements SecretCipher {
  constructor(private readonly available = true) {}

  isAvailable(): boolean {
    return this.available
  }

  encrypt(value: string): Buffer {
    return Buffer.from(`encrypted:${value}`, 'utf8')
  }

  decrypt(value: Buffer): string {
    return value.toString('utf8').replace(/^encrypted:/, '')
  }
}

describe('ProviderService', () => {
  it('stores only encrypted credentials and returns non-secret settings', () => {
    const database = new Database(':memory:')
    const repository = new ResearchRepository(database)
    const service = new ProviderService(repository, new FakeSecretCipher())

    const summary = service.save(
      {
        name: 'DeepSeek',
        protocol: 'openai-compatible',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-chat',
        apiKey: placeholderCredential
      },
      '2026-08-15T12:00:00.000Z'
    )

    expect(summary).toEqual({
      id: 'default',
      name: 'DeepSeek',
      protocol: 'openai-compatible',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      hasCredential: true,
      updatedAt: '2026-08-15T12:00:00.000Z'
    })
    expect(JSON.stringify(service.getSummary())).not.toContain(placeholderCredential)
    const stored = database
      .prepare('SELECT secret_ciphertext FROM model_provider WHERE id = ?')
      .get('default') as { secret_ciphertext: Buffer }
    expect(stored.secret_ciphertext.toString('utf8')).toBe(`encrypted:${placeholderCredential}`)
    expect(service.getExecutionProfile()).toMatchObject({ apiKey: placeholderCredential })
    repository.close()
  })

  it('preserves an existing credential when settings are edited without a new key', () => {
    const repository = new ResearchRepository(new Database(':memory:'))
    const service = new ProviderService(repository, new FakeSecretCipher())
    service.save({
      name: 'Provider',
      protocol: 'openai-compatible',
      baseUrl: 'https://example.net/v1',
      model: 'model-a',
      apiKey: existingPlaceholder
    })

    service.save({
      name: 'Provider renamed',
      protocol: 'openai-compatible',
      baseUrl: 'https://example.net/v1',
      model: 'model-b'
    })

    expect(service.getExecutionProfile()).toMatchObject({
      name: 'Provider renamed',
      model: 'model-b',
      apiKey: existingPlaceholder
    })
    repository.close()
  })

  it('rejects insecure remote URLs and plaintext fallback when encryption is unavailable', () => {
    const repository = new ResearchRepository(new Database(':memory:'))
    const service = new ProviderService(repository, new FakeSecretCipher(false))

    expect(() =>
      service.save({
        name: 'Unsafe',
        protocol: 'openai-compatible',
        baseUrl: 'http://example.net/v1',
        model: 'model',
        apiKey: placeholderCredential
      })
    ).toThrow('HTTPS')
    expect(() =>
      service.save({
        name: 'No encryption',
        protocol: 'openai-compatible',
        baseUrl: 'https://example.net/v1',
        model: 'model',
        apiKey: placeholderCredential
      })
    ).toThrow('OS-backed credential encryption is unavailable')
    repository.close()
  })
})

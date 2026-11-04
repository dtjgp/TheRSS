import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { ResearchRepository } from '../storage/researchRepository'
import { ProviderService, type SecretCipher } from './providerService'

const placeholderCredential = ['test', 'credential'].join('-')
const existingPlaceholder = ['existing', 'placeholder'].join('-')

/** Resolves on a later task, like Electron's asynchronous safeStorage. */
const later = <T>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), 0))

class FakeSecretCipher implements SecretCipher {
  constructor(private readonly available = true) {}

  isAvailable(): Promise<boolean> {
    return later(this.available)
  }

  encrypt(value: string): Promise<Buffer> {
    return later(Buffer.from(`encrypted:${value}`, 'utf8'))
  }

  decrypt(value: Buffer): Promise<string> {
    return later(value.toString('utf8').replace(/^encrypted:/, ''))
  }
}

describe('ProviderService', () => {
  it('stores only encrypted credentials and returns non-secret settings', async () => {
    const database = new Database(':memory:')
    const repository = new ResearchRepository(database)
    const service = new ProviderService(repository, new FakeSecretCipher())

    const summary = await service.save(
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
    await expect(service.getExecutionProfile()).resolves.toMatchObject({
      apiKey: placeholderCredential
    })
    repository.close()
  })

  it('preserves an existing credential when settings are edited without a new key', async () => {
    const repository = new ResearchRepository(new Database(':memory:'))
    const service = new ProviderService(repository, new FakeSecretCipher())
    await service.save({
      name: 'Provider',
      protocol: 'openai-compatible',
      baseUrl: 'https://example.net/v1',
      model: 'model-a',
      apiKey: existingPlaceholder
    })

    await service.save({
      name: 'Provider renamed',
      protocol: 'openai-compatible',
      baseUrl: 'https://example.net/v1',
      model: 'model-b'
    })

    await expect(service.getExecutionProfile()).resolves.toMatchObject({
      name: 'Provider renamed',
      model: 'model-b',
      apiKey: existingPlaceholder
    })
    repository.close()
  })

  it('clears an existing credential without changing provider metadata', async () => {
    const repository = new ResearchRepository(new Database(':memory:'))
    const service = new ProviderService(repository, new FakeSecretCipher())
    await service.save({
      name: 'Provider',
      protocol: 'openai-compatible',
      baseUrl: 'https://example.net/v1',
      model: 'model-a',
      apiKey: existingPlaceholder
    })

    const summary = service.clearCredential('2026-08-24T12:00:00.000Z')

    expect(summary).toMatchObject({
      name: 'Provider',
      baseUrl: 'https://example.net/v1',
      model: 'model-a',
      hasCredential: false,
      updatedAt: '2026-08-24T12:00:00.000Z'
    })
    expect((await service.getExecutionProfile()).apiKey).toBeNull()
    repository.close()
  })

  it('builds a transient connection profile without persisting a replacement credential', async () => {
    const repository = new ResearchRepository(new Database(':memory:'))
    const service = new ProviderService(repository, new FakeSecretCipher())
    await service.save({
      name: 'Provider',
      protocol: 'openai-compatible',
      baseUrl: 'https://example.net/v1',
      model: 'model-a',
      apiKey: existingPlaceholder
    })
    const replacementPlaceholder = ['replacement', 'placeholder'].join('-')

    await expect(
      service.getConnectionTestProfile({
        name: 'Edited provider',
        protocol: 'anthropic-compatible',
        baseUrl: 'https://api.example.org',
        model: 'model-b',
        apiKey: replacementPlaceholder
      })
    ).resolves.toMatchObject({
      name: 'Edited provider',
      protocol: 'anthropic-compatible',
      baseUrl: 'https://api.example.org',
      model: 'model-b',
      apiKey: replacementPlaceholder
    })
    expect((await service.getExecutionProfile()).apiKey).toBe(existingPlaceholder)
    repository.close()
  })

  it('never reuses a stored credential for a changed protocol or endpoint', async () => {
    const repository = new ResearchRepository(new Database(':memory:'))
    const service = new ProviderService(repository, new FakeSecretCipher())
    await service.save({
      name: 'Provider',
      protocol: 'openai-compatible',
      baseUrl: 'https://api.example.net/v1',
      model: 'model-a',
      apiKey: existingPlaceholder
    })

    expect(
      (
        await service.getConnectionTestProfile({
          name: 'Changed host',
          protocol: 'openai-compatible',
          baseUrl: 'https://other.example.net/v1',
          model: 'model-a'
        })
      ).apiKey
    ).toBeNull()
    await expect(
      service.save({
        name: 'Changed host',
        protocol: 'openai-compatible',
        baseUrl: 'https://other.example.net/v1',
        model: 'model-a'
      })
    ).rejects.toThrow('replacement credential')
    await expect(service.getExecutionProfile()).resolves.toMatchObject({
      baseUrl: 'https://api.example.net/v1',
      apiKey: existingPlaceholder
    })
    repository.close()
  })

  it('rejects insecure remote URLs and plaintext fallback when encryption is unavailable', async () => {
    const repository = new ResearchRepository(new Database(':memory:'))
    const service = new ProviderService(repository, new FakeSecretCipher(false))

    await expect(
      service.save({
        name: 'Unsafe',
        protocol: 'openai-compatible',
        baseUrl: 'http://example.net/v1',
        model: 'model',
        apiKey: placeholderCredential
      })
    ).rejects.toThrow('HTTPS')
    await expect(
      service.save({
        name: 'No encryption',
        protocol: 'openai-compatible',
        baseUrl: 'https://example.net/v1',
        model: 'model',
        apiKey: placeholderCredential
      })
    ).rejects.toThrow('OS-backed credential encryption is unavailable')
    expect(service.getSummary()).toBeNull()
    repository.close()
  })
})

import { describe, expect, it } from 'vitest'
import { validateProviderBaseUrl } from './providerUrl'

describe('validateProviderBaseUrl', () => {
  it.each([
    'https://api.deepseek.com',
    'https://example.net/v1',
    'http://127.0.0.1:11434/v1',
    'http://localhost:1234/v1'
  ])('accepts safe provider URL %s', (value) => {
    expect(validateProviderBaseUrl(value)).toBe(value)
  })

  it.each([
    'http://example.net/v1',
    'file:///tmp/provider',
    'data:text/plain,secret',
    'https://user:password@example.net/v1'
  ])('rejects unsafe provider URL %s', (value) => {
    expect(() => validateProviderBaseUrl(value)).toThrow()
  })
})

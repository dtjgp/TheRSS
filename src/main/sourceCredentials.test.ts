import { describe, expect, it } from 'vitest'
import { githubTokenFromEnvironment, huggingFaceTokenFromEnvironment } from './sourceCredentials'

describe('githubTokenFromEnvironment', () => {
  it('returns a trimmed optional main-process token', () => {
    expect(githubTokenFromEnvironment({ THERSS_GITHUB_TOKEN: '  github_pat_example  ' })).toBe(
      'github_pat_example'
    )
    expect(githubTokenFromEnvironment({ THERSS_GITHUB_TOKEN: '   ' })).toBeUndefined()
    expect(githubTokenFromEnvironment({})).toBeUndefined()
  })

  it('rejects an implausibly long token before it reaches an adapter', () => {
    expect(() => githubTokenFromEnvironment({ THERSS_GITHUB_TOKEN: 'x'.repeat(513) })).toThrow(
      'THERSS_GITHUB_TOKEN exceeds 512 characters'
    )
  })
})

describe('huggingFaceTokenFromEnvironment', () => {
  it('keeps an optional Hugging Face token in the main process boundary', () => {
    expect(huggingFaceTokenFromEnvironment({ THERSS_HUGGINGFACE_TOKEN: '  hf_example  ' })).toBe(
      'hf_example'
    )
    expect(huggingFaceTokenFromEnvironment({})).toBeUndefined()
  })

  it('rejects an implausibly long token before it reaches an adapter', () => {
    expect(() =>
      huggingFaceTokenFromEnvironment({ THERSS_HUGGINGFACE_TOKEN: 'x'.repeat(513) })
    ).toThrow('THERSS_HUGGINGFACE_TOKEN exceeds 512 characters')
  })
})

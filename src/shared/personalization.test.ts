import { describe, expect, it } from 'vitest'
import {
  DISCOVER_PERSONALIZATION_PROMPT_MAX_LENGTH,
  discoverPersonalizationPromptSchema
} from './personalization'

describe('discoverPersonalizationPromptSchema', () => {
  it('trims an optional multiline research profile while preserving useful structure', () => {
    expect(
      discoverPersonalizationPromptSchema.parse(
        '  Research fields: edge intelligence.\nEvidence preference: reproducible systems.  '
      )
    ).toBe('Research fields: edge intelligence.\nEvidence preference: reproducible systems.')
  })

  it('allows an empty prompt to disable personalization', () => {
    expect(discoverPersonalizationPromptSchema.parse('   ')).toBe('')
  })

  it('rejects oversized or null-containing profile input', () => {
    expect(() =>
      discoverPersonalizationPromptSchema.parse(
        'x'.repeat(DISCOVER_PERSONALIZATION_PROMPT_MAX_LENGTH + 1)
      )
    ).toThrow()
    expect(() => discoverPersonalizationPromptSchema.parse('safe\u0000hidden')).toThrow()
  })
})

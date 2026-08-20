import { z } from 'zod'

export const DISCOVER_PERSONALIZATION_PROMPT_MAX_LENGTH = 4_000

function hasForbiddenControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return (
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f
    )
  })
}

export const discoverPersonalizationPromptSchema = z
  .string()
  .trim()
  .max(DISCOVER_PERSONALIZATION_PROMPT_MAX_LENGTH)
  .refine((value) => !hasForbiddenControlCharacters(value))

export interface DiscoverPersonalizationSettings {
  readonly prompt: string
  readonly updatedAt: string
}

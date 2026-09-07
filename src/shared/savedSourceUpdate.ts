import { z } from 'zod'
import type { DashboardItem, DashboardSnapshot } from './api'

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine(
    (value) => [...value].every((character) => character.charCodeAt(0) >= 32),
    'Invalid record identifier'
  )
const hash = z.string().regex(/^[a-f0-9]{64}$/u)
export const savedSourceUpdateRequestSchema = z
  .object({
    itemId: identifier,
    sessionId: identifier,
    expectedSourceHash: hash,
    sourceHash: hash
  })
  .strict()
export type SavedSourceUpdateRequest = z.infer<typeof savedSourceUpdateRequestSchema>
export interface SavedSourceUpdateCandidate {
  readonly itemId: string
  readonly sessionId: string
  readonly title: string
  readonly retrievedAt: string
  readonly updatedAt: string
  readonly currentSourceHash: string
  readonly sourceHash: string
}
export type SavedSourceUpdateStatus = 'updated' | 'unchanged' | 'conflict' | 'unavailable'
export interface SavedSourceUpdateResult {
  readonly status: SavedSourceUpdateStatus
  readonly item: DashboardItem | null
  readonly dashboard: DashboardSnapshot
}

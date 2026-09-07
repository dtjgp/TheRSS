import { z } from 'zod'
import type { DashboardItem } from './api'
import type { DiscoverSnapshot } from './discover'
import type { AnalysisArtifactState } from './models'

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine(
    (value) => [...value].every((character) => character.charCodeAt(0) >= 32),
    'Invalid local record identifier'
  )
export const localResearchTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('saved'), itemId: identifier }).strict(),
  z.object({ kind: z.literal('discover'), sessionId: identifier, itemId: identifier }).strict(),
  z.object({ kind: z.literal('analysis'), analysisId: identifier }).strict()
])
export type LocalResearchTarget = z.infer<typeof localResearchTargetSchema>
export type LocalResearchRecord =
  | { readonly kind: 'saved'; readonly item: DashboardItem }
  | { readonly kind: 'discover'; readonly snapshot: DiscoverSnapshot; readonly itemId: string }
  | {
      readonly kind: 'analysis'
      readonly state: AnalysisArtifactState
      readonly item: DashboardItem | null
    }

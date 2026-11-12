import { z } from 'zod'
import { DISCOVER_SOURCE_IDS, discoverSourceSchema, type DiscoverSource } from './discover'

/** Where the stored default came from: the one-time initialization or an explicit save. */
export type DiscoverSourcePreferenceOrigin = 'latest-session' | 'all-sources' | 'user'

/** The default sources that new Discover searches start from. */
export interface DiscoverSourcePreference {
  /** Current sources in registry order; empty when every stored source is no longer available. */
  readonly sources: readonly DiscoverSource[]
  /** Stored IDs that are no longer Discover sources; they are never replaced automatically. */
  readonly unavailable: readonly string[]
  readonly origin: DiscoverSourcePreferenceOrigin
  readonly updatedAt: string
}

/**
 * A default must name 1–22 current sources. A repeated ID makes the request invalid (it is not
 * silently de-duplicated), so a client error cannot hide behind a corrected value.
 */
export const discoverSourcePreferenceInputSchema = z
  .array(discoverSourceSchema)
  .min(1, 'Select at least one source.')
  .max(DISCOVER_SOURCE_IDS.length)
  .refine((sources) => new Set(sources).size === sources.length, 'A source can appear only once.')

/** Current sources from any list, in registry order and without repeats. */
export function orderedDiscoverSources(sources: Iterable<string>): DiscoverSource[] {
  const wanted = new Set(sources)
  return DISCOVER_SOURCE_IDS.filter((source) => wanted.has(source))
}

export function sameDiscoverSources(
  left: Iterable<DiscoverSource>,
  right: Iterable<DiscoverSource>
): boolean {
  const a = new Set(left),
    b = new Set(right)
  return a.size === b.size && [...a].every((source) => b.has(source))
}

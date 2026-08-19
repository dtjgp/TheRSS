import type { DiscoverySource } from './discovery'
import { SOURCE_CATALOG, type SourceCatalogEntry } from './sourceCatalog'

export function discoverySourceFromCatalogId(id: string): DiscoverySource | null {
  if (id === 'official:arxiv') return 'arxiv'
  if (id === 'folo:10') return 'github'
  return /^folo:\d+$/u.test(id) ? (id as `folo:${number}`) : null
}

const ACTIVE_SOURCE_ENTRIES = SOURCE_CATALOG.flatMap((entry) => {
  if (entry.acquisition !== 'active') return []
  const source = discoverySourceFromCatalogId(entry.id)
  return source ? [{ source, entry }] : []
})

const SOURCE_ENTRY_BY_ID = new Map<DiscoverySource, SourceCatalogEntry>(
  ACTIVE_SOURCE_ENTRIES.map(({ source, entry }) => [source, entry])
)

export const ACTIVE_TODAY_SOURCE_IDS: readonly DiscoverySource[] = Object.freeze(
  ACTIVE_SOURCE_ENTRIES.map(({ source }) => source)
)

export function isDiscoverySource(value: string): value is DiscoverySource {
  return SOURCE_ENTRY_BY_ID.has(value as DiscoverySource)
}

export function sourceCatalogId(source: DiscoverySource): string {
  return SOURCE_ENTRY_BY_ID.get(source)?.id ?? source
}

export function sourceCatalogEntry(source: DiscoverySource): SourceCatalogEntry | null {
  return SOURCE_ENTRY_BY_ID.get(source) ?? null
}

export function sourceDisplayName(source: DiscoverySource): string {
  return SOURCE_ENTRY_BY_ID.get(source)?.name ?? source
}

export function sourceStyleToken(source: DiscoverySource): string {
  if (source === 'arxiv' || source === 'github') return source
  return `source-${source.slice('folo:'.length)}`
}

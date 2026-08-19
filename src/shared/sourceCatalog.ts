import sourceCatalogData from './sourceCatalogData.json'

export const SOURCE_PRIORITIES = ['A', 'B', 'C'] as const
export type SourcePriority = (typeof SOURCE_PRIORITIES)[number]

export const RESEARCH_AXES = ['MC', 'C6', 'GA', 'SG', 'AB', 'RI'] as const
export type ResearchAxis = (typeof RESEARCH_AXES)[number]

export const RESEARCH_AXIS_LABELS: Readonly<Record<ResearchAxis, string>> = {
  MC: 'Model compression & edge AI',
  C6: 'Communications & 6G',
  GA: 'Green AI & efficient computing',
  SG: 'Smart grid & energy markets',
  AB: 'Agents & behavior',
  RI: 'Research infrastructure'
}

export const SOURCE_ACQUISITION_STATES = [
  'active',
  'configured',
  'rsshub_candidate',
  'adapter_required'
] as const
export type SourceAcquisitionState = (typeof SOURCE_ACQUISITION_STATES)[number]

export const SOURCE_ACQUISITION_LABELS: Readonly<Record<SourceAcquisitionState, string>> = {
  active: 'Active adapter',
  configured: 'Configured retrieval',
  rsshub_candidate: 'RSSHub candidate',
  adapter_required: 'Adapter required'
}

export interface SourceCatalogEntry {
  readonly priority: SourcePriority
  readonly id: string
  readonly name: string
  readonly url: string
  readonly researchAxes: readonly ResearchAxis[]
  readonly role: string
  readonly acquisition: SourceAcquisitionState
  readonly accessNote: string
  readonly reason: string
  readonly origin: string
}

interface RawSourceCatalogEntry {
  readonly priority: string
  readonly id: string
  readonly name: string
  readonly url: string
  readonly researchAxes: readonly string[]
  readonly role: string
  readonly acquisition: string
  readonly accessNote: string
  readonly reason: string
  readonly origin: string
}

function includesValue<const Values extends readonly string[]>(
  values: Values,
  candidate: string
): candidate is Values[number] {
  return values.some((value) => value === candidate)
}

function requireText(value: string, field: string, id: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`Source catalog entry ${id} has an empty ${field}`)
  return normalized
}

function parseCatalogEntry(raw: RawSourceCatalogEntry): SourceCatalogEntry {
  const id = requireText(raw.id, 'id', raw.id || '<unknown>')
  if (!includesValue(SOURCE_PRIORITIES, raw.priority)) {
    throw new Error(`Source catalog entry ${id} has an invalid priority`)
  }
  if (!includesValue(SOURCE_ACQUISITION_STATES, raw.acquisition)) {
    throw new Error(`Source catalog entry ${id} has an invalid acquisition state`)
  }
  if (raw.researchAxes.length === 0) {
    throw new Error(`Source catalog entry ${id} needs at least one research axis`)
  }
  const researchAxes = raw.researchAxes.map((axis) => {
    if (!includesValue(RESEARCH_AXES, axis)) {
      throw new Error(`Source catalog entry ${id} has an invalid research axis`)
    }
    return axis
  })
  const url = new URL(raw.url)
  if (url.protocol !== 'https:') {
    throw new Error(`Source catalog entry ${id} must use HTTPS`)
  }

  return Object.freeze({
    priority: raw.priority,
    id,
    name: requireText(raw.name, 'name', id),
    url: url.toString(),
    researchAxes: Object.freeze(researchAxes),
    role: requireText(raw.role, 'role', id),
    acquisition: raw.acquisition,
    accessNote: requireText(raw.accessNote, 'access note', id),
    reason: requireText(raw.reason, 'reason', id),
    origin: requireText(raw.origin, 'origin', id)
  })
}

export const SOURCE_CATALOG: readonly SourceCatalogEntry[] = Object.freeze(
  (sourceCatalogData as readonly RawSourceCatalogEntry[]).map(parseCatalogEntry)
)

export const SOURCE_CATALOG_STATS = Object.freeze({
  total: SOURCE_CATALOG.length,
  priorities: Object.freeze({
    A: SOURCE_CATALOG.filter((source) => source.priority === 'A').length,
    B: SOURCE_CATALOG.filter((source) => source.priority === 'B').length,
    C: SOURCE_CATALOG.filter((source) => source.priority === 'C').length
  }),
  acquisition: Object.freeze({
    active: SOURCE_CATALOG.filter((source) => source.acquisition === 'active').length,
    configured: SOURCE_CATALOG.filter((source) => source.acquisition === 'configured').length,
    rsshub_candidate: SOURCE_CATALOG.filter((source) => source.acquisition === 'rsshub_candidate')
      .length,
    adapter_required: SOURCE_CATALOG.filter((source) => source.acquisition === 'adapter_required')
      .length
  })
})

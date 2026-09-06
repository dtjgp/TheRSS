import type { DiscoverySource } from './discovery'

export interface SourceGroup {
  readonly id: string
  readonly title: string
  readonly sources: readonly DiscoverySource[]
}

/** Presentation groups only; adapter capabilities and research axes remain independent. */
export const SOURCE_GROUPS: readonly SourceGroup[] = [
  {
    id: 'papers',
    title: 'Papers & literature',
    sources: ['arxiv', 'folo:611', 'folo:444', 'folo:792']
  },
  { id: 'code', title: 'Code & models', sources: ['github', 'folo:64'] },
  { id: 'organizations', title: 'Research organizations', sources: ['folo:302', 'folo:182'] },
  {
    id: 'technology',
    title: 'Technology & communities',
    sources: [
      'folo:77',
      'folo:208',
      'folo:93',
      'folo:67',
      'folo:523',
      'folo:44',
      'folo:79',
      'folo:172',
      'folo:1104',
      'folo:257',
      'folo:312'
    ]
  },
  { id: 'business', title: 'Business & policy', sources: ['folo:84', 'folo:253', 'folo:177'] }
]

export function sourceGroup(source: DiscoverySource | null): SourceGroup | undefined {
  return SOURCE_GROUPS.find((group) => group.sources.some((id) => id === source))
}

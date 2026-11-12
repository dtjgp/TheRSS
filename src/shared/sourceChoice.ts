import type { DiscoverSource } from './discover'
import { SOURCE_CATALOG } from './sourceCatalog'
import { SOURCE_GROUPS } from './sourceGroups'
import { discoverySourceFromCatalogId, sourceDisplayName } from './sourceIdentity'

/** One choosable Discover source with its real name, catalog research role and group. */
export interface SourceChoice {
  readonly source: DiscoverSource
  readonly name: string
  readonly role: string
  readonly groupId: string
  readonly groupTitle: string
}

const roles = new Map(
  SOURCE_CATALOG.flatMap((entry) => {
    const source = discoverySourceFromCatalogId(entry.id)
    return source ? [[source, entry.role] as const] : []
  })
)

/** All Discover sources in the shared presentation-group order. */
export const SOURCE_CHOICES: readonly SourceChoice[] = SOURCE_GROUPS.flatMap((group) =>
  group.sources.map((source) => ({
    source: source as DiscoverSource,
    name: sourceDisplayName(source),
    role: roles.get(source) ?? '',
    groupId: group.id,
    groupTitle: group.title
  }))
)

/**
 * The choices a finder shows: a local text match on name, research role or group, optionally only
 * the selected ones. It never changes the selection and makes no request.
 */
export function visibleSourceChoices(
  selection: ReadonlySet<DiscoverSource>,
  query: string,
  onlySelected: boolean
): SourceChoice[] {
  const text = query.trim().toLocaleLowerCase()
  return SOURCE_CHOICES.filter(
    (choice) =>
      (!onlySelected || selection.has(choice.source)) &&
      (!text ||
        `${choice.name} ${choice.role} ${choice.groupTitle}`.toLocaleLowerCase().includes(text))
  )
}

/** Adds or removes only the shown sources; hidden selections stay as they are. */
export function changeShownSources(
  selection: ReadonlySet<DiscoverSource>,
  shown: readonly SourceChoice[],
  selected: boolean
): Set<DiscoverSource> {
  const next = new Set(selection)
  for (const { source } of shown) {
    if (selected) next.add(source)
    else next.delete(source)
  }
  return next
}

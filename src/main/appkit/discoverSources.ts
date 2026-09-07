import { DISCOVER_SOURCE_IDS, type DiscoverSource } from '../../shared/discover'
import { SOURCE_GROUPS } from '../../shared/sourceGroups'
import { sourceDisplayName } from '../../shared/sourceIdentity'
import { column, Controls, label, row, scroll, type NativeContext } from './common'
import type { NativeNode } from './presentation'

interface SourcePickerState {
  readonly query: string
  readonly busy: boolean
  selection(): ReadonlySet<DiscoverSource>
  changeSelection(next: Set<DiscoverSource>): void
  changeQuery(query: string): void
}

export function discoverSources(context: NativeContext, state: SourcePickerState): NativeNode {
  const b = new Controls(context),
    query = state.query.trim().toLocaleLowerCase()
  let shown = 0
  const groups = SOURCE_GROUPS.flatMap((group) => {
    const visible = group.sources.filter(
      (source) =>
        !query || `${sourceDisplayName(source)} ${group.title}`.toLocaleLowerCase().includes(query)
    )
    if (!visible.length) return []
    shown += visible.length
    const selected = group.sources.filter((source) => state.selection().has(source)).length
    const checks = visible.map((source) => ({
      ...b.check(
        `discover-source-${source}`,
        sourceDisplayName(source),
        state.selection().has(source),
        (checked) => {
          const next = new Set(state.selection())
          if (checked) next.add(source)
          else next.delete(source)
          state.changeSelection(next)
        },
        !state.busy
      ),
      help: sourceDisplayName(source)
    }))
    return [
      column(
        `discover-group-${group.id}`,
        [
          row(`discover-group-${group.id}-header`, [
            label(
              `discover-group-${group.id}-title`,
              `${group.title} · ${selected}/${group.sources.length}`,
              { weight: 'bold', flex: 1 }
            ),
            {
              ...b.button(
                `discover-group-${group.id}-toggle`,
                selected === group.sources.length ? 'Clear group' : 'Select group',
                () => {
                  const next = new Set(state.selection())
                  const allSelected = group.sources.every((source) => next.has(source))
                  for (const source of group.sources) {
                    if (allSelected) next.delete(source)
                    else next.add(source)
                  }
                  state.changeSelection(next)
                },
                !state.busy
              ),
              emphasis: 'quiet'
            }
          ]),
          ...Array.from({ length: Math.ceil(checks.length / 2) }, (_, index) =>
            row(
              `discover-group-${group.id}-row-${index}`,
              checks.slice(index * 2, index * 2 + 2).map((check) => ({ ...check, flex: 1 }))
            )
          )
        ],
        { gap: 4, padding: 8 }
      )
    ]
  })
  return column(
    'discover-source-controls',
    [
      row('discover-source-actions', [
        b.input('discover-source-query', 'Find sources', state.query, state.changeQuery, 100, {
          flex: 1,
          placeholder: 'Find a source or research group'
        }),
        b.button(
          'discover-all-sources',
          'Select all',
          () => state.changeSelection(new Set(DISCOVER_SOURCE_IDS)),
          !state.busy
        ),
        b.button(
          'discover-clear-sources',
          'Clear selection',
          () => state.changeSelection(new Set()),
          !state.busy
        )
      ]),
      ...(query
        ? [
            label(
              'discover-source-match-count',
              `${shown} of 22 sources shown. Group actions apply to the whole group.`,
              { weight: 'secondary' }
            )
          ]
        : []),
      scroll(
        'discover-source-scroll',
        column(
          'discover-source-checks',
          groups.length
            ? groups
            : [
                label('discover-source-empty', 'No source matches this name or group.'),
                b.button('discover-source-clear-query', 'Show all sources', () =>
                  state.changeQuery('')
                )
              ],
          { gap: 8 }
        ),
        { height: 224, flex: 0 }
      )
    ],
    { gap: 4 }
  )
}

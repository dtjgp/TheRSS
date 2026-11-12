import type { DiscoverSource } from '../../shared/discover'
import { SOURCE_GROUPS } from '../../shared/sourceGroups'
import { changeShownSources, visibleSourceChoices } from '../../shared/sourceChoice'
import { column, Controls, label, row, scroll, type NativeContext } from './common'
import type { NativeNode } from './presentation'

/** An unsaved choice of sources with its local finder; nothing is stored until a caller saves. */
export class SourceDraft {
  query = ''
  onlySelected = false
  selection: Set<DiscoverSource>
  constructor(initial: Iterable<DiscoverSource>) {
    this.selection = new Set(initial)
  }
  shown() {
    return visibleSourceChoices(this.selection, this.query, this.onlySelected)
  }
  reset(sources: Iterable<DiscoverSource>): void {
    this.selection = new Set(sources)
  }
}

/**
 * The shared source chooser of the Discover popover and the My sources sheet: a local finder,
 * Only selected, Select/Clear shown, group counts and one checkbox per source with its role.
 */
export function sourceChooser(
  context: NativeContext,
  draft: SourceDraft,
  prefix: string,
  enabled: boolean,
  /** A fixed list height (popover), or 'fill' to take the remaining height (sheet). */
  height: number | 'fill'
): NativeNode {
  const b = new Controls(context),
    shown = draft.shown()
  const change = (next: Set<DiscoverSource>) => {
    draft.selection = next
    context.redraw()
  }
  const groups = SOURCE_GROUPS.flatMap((group) => {
    const visible = shown.filter((choice) => choice.groupId === group.id)
    if (!visible.length) return []
    const selected = group.sources.filter((source) =>
      draft.selection.has(source as DiscoverSource)
    ).length
    return [
      column(
        `${prefix}-group-${group.id}`,
        [
          label(
            `${prefix}-group-${group.id}-title`,
            `${group.title} · ${selected}/${group.sources.length} selected`,
            { weight: 'bold' }
          ),
          ...visible.map((choice) =>
            column(
              `${prefix}-item-${choice.source}`,
              [
                {
                  ...b.check(
                    `${prefix}-${choice.source}`,
                    choice.name,
                    draft.selection.has(choice.source),
                    (checked) => {
                      const next = new Set(draft.selection)
                      if (checked) next.add(choice.source)
                      else next.delete(choice.source)
                      change(next)
                    },
                    enabled
                  ),
                  help: choice.role || choice.name
                },
                ...(choice.role
                  ? [
                      label(`${prefix}-${choice.source}-role`, choice.role, {
                        weight: 'secondary',
                        textStyle: 'footnote'
                      })
                    ]
                  : [])
              ],
              { gap: 2 }
            )
          )
        ],
        { gap: 6, padding: 6 }
      )
    ]
  })
  return column(
    `${prefix}-chooser`,
    [
      row(`${prefix}-finder`, [
        b.input(
          `${prefix}-query`,
          'Find sources',
          draft.query,
          (query) => {
            draft.query = query
            context.redraw()
          },
          100,
          { flex: 1, placeholder: 'Find by name, research role or group' }
        ),
        b.check(`${prefix}-only-selected`, 'Only selected', draft.onlySelected, (value) => {
          draft.onlySelected = value
          context.redraw()
        })
      ]),
      row(`${prefix}-bulk`, [
        label(
          `${prefix}-shown-count`,
          `${shown.length} of 22 shown · ${draft.selection.size} selected`,
          { weight: 'secondary', flex: 1 }
        ),
        b.button(
          `${prefix}-select-shown`,
          'Select shown',
          () => change(changeShownSources(draft.selection, shown, true)),
          enabled && shown.length > 0
        ),
        b.button(
          `${prefix}-clear-shown`,
          'Clear shown',
          () => change(changeShownSources(draft.selection, shown, false)),
          enabled && shown.length > 0
        )
      ]),
      scroll(
        `${prefix}-scroll`,
        column(
          `${prefix}-groups`,
          groups.length
            ? groups
            : [
                label(`${prefix}-empty`, 'No source matches this search.'),
                b.button(`${prefix}-show-all`, 'Show all sources', () => {
                  draft.query = ''
                  draft.onlySelected = false
                  context.redraw()
                })
              ],
          { gap: 8 }
        ),
        height === 'fill' ? { flex: 1 } : { height, flex: 0 }
      )
    ],
    // In a sheet the list shrinks so the footer stays visible in a small window.
    height === 'fill' ? { gap: 6, flex: 1 } : { gap: 6 }
  )
}

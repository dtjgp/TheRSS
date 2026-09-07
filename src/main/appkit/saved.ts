import type { AnalysisRunner } from '../../shared/models'
import type { DashboardItem } from '../../shared/api'
import { ACTIVE_TODAY_SOURCE_IDS, sourceDisplayName } from '../../shared/sourceIdentity'
import {
  column,
  Controls,
  heading,
  label,
  row,
  type NativeContext,
  type NativeScreen
} from './common'
import type { NativeNode } from './presentation'
import { ResearchReader, type TriageHistory } from './reading'
import { researchSubtitle } from './researchMetadata'
import { ReadingWorkspace } from './readingWorkspace'

export class SavedScreen implements NativeScreen {
  readonly reader: ResearchReader
  private readonly controls: Controls
  private filter = 'all'
  private selected = ''
  private runner: AnalysisRunner = 'model-provider'
  private readonly workspace: ReadingWorkspace
  private localItem: DashboardItem | null = null
  constructor(
    private readonly context: NativeContext,
    private readonly triage: TriageHistory
  ) {
    this.controls = new Controls(context)
    this.reader = new ResearchReader(context, 'saved', triage)
    this.workspace = new ReadingWorkspace(context, 'saved', 'saved-items', 'saved-summary')
  }
  dispose(): void {
    this.reader.dispose()
  }
  openLocal(item: DashboardItem): () => void {
    const previous = { selected: this.selected, filter: this.filter, localItem: this.localItem }
    const restoreWorkspace = this.workspace.checkpoint()
    this.localItem = item
    this.selected = item.id
    this.filter = 'all'
    this.workspace.open()
    return () => {
      Object.assign(this, previous)
      restoreWorkspace()
    }
  }
  private items(): readonly DashboardItem[] {
    const items = this.context.data.dashboard?.savedItems ?? []
    return this.localItem &&
      !items.some((item) => item.id === this.localItem!.id) &&
      this.triage.state(this.localItem) === 'saved'
      ? [this.localItem, ...items]
      : items
  }

  render(): NativeNode {
    const b = this.controls
    const all = this.items()
    const items = all.filter((item) => this.filter === 'all' || item.source === this.filter)
    const selected = items.find((item) => item.id === this.selected) ?? items[0] ?? null
    this.selected = selected?.id ?? ''
    this.reader.runner = this.runner
    this.reader.select(selected)
    return column(
      'saved-page',
      [
        ...(!this.workspace.focused ? [heading('saved-title', 'Saved')] : []),
        row('saved-toolbar', [
          ...(!this.workspace.focused
            ? [
                b.select(
                  'saved-source-filter',
                  'Filter saved sources',
                  this.filter,
                  [
                    { id: 'all', title: `All sources (${all.length})` },
                    ...ACTIVE_TODAY_SOURCE_IDS.map((source) => ({
                      id: source,
                      title: `${sourceDisplayName(source)} (${all.filter((item) => item.source === source).length})`
                    }))
                  ],
                  (value) => {
                    this.filter = value
                    this.selected = ''
                    this.context.redraw()
                  },
                  { width: 250 }
                )
              ]
            : []),
          b.runner('saved-runner', this.runner, (value) => {
            this.runner = value
            this.context.redraw()
          })
        ]),
        ...(items.length ? this.workspace.navigation('Back to Saved') : []),
        ...(items.length
          ? [
              this.workspace.apply(
                b.split('saved-workspace', 'saved', [
                  b.table(
                    'saved-items',
                    'Saved research',
                    items.map((item) => ({
                      id: item.id,
                      title: item.title,
                      subtitle: researchSubtitle(item, true)
                    })),
                    this.selected,
                    (id) => this.select(id),
                    {
                      activate: (id) => {
                        this.select(id)
                        this.workspace.open()
                      },
                      context: async (id) => {
                        this.select(id)
                        await this.reader.contextMenu()
                      }
                    }
                  ),
                  this.reader.render()
                ])
              )
            ]
          : [
              column(
                'saved-empty',
                [
                  label(
                    'saved-empty-message',
                    all.length
                      ? 'No saved items from this source.'
                      : 'Save papers and repositories from Discover to build your local reading list.'
                  ),
                  row('saved-empty-actions', [
                    all.length
                      ? b.button('saved-reset-filter', 'Show all Saved', () => {
                          this.filter = 'all'
                          this.workspace.back()
                        })
                      : b.button('saved-open-discover', 'Open Discover', () =>
                          this.context.navigate('discover')
                        )
                  ])
                ],
                { flex: 1 }
              )
            ])
      ],
      { flex: 1 }
    )
  }
  private select(id: string): void {
    const item = this.items().find((item) => item.id === id)
    if (!item) return
    this.selected = id
    this.reader.select(item)
    this.context.redraw()
    if (item.triageState === 'new') void this.triage.change(item, 'viewed')
  }
}

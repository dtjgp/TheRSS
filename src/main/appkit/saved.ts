import type { AnalysisRunner } from '../../shared/models'
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

export class SavedScreen implements NativeScreen {
  readonly reader: ResearchReader
  private readonly controls: Controls
  private filter = 'all'
  private selected = ''
  private runner: AnalysisRunner = 'model-provider'
  constructor(
    private readonly context: NativeContext,
    private readonly triage: TriageHistory
  ) {
    this.controls = new Controls(context)
    this.reader = new ResearchReader(context, 'saved', triage)
  }
  dispose(): void {
    this.reader.dispose()
  }

  render(): NativeNode {
    const b = this.controls
    const all = this.context.data.dashboard?.savedItems ?? []
    const items = all.filter((item) => this.filter === 'all' || item.source === this.filter)
    const selected = items.find((item) => item.id === this.selected) ?? items[0] ?? null
    this.selected = selected?.id ?? ''
    this.reader.runner = this.runner
    this.reader.select(selected)
    return column(
      'saved-page',
      [
        heading('saved-title', 'Saved'),
        row('saved-toolbar', [
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
          ),
          b.runner('saved-runner', this.runner, (value) => {
            this.runner = value
            this.context.redraw()
          })
        ]),
        ...(items.length
          ? [
              b.split('saved-workspace', 'saved', [
                b.table(
                  'saved-items',
                  'Saved research',
                  items.map((item) => ({
                    id: item.id,
                    title: item.title,
                    subtitle: `${sourceDisplayName(item.source)} · ${item.publishedAt.slice(0, 10)} · ${item.kind ?? 'item'}`
                  })),
                  this.selected,
                  (id) => this.select(id),
                  {
                    context: async (id) => {
                      this.select(id)
                      await this.reader.contextMenu()
                    }
                  }
                ),
                this.reader.render()
              ])
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
                  )
                ],
                { flex: 1 }
              )
            ])
      ],
      { flex: 1 }
    )
  }
  private select(id: string): void {
    const item = this.context.data.dashboard?.savedItems.find((item) => item.id === id)
    if (!item) return
    this.selected = id
    this.reader.select(item)
    this.context.redraw()
    if (item.triageState === 'new') void this.triage.change(item, 'viewed')
  }
}

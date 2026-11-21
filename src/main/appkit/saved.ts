import type { AnalysisRunner } from '../../shared/models'
import type { DashboardItem } from '../../shared/api'
import type { DiscoverySource } from '../../shared/discovery'
import { llmWikiArxivId, type LlmWikiListFilter } from '../../shared/llmWikiLibrary'
import { LLM_WIKI_LIST_FILTER_OPTIONS } from '../../shared/llmWikiListFilter'
import { ACTIVE_TODAY_SOURCE_IDS, sourceDisplayName } from '../../shared/sourceIdentity'
import { column, Controls, emptyState, row, type NativeContext, type NativeScreen } from './common'
import type { NativeNode } from './presentation'
import { ResearchReader, type TriageHistory } from './reading'
import { researchRowDrag, researchRowGlyph, researchSubtitle } from './researchMetadata'
import { ReadingWorkspace } from './readingWorkspace'
import { SavedSourceUpdateControls } from './savedSourceUpdate'
import { WikiListState } from './wikiListState'

export class SavedScreen implements NativeScreen {
  readonly reader: ResearchReader
  private readonly controls: Controls
  private readonly wikiList: WikiListState
  private filter = 'all'
  private wikiFilter: LlmWikiListFilter = 'all'
  private selected = ''
  private runner: AnalysisRunner = 'model-provider'
  private readonly workspace: ReadingWorkspace
  private localItem: DashboardItem | null = null
  private readonly sourceUpdate: SavedSourceUpdateControls
  constructor(
    private readonly context: NativeContext,
    private readonly triage: TriageHistory
  ) {
    this.controls = new Controls(context)
    this.wikiList = new WikiListState(context)
    this.reader = new ResearchReader(context, 'saved', triage)
    this.workspace = new ReadingWorkspace(context, 'saved', 'saved-items', 'saved-summary')
    this.sourceUpdate = new SavedSourceUpdateControls(context, (item, id) => {
      if (this.localItem?.id === id) this.localItem = item?.triageState === 'saved' ? item : null
    })
  }
  llmWikiChanged(arxivId: string): void {
    this.reader.llmWikiChanged(arxivId)
    this.wikiList.refreshOne(arxivId)
  }
  llmWikiVaultChanged(): void {
    this.wikiList.invalidateAll()
    const current = this.items().find((item) => item.id === this.selected)
    const arxivId = current ? llmWikiArxivId(current) : null
    if (arxivId) this.reader.llmWikiChanged(arxivId)
  }
  dispose(): void {
    this.wikiList.dispose()
    this.reader.dispose()
    this.sourceUpdate.dispose()
  }
  openLocal(item: DashboardItem): () => void {
    const previous = {
      selected: this.selected,
      filter: this.filter,
      wikiFilter: this.wikiFilter,
      localItem: this.localItem
    }
    const restoreWorkspace = this.workspace.checkpoint()
    this.localItem = item
    this.selected = item.id
    this.filter = 'all'
    this.wikiFilter = 'all'
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
    this.wikiList.sync(all)
    const items = all.filter(
      (item) =>
        (this.filter === 'all' || item.source === this.filter) &&
        this.wikiList.matches(item, this.wikiFilter)
    )
    const selected = items.find((item) => item.id === this.selected) ?? items[0] ?? null
    this.selected = selected?.id ?? ''
    this.reader.runner = this.runner
    this.reader.select(selected)
    this.sourceUpdate.select(selected)
    return column(
      'saved-page',
      [
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
                ),
                b.select(
                  'saved-wiki-filter',
                  'llm-wiki filter',
                  this.wikiFilter,
                  LLM_WIKI_LIST_FILTER_OPTIONS,
                  (value) => {
                    this.wikiFilter = value as LlmWikiListFilter
                    this.context.redraw()
                  },
                  { help: 'Filter saved items by local llm-wiki membership' }
                )
              ]
            : []),
          b.runner('saved-runner', this.runner, (value) => {
            this.runner = value
            this.context.redraw()
          })
        ]),
        ...(items.length ? this.workspace.navigation('Back to Saved') : []),
        ...(selected ? [this.sourceUpdate.render()] : []),
        ...(items.length
          ? [
              this.workspace.apply(
                b.split('saved-workspace', 'saved', [
                  b.table(
                    'saved-items',
                    'Saved research',
                    // Every row here is saved: the workspace, not a star, carries that state.
                    items.map((item) => ({
                      id: item.id,
                      title: item.title,
                      subtitle: this.wikiList.subtitle(
                        item,
                        researchSubtitle(item, this.context.locale)
                      ),
                      ...researchRowGlyph(item.kind),
                      ...researchRowDrag(item)
                    })),
                    this.selected,
                    (id) => this.select(id),
                    {
                      activate: (id) => {
                        this.select(id)
                        this.workspace.open()
                      },
                      openWindow: (id) => {
                        this.select(id)
                        this.reader.openWindow()
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
              all.length
                ? this.filteredEmpty(all)
                : emptyState(
                    'saved-empty',
                    'star',
                    'No saved research',
                    'Save papers and repositories from Discover to build your local reading list.',
                    [
                      b.button('saved-open-discover', 'Open Discover', () =>
                        this.context.navigate('discover')
                      )
                    ]
                  )
            ])
      ],
      { flex: 1 }
    )
  }

  private filteredEmpty(all: readonly DashboardItem[]): NativeNode {
    const b = this.controls
    const preWiki = this.filter === 'all' ? all : all.filter((item) => item.source === this.filter)
    const wikiSummary = this.wikiList.summarize(preWiki)
    const reset = [
      b.button('saved-reset-filter', 'Show all Saved', () => {
        this.filter = 'all'
        this.wikiFilter = 'all'
        this.workspace.back()
      })
    ]
    if (this.wikiFilter !== 'all' && wikiSummary.pending > 0) {
      return emptyState(
        'saved-empty',
        'star',
        'Checking llm-wiki…',
        'Checking whether your saved papers are recorded in your local llm-wiki vault.',
        reset
      )
    }
    if (this.wikiFilter !== 'all' && wikiSummary.unavailable > 0) {
      return emptyState(
        'saved-empty',
        'star',
        'llm-wiki is unavailable',
        'Local llm-wiki status could not be read. Check Settings › Knowledge Base to verify the vault folder.',
        reset
      )
    }
    const wikiPhrase = this.wikiFilter === 'collected' ? 'in llm-wiki' : 'outside llm-wiki'
    const title =
      this.wikiFilter === 'all'
        ? `No items from ${sourceDisplayName(this.filter as DiscoverySource)}`
        : this.filter === 'all'
          ? `No saved items ${wikiPhrase}`
          : `No items from ${sourceDisplayName(this.filter as DiscoverySource)} ${wikiPhrase}`
    const message =
      this.wikiFilter === 'all'
        ? 'No saved items from this source. Your other saved research is unchanged.'
        : 'No saved items match this filter. Your other saved research is unchanged.'
    return emptyState('saved-empty', 'star', title, message, reset)
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

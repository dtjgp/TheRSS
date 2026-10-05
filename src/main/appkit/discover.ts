import { randomUUID } from 'node:crypto'
import {
  DISCOVER_SOURCE_IDS,
  type DiscoverRunProgress,
  type DiscoverSnapshot,
  type DiscoverSource
} from '../../shared/discover'
import type { AnalysisRunner } from '../../shared/models'
import { sourceDisplayName } from '../../shared/sourceIdentity'
import {
  column,
  emptyState,
  Controls,
  label,
  readableError,
  row,
  runnerAvailable,
  runnerUnavailableReason,
  type NativeContext,
  type NativeScreen
} from './common'
import type { NativeNode, NativePopover } from './presentation'
import { ResearchReader, type TriageHistory } from './reading'
import {
  researchMetadata,
  researchRowDrag,
  researchRowGlyph,
  researchSubtitle
} from './researchMetadata'
import { ReadingWorkspace } from './readingWorkspace'
import { discoverSources } from './discoverSources'
import { describeDiscoverRun } from '../../shared/discoverRunProgress'

type Filter = 'all' | 'paper' | 'repository' | 'other'
const KIND_NAMES: Record<Exclude<Filter, 'all'>, string> = {
  paper: 'papers',
  repository: 'repositories',
  other: 'other results'
}

const statusTitles: Record<DiscoverSnapshot['status'], string> = {
  completed: 'Complete',
  partial: 'Partial results',
  no_results: 'No results',
  failed: 'Search failed',
  canceled: 'Canceled'
}

/** Plain-language session outcome derived only from persisted per-source outcomes. */
function resultStatus(snapshot: DiscoverSnapshot): string {
  const searched = DISCOVER_SOURCE_IDS.map((source) => snapshot.sourceOutcomes[source]).filter(
    (outcome): outcome is DiscoverSnapshot['sourceOutcomes'][DiscoverSource] =>
      !!outcome && outcome.status !== 'not_searched'
  )
  const complete = searched.filter(
    (outcome) => outcome.status === 'healthy' || outcome.status === 'no_results'
  ).length
  return `${statusTitles[snapshot.status]} · ${complete} of ${searched.length} sources complete · ${snapshot.createdAt.slice(0, 10)}`
}

export class DiscoverScreen implements NativeScreen {
  readonly reader: ResearchReader
  private readonly controls: Controls
  private readonly unsubscribe: () => void
  private query = ''
  private runner: AnalysisRunner = 'model-provider'
  private sources = new Set<DiscoverSource>(DISCOVER_SOURCE_IDS)
  private picker = false
  private sourceQuery = ''
  private snapshot: DiscoverSnapshot | null = null
  private filter: Filter = 'all'
  private selected = ''
  private activeRun: string | null = null
  private canceling = false
  private progress: DiscoverRunProgress | null = null
  private message = ''
  private loaded = false
  private loading = false
  private version = 0
  private disposed = false
  private readonly workspace: ReadingWorkspace

  constructor(
    private readonly context: NativeContext,
    private readonly triage: TriageHistory
  ) {
    this.controls = new Controls(context)
    this.reader = new ResearchReader(context, 'discover', triage)
    this.workspace = new ReadingWorkspace(
      context,
      'discover',
      'discover-results',
      'discover-summary'
    )
    this.unsubscribe = context.api.onDiscoverProgress((progress) => {
      if (progress.runId === this.activeRun) {
        this.progress = progress
        context.redraw()
      }
    })
  }
  async load(): Promise<void> {
    if (this.loaded || this.loading) return
    this.loading = true
    const version = this.version
    try {
      const snapshot = await this.context.api.getLatestDiscover()
      if (this.disposed || version !== this.version) return
      if (snapshot) {
        this.snapshot = snapshot
        this.query = snapshot.intent
        this.runner = snapshot.runner
        const sources = DISCOVER_SOURCE_IDS.filter(
          (source) => snapshot.sourceOutcomes[source]?.status !== 'not_searched'
        )
        if (sources.length) this.sources = new Set(sources)
      }
      this.loaded = true
    } catch {
      this.message = 'The previous Discover session could not be loaded.'
    } finally {
      this.loading = false
      this.context.redraw()
    }
  }
  dispose(): void {
    this.disposed = true
    this.version++
    this.unsubscribe()
    this.reader.dispose()
  }
  get searching(): boolean {
    return this.activeRun !== null
  }
  openLocal(snapshot: DiscoverSnapshot, itemId: string): () => void {
    if (this.activeRun)
      throw new Error('Wait for the active search before opening a historical session.')
    const index = snapshot.items.findIndex((item) => item.id === itemId)
    if (index < 0) throw new Error('This result is no longer in the stored search session.')
    const previous = {
      snapshot: this.snapshot,
      query: this.query,
      runner: this.runner,
      sources: this.sources,
      filter: this.filter,
      selected: this.selected,
      picker: this.picker,
      message: this.message,
      progress: this.progress
    }
    const restoreWorkspace = this.workspace.checkpoint()
    this.version++
    this.snapshot = snapshot
    this.query = snapshot.intent
    this.runner = snapshot.runner
    this.sources = new Set(
      DISCOVER_SOURCE_IDS.filter(
        (source) => snapshot.sourceOutcomes[source]?.status !== 'not_searched'
      )
    )
    this.filter = 'all'
    this.selected = itemId
    this.picker = false
    this.message = ''
    this.progress = null
    this.workspace.open()
    return () => {
      this.version++
      Object.assign(this, previous)
      restoreWorkspace()
    }
  }

  render(): NativeNode {
    const b = this.controls,
      busy = !!this.activeRun,
      snapshot = this.snapshot
    const filtered =
      snapshot?.items.filter(
        (item) =>
          this.filter === 'all' ||
          (this.filter === 'other'
            ? item.kind !== 'paper' && item.kind !== 'repository'
            : item.kind === this.filter)
      ) ?? []
    // NSTableView creates row views lazily, so every filtered result is listed.
    const visible = filtered
    const selected = visible.find((item) => item.id === this.selected) ?? visible[0] ?? null
    this.selected = selected?.id ?? ''
    this.reader.runner = this.runner
    this.reader.select(
      selected ? { ...selected, triageState: selected.saved ? 'saved' : 'new' } : null,
      snapshot?.id,
      selected ? researchMetadata(selected) : ''
    )
    const retryable = this.retryable()
    return column(
      'discover-page',
      [
        ...(!this.workspace.focused || busy ? [this.composer(), ...this.readiness()] : []),
        ...(this.progress ? [this.runStatus(this.progress)] : []),
        ...(this.message ? [label('discover-message', this.message)] : []),
        ...(!this.loaded && !this.loading
          ? [b.button('discover-load-retry', 'Retry loading session', () => this.load())]
          : []),
        ...(snapshot && !this.workspace.focused
          ? [
              row('discover-results-toolbar', [
                b.segmented(
                  'discover-kind',
                  'Result kind',
                  this.filter,
                  [
                    { id: 'all', title: `All (${snapshot.items.length})` },
                    { id: 'paper', title: `Papers (${snapshot.counts.byKind.paper})` },
                    {
                      id: 'repository',
                      title: `Repositories (${snapshot.counts.byKind.repository})`
                    },
                    {
                      id: 'other',
                      title: `Other (${snapshot.items.filter((item) => item.kind !== 'paper' && item.kind !== 'repository').length})`
                    }
                  ],
                  (filter) => {
                    this.filter = filter as Filter
                    this.selected = ''
                    this.context.redraw()
                  }
                ),
                label('discover-result-status', resultStatus(snapshot), { flex: 1 }),
                b.button('discover-details', 'Search details', () => this.details()),
                ...(retryable.length
                  ? [
                      b.button(
                        'discover-retry',
                        `Retry ${retryable.length} incomplete`,
                        () => this.search(true),
                        !busy
                      )
                    ]
                  : [])
              ])
            ]
          : []),
        ...(visible.length ? this.workspace.navigation() : []),
        ...(visible.length
          ? [
              this.workspace.apply(
                b.split('discover-workspace', 'discover', [
                  column(
                    'discover-list-pane',
                    [
                      b.table(
                        'discover-results',
                        'Discover results',
                        visible.map((item) => {
                          const saved =
                            this.triage.state({
                              ...item,
                              triageState: item.saved ? 'saved' : 'new'
                            }) === 'saved'
                          return {
                            id: item.id,
                            title: item.title,
                            subtitle: researchSubtitle(item),
                            ...researchRowGlyph(item.kind),
                            ...researchRowDrag(item),
                            ...(saved ? { saved: true } : {})
                          }
                        }),
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
                          },
                          // Double-click opens the record in its own window, as in Mail.
                          openWindow: (id) => {
                            this.select(id)
                            this.reader.openWindow()
                          }
                        }
                      ),
                      label(
                        'discover-pagination',
                        `${visible.length} ${visible.length === 1 ? 'result' : 'results'}`,
                        { weight: 'secondary' }
                      )
                    ],
                    { flex: 1 }
                  ),
                  this.reader.render()
                ])
              )
            ]
          : [
              snapshot
                ? emptyState(
                    'discover-empty',
                    'sparkle.magnifyingglass',
                    // An empty session keeps its outcome: failed and canceled are not "no results".
                    this.filter !== 'all'
                      ? `No ${KIND_NAMES[this.filter]} in this session`
                      : snapshot.status === 'failed'
                        ? 'Search failed'
                        : snapshot.status === 'canceled'
                          ? 'Search canceled'
                          : 'No results',
                    'No results match this view. Source outcomes remain available in Search details.',
                    this.filter === 'all'
                      ? []
                      : [
                          b.button('discover-show-all', 'Show all results', () => {
                            this.filter = 'all'
                            this.selected = ''
                            this.context.redraw()
                          })
                        ]
                  )
                : emptyState(
                    'discover-empty',
                    'sparkle.magnifyingglass',
                    'Start a research search',
                    'Search research sources and keep the results on this Mac.'
                  )
            ])
      ],
      { flex: 1, gap: 8 }
    )
  }

  /** PRODUCT.md three-stage run: stage, native progress and the latest completed source. */
  private runStatus(progress: DiscoverRunProgress): NativeNode {
    const run = describeDiscoverRun(
      this.canceling ? { ...progress, phase: 'cancel_requested' } : progress
    )
    return column(
      'discover-run',
      [
        label('discover-run-headline', run.headline, { weight: 'bold' }),
        label('discover-run-stage', run.stageLine, { weight: 'secondary', size: 12 }),
        {
          id: 'discover-run-progress',
          kind: 'progress',
          title: 'Discover run progress',
          ...(run.determinate ?? {})
        },
        label('discover-progress', run.detail, { weight: 'secondary' })
      ],
      { surface: 'inset', padding: 12, gap: 6 }
    )
  }

  private composer(): NativeNode {
    const b = this.controls,
      busy = !!this.activeRun,
      snapshot = this.snapshot
    const previousSources = snapshot
      ? DISCOVER_SOURCE_IDS.filter(
          (source) => snapshot.sourceOutcomes[source]?.status !== 'not_searched'
        )
      : []
    const changed =
      snapshot &&
      (this.query.trim() !== snapshot.intent ||
        this.runner !== snapshot.runner ||
        previousSources.length !== this.sources.size ||
        previousSources.some((source) => !this.sources.has(source)))
    return column(
      'discover-composer',
      [
        label('discover-query-label', 'Research question', { weight: 'bold', size: 12 }),
        b.input(
          'discover-query',
          'Research question',
          this.query,
          (query) => {
            if (!busy) {
              this.query = query
              this.version++
              this.context.redraw()
            }
          },
          2000,
          { multiline: true, height: 64, enabled: !busy && !this.loading }
        ),
        row('discover-input-actions', [
          b.runner(
            'discover-runner',
            this.runner,
            (runner) => {
              this.runner = runner
              this.context.redraw()
            },
            busy || this.loading
          ),
          b.button(
            'discover-source-picker',
            `Sources (${this.sources.size}/22)`,
            () => {
              this.picker = !this.picker
              // Keyboard users land in the source finder, as in a Safari or Mail popover.
              if (this.picker) this.context.focus('discover-source-query')
              this.context.redraw()
            },
            !busy && !this.loading
          ),
          {
            ...b.button(
              'discover-search',
              busy ? 'Searching…' : 'Search',
              () => this.search(),
              this.canSearch()
            ),
            emphasis: 'primary',
            symbol: 'magnifyingglass',
            // Return stays a newline in the multiline question; Command-Return submits.
            shortcut: 'command-return',
            help: 'Search selected sources (Command-Return)'
          },
          ...(busy
            ? [
                b.button(
                  'discover-cancel',
                  this.canceling ? 'Canceling…' : 'Cancel',
                  () => this.cancel(),
                  !this.canceling
                )
              ]
            : [])
        ]),
        ...(changed
          ? [
              label('discover-draft-status', `Draft not searched. Results: ${snapshot.intent}`, {
                size: 11,
                maxLines: 2
              })
            ]
          : []),
        label(
          'discover-personalization',
          `${this.query.length}/2000 characters · ${this.context.data.personalPrompt.trim() ? 'Personal context active' : 'No personal context saved'}`,
          { weight: 'secondary', size: 11 }
        )
      ],
      { surface: 'panel', padding: 12, gap: 6 }
    )
  }

  private readiness(): NativeNode[] {
    if (this.activeRun || this.loading) return []
    const queryMissing = !this.query.trim()
    const sourcesMissing = !this.sources.size
    const runnerReason = runnerUnavailableReason(this.context, this.runner)
    const reason = queryMissing
      ? 'Enter a research question to start a search.'
      : sourcesMissing
        ? 'Select at least one source to search.'
        : runnerReason
    if (!reason) return []
    const b = this.controls
    return [
      label('discover-readiness', reason, { weight: 'secondary' }),
      ...(!queryMissing && !sourcesMissing && runnerReason
        ? [
            b.button('discover-configure-runner', 'Open Settings', () =>
              this.context.navigate('settings')
            )
          ]
        : [])
    ]
  }

  popover(): NativePopover | undefined {
    // The Sources button is part of the composer, which a focused reading workspace hides;
    // hiding the anchor ends the choice so the popover never reopens on its own later.
    if (this.workspace.focused) this.closePopover()
    if (!this.picker || this.activeRun) return undefined
    return {
      anchor: 'discover-source-picker',
      close: this.context.presentation.action('discover-source-popover-close', () => {
        this.closePopover()
        this.context.redraw()
      }),
      root: column('discover-source-popover', [this.sourcePicker()], { padding: 14 })
    }
  }
  closePopover(): void {
    this.picker = false
  }
  private sourcePicker(): NativeNode {
    return discoverSources(this.context, {
      query: this.sourceQuery,
      busy: !!this.activeRun,
      selection: () => this.sources,
      changeSelection: (next) => {
        if (this.activeRun) return
        this.sources = next
        this.context.redraw()
      },
      changeQuery: (query) => {
        this.sourceQuery = query
        this.context.redraw()
      }
    })
  }
  private select(id: string): void {
    const item = this.snapshot?.items.find((item) => item.id === id)
    if (!item) return
    this.selected = id
    this.reader.select(
      { ...item, triageState: item.saved ? 'saved' : 'new' },
      this.snapshot?.id,
      researchMetadata(item)
    )
    this.context.redraw()
  }
  private retryable(): DiscoverSource[] {
    return this.snapshot
      ? DISCOVER_SOURCE_IDS.filter((source) =>
          ['failed', 'partial', 'canceled'].includes(
            this.snapshot!.sourceOutcomes[source]?.status ?? 'not_searched'
          )
        )
      : []
  }
  private canSearch(): boolean {
    return (
      !this.activeRun &&
      !this.loading &&
      !!this.query.trim() &&
      this.sources.size > 0 &&
      runnerAvailable(this.context, this.runner)
    )
  }

  private async search(retry = false): Promise<void> {
    if (this.activeRun || (retry ? !this.snapshot || !this.retryable().length : !this.canSearch()))
      return
    const snapshot = this.snapshot,
      sources = retry
        ? this.retryable()
        : DISCOVER_SOURCE_IDS.filter((source) => this.sources.has(source))
    const runId = `native:${randomUUID()}`
    this.version++
    this.activeRun = runId
    this.picker = false
    this.canceling = false
    this.message = ''
    this.progress = {
      runId,
      phase: retry ? 'searching' : 'planning',
      completedSources: 0,
      totalSources: sources.length,
      source: null,
      outcome: null
    }
    this.context.redraw()
    try {
      const result = retry
        ? await this.context.api.retryDiscover(snapshot!.id, sources, runId)
        : await this.context.api.searchDiscover(
            { intent: this.query.trim(), runner: this.runner, sources },
            runId
          )
      if (this.disposed || this.activeRun !== runId) return
      this.snapshot = result
      if (result.items.length && ['completed', 'partial'].includes(result.status)) {
        this.picker = false
        this.context.focus('discover-results')
      }
      this.loaded = true
      this.filter = 'all'
      this.selected = ''
      if (result.status === 'canceled')
        this.message = 'Search canceled. Completed source results were preserved.'
      this.context.data.dashboard = await this.context.api.getDashboard()
    } catch (error) {
      if (!this.disposed && this.activeRun === runId)
        this.message = this.canceling
          ? 'Search canceled.'
          : readableError(error, 'Search failed. Check the selected runner and sources.')
    } finally {
      if (this.activeRun === runId) {
        this.activeRun = null
        this.canceling = false
        this.progress = null
        this.context.redraw()
      }
    }
  }
  private async cancel(): Promise<void> {
    const runId = this.activeRun
    if (!runId || this.canceling) return
    this.canceling = true
    this.context.redraw()
    try {
      const receipt = await this.context.api.cancelDiscover(runId)
      if (this.activeRun === runId && !receipt.canceled) {
        this.canceling = false
        this.message = 'The run has already settled; waiting for its result.'
      }
    } catch {
      if (this.activeRun === runId) {
        this.canceling = false
        this.message = 'Cancellation could not be requested. Try again.'
      }
    }
    this.context.redraw()
  }
  private details(): void {
    const s = this.snapshot
    if (!s) return
    this.context.showDocument(
      'Search details',
      `# Search outcome\n\n${s.status} · ${s.createdAt}\n\n${s.intent}\n\n## Search plan\n\n${s.plan.intentSummary}\n\n${s.plan.rationale}\n\narXiv categories: ${s.plan.arxiv.categories.join(', ')}\narXiv keywords: ${s.plan.arxiv.keywords.join(', ')}\nExcluded keywords: ${s.plan.arxiv.excludeKeywords.join(', ')}\nGitHub keywords: ${s.plan.github.keywords.join(', ')}\nTopics: ${s.plan.github.topics.join(', ')}\nLanguages: ${s.plan.github.languages.join(', ')}\n\n## All source outcomes\n\n${DISCOVER_SOURCE_IDS.map(
        (source) => {
          const outcome = s.sourceOutcomes[source]
          return `### ${sourceDisplayName(source)}\n${outcome?.status ?? 'not_searched'} · ${outcome?.resultCount ?? 0} results${outcome?.error ? `\n${outcome.error}` : ''}`
        }
      ).join(
        '\n\n'
      )}\n\n## Planner provenance\nProvider: ${s.provenance.providerName}\nModel: ${s.provenance.model}\nPrompt: ${s.provenance.promptVersion}\nInput hash: ${s.provenance.inputHash}\nPersonal context applied: ${s.provenance.personalizationApplied ? 'Yes' : 'No'}\nCreated: ${s.provenance.createdAt}`
    )
  }
}

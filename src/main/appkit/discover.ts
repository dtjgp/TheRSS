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
  Controls,
  heading,
  label,
  readableError,
  row,
  runnerAvailable,
  runnerUnavailableReason,
  type NativeContext,
  type NativeScreen
} from './common'
import type { NativeNode } from './presentation'
import { ResearchReader, type TriageHistory } from './reading'
import { researchMetadata, researchSubtitle } from './researchMetadata'
import { ReadingWorkspace } from './readingWorkspace'
import { discoverSources } from './discoverSources'

type Filter = 'all' | 'paper' | 'repository' | 'other'

export class DiscoverScreen implements NativeScreen {
  readonly reader: ResearchReader
  private readonly controls: Controls
  private readonly unsubscribe: () => void
  private query = ''
  private runner: AnalysisRunner = 'model-provider'
  private sources = new Set<DiscoverSource>(DISCOVER_SOURCE_IDS)
  private editorExpanded = true
  private picker = false
  private sourceQuery = ''
  private snapshot: DiscoverSnapshot | null = null
  private filter: Filter = 'all'
  private visible = 24
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
        this.editorExpanded =
          !snapshot.items.length || ['failed', 'canceled'].includes(snapshot.status)
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
      visible: this.visible,
      selected: this.selected,
      editorExpanded: this.editorExpanded,
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
    this.visible = Math.max(24, Math.ceil((index + 1) / 24) * 24)
    this.selected = itemId
    this.editorExpanded = false
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
    const visible = filtered.slice(0, this.visible)
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
        ...(!this.workspace.focused ? [heading('discover-title', 'Discover')] : []),
        ...(!this.workspace.focused || busy
          ? [this.composer(), ...this.readiness(), ...(this.picker ? [this.sourcePicker()] : [])]
          : []),
        ...(this.progress
          ? [
              label(
                'discover-progress',
                this.canceling
                  ? 'Cancellation requested; waiting for the run to settle.'
                  : this.progress.phase === 'planning'
                    ? 'Planning the search…'
                    : `Searching sources: ${this.progress.completedSources}/${this.progress.totalSources}${this.progress.source ? ` · ${sourceDisplayName(this.progress.source)}` : ''}`
              )
            ]
          : []),
        ...(this.message ? [label('discover-message', this.message)] : []),
        ...(!this.loaded && !this.loading
          ? [b.button('discover-load-retry', 'Retry loading session', () => this.load())]
          : []),
        ...(snapshot && !this.workspace.focused
          ? [
              row('discover-results-toolbar', [
                b.select(
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
                    this.visible = 24
                    this.selected = ''
                    this.context.redraw()
                  },
                  { width: 210 }
                ),
                label(
                  'discover-result-status',
                  `${snapshot.status} · ${snapshot.createdAt.slice(0, 10)}`,
                  { flex: 1 }
                ),
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
                        visible.map((item) => ({
                          id: item.id,
                          title: item.title,
                          subtitle: researchSubtitle(
                            item,
                            this.triage.state({
                              ...item,
                              triageState: item.saved ? 'saved' : 'new'
                            }) === 'saved'
                          )
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
                      label(
                        'discover-pagination',
                        `${visible.length} of ${filtered.length} results`,
                        { weight: 'secondary' }
                      ),
                      ...(visible.length < filtered.length
                        ? [
                            b.button('discover-more', 'Show 24 more', () => {
                              this.visible += 24
                              this.context.redraw()
                            })
                          ]
                        : [])
                    ],
                    { flex: 1 }
                  ),
                  this.reader.render()
                ])
              )
            ]
          : [
              column(
                'discover-empty',
                [
                  label(
                    'discover-empty-message',
                    snapshot
                      ? 'No results match this view. Source outcomes remain available in Search details.'
                      : 'Search research sources and keep the results on this Mac.'
                  )
                ],
                { flex: 1 }
              )
            ])
      ],
      { flex: 1, gap: 8 }
    )
  }

  private composer(): NativeNode {
    const b = this.controls,
      busy = !!this.activeRun,
      snapshot = this.snapshot
    if (!this.editorExpanded && snapshot) {
      const previousSources = DISCOVER_SOURCE_IDS.filter(
        (source) => snapshot.sourceOutcomes[source]?.status !== 'not_searched'
      )
      const changed =
        this.query.trim() !== snapshot.intent ||
        this.runner !== snapshot.runner ||
        previousSources.length !== this.sources.size ||
        previousSources.some((source) => !this.sources.has(source))
      return column(
        'discover-compact-search',
        [
          row('discover-compact-row', [
            label('discover-query-summary', this.query, { flex: 1, maxLines: 2, weight: 'bold' }),
            {
              ...b.button(
                'discover-edit-search',
                'Edit search',
                () => {
                  this.editorExpanded = true
                  this.context.focus('discover-query')
                },
                !busy
              ),
              emphasis: 'quiet'
            },
            {
              ...b.button(
                'discover-search',
                busy ? 'Searching…' : 'Search again',
                () => this.search(),
                this.canSearch()
              ),
              emphasis: 'primary',
              symbol: 'magnifyingglass'
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
          label(
            'discover-compact-context',
            `${this.sources.size} sources · ${this.runner === 'codex' ? 'Codex CLI' : this.runner === 'claude' ? 'Claude Code' : (this.context.data.provider?.name ?? 'Model provider')}`,
            { size: 11, weight: 'secondary' }
          ),
          ...(changed
            ? [
                label('discover-draft-status', `Draft not searched. Results: ${snapshot.intent}`, {
                  size: 11,
                  maxLines: 2
                })
              ]
            : [])
        ],
        { surface: 'panel', padding: 10, gap: 4 }
      )
    }
    return column(
      'discover-composer',
      [
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
            busy
          ),
          b.button(
            'discover-source-picker',
            `Sources (${this.sources.size}/22)`,
            () => {
              this.picker = !this.picker
              this.context.redraw()
            },
            !busy
          ),
          {
            ...b.button(
              'discover-search',
              busy ? 'Searching…' : 'Search',
              () => this.search(),
              this.canSearch()
            ),
            emphasis: 'primary',
            symbol: 'magnifyingglass'
          },
          ...(snapshot?.items.length
            ? [
                {
                  ...b.button(
                    'discover-done-editing',
                    'Done editing',
                    () => {
                      this.editorExpanded = false
                      this.picker = false
                      this.context.focus('discover-edit-search')
                    },
                    !busy
                  ),
                  emphasis: 'quiet' as const
                }
              ]
            : []),
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
        label(
          'discover-personalization',
          `${this.query.length}/2000 characters · ${this.context.data.personalPrompt.trim() ? 'Personal context active' : 'No personal context saved'}`,
          { weight: 'secondary' }
        )
      ],
      { surface: 'panel', padding: 14, gap: 8 }
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
      ...(!queryMissing && sourcesMissing
        ? [
            b.button('discover-select-sources', 'Choose sources', () => {
              this.picker = true
              this.context.focus('discover-all-sources')
            })
          ]
        : []),
      ...(!queryMissing && !sourcesMissing && runnerReason
        ? [
            b.button('discover-configure-runner', 'Open Settings', () =>
              this.context.navigate('settings')
            )
          ]
        : [])
    ]
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
    this.reader.select({ ...item, triageState: item.saved ? 'saved' : 'new' }, this.snapshot?.id)
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
      this.editorExpanded =
        !result.items.length || !['completed', 'partial'].includes(result.status)
      if (!this.editorExpanded) {
        this.picker = false
        this.context.focus('discover-results')
      }
      this.loaded = true
      this.filter = 'all'
      this.visible = 24
      this.selected = ''
      if (result.status === 'canceled')
        this.message = 'Search canceled. Completed source results were preserved.'
      this.context.data.dashboard = await this.context.api.getDashboard()
    } catch (error) {
      this.editorExpanded = true
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

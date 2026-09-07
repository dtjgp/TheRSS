import type { AnalyticsSnapshot } from '../../shared/analytics'
import type { AnalysisArtifactState } from '../../shared/models'
import type { LocalResearchRecord } from '../../shared/localResearch'
import {
  analysisText,
  column,
  Controls,
  heading,
  label,
  readableError,
  recordViewId,
  row,
  scroll,
  type NativeContext,
  type NativeScreen
} from './common'
import type { NativeNode } from './presentation'
import { ReadingWorkspace } from './readingWorkspace'

export class AnalyticsScreen implements NativeScreen {
  private readonly workspace: ReadingWorkspace
  private readonly controls: Controls
  private snapshot: AnalyticsSnapshot | null = null
  private trendKind: 'discover' | 'today' | 'analysis' = 'discover'
  private showValues = false
  private selected = ''
  private artifact: AnalysisArtifactState | null = null
  private busy = false
  private artifactBusy = false
  private error = ''
  private artifactError = ''
  private version = 0
  private disposed = false
  private localRecord: Extract<LocalResearchRecord, { kind: 'analysis' }> | null = null
  private restoreHistory: (() => void) | null = null
  constructor(private readonly context: NativeContext) {
    this.workspace = new ReadingWorkspace(
      context,
      'analytics',
      'analytics-analyses',
      'analytics-analysis-content'
    )
    this.controls = new Controls(context)
  }
  dispose(): void {
    this.disposed = true
    this.version++
  }
  openLocal(record: Extract<LocalResearchRecord, { kind: 'analysis' }>): () => void {
    const previous = {
      selected: this.selected,
      artifact: this.artifact,
      artifactBusy: this.artifactBusy,
      artifactError: this.artifactError,
      localRecord: this.localRecord,
      restoreHistory: this.restoreHistory
    }
    this.version++
    this.localRecord = record
    this.selected = record.state.artifact.id
    this.artifact = record.state
    this.artifactBusy = false
    this.artifactError = ''
    const restore = () => {
      this.version++
      Object.assign(this, previous)
      this.context.redraw()
    }
    this.restoreHistory = restore
    this.context.focus('analytics-analysis-content')
    this.context.redraw()
    return restore
  }
  async load(): Promise<void> {
    if (this.busy) return
    this.busy = true
    this.error = ''
    this.context.redraw()
    try {
      const snapshot = await this.context.api.getAnalytics()
      if (!this.disposed) this.snapshot = snapshot
    } catch (error) {
      if (!this.disposed) this.error = readableError(error)
    } finally {
      this.busy = false
      this.context.redraw()
    }
  }
  render(): NativeNode {
    const b = this.controls,
      s = this.snapshot
    if (this.localRecord)
      return column(
        'analytics-local-record',
        [
          row('analytics-local-actions', [
            b.button('analytics-return-history', 'Back to analysis history', () => {
              this.restoreHistory?.()
              this.context.focus('analytics-analyses')
            })
          ]),
          this.reading()
        ],
        { flex: 1 }
      )
    const metric = (id: string, title: string, count: number) =>
      column(
        id,
        [
          label(`${id}-value`, String(count), { weight: 'title' }),
          label(`${id}-title`, title, { weight: 'secondary' })
        ],
        { flex: 1 }
      )
    return column(
      'analytics-page',
      [
        ...(!this.workspace.focused ? [heading('analytics-title', 'Data Analytics')] : []),
        ...(!this.workspace.focused
          ? [
              row('analytics-header', [
                label(
                  'analytics-period',
                  s
                    ? `Last ${s.windowDays} local days · Recorded activity`
                    : 'Loading local activity…',
                  { flex: 1, weight: 'secondary' }
                ),
                b.button(
                  'analytics-retry',
                  this.busy ? 'Loading…' : 'Refresh',
                  () => this.load(),
                  !this.busy
                )
              ])
            ]
          : []),
        ...(this.error ? [label('analytics-error', this.error)] : []),
        ...(s
          ? [
              ...(!this.workspace.focused
                ? [
                    row('analytics-metrics', [
                      metric(
                        'analytics-searches',
                        'Lifetime returned records',
                        s.totals.searchResults
                      ),
                      metric(
                        'analytics-window',
                        `Last ${s.windowDays} local days`,
                        s.daily.reduce((sum, day) => sum + day.searchResults, 0)
                      ),
                      metric('analytics-completed', 'Deep analyses', s.totals.deepAnalyses),
                      metric('analytics-papers', 'Analyzed papers', s.totals.analyzedPapers)
                    ]),
                    this.trend(s),
                    ...(this.showValues
                      ? [
                          {
                            ...b.table(
                              'analytics-daily',
                              'Daily activity',
                              s.daily.map((day) => ({
                                id: day.date,
                                title: day.date,
                                subtitle: `Search ${day.searchResults} · Source ${day.todayResults} · Discover ${day.discoverResults} · Analysis ${day.deepAnalyses}`,
                                cells: {
                                  date: day.date,
                                  returned: String(day.searchResults),
                                  discover: String(day.discoverResults),
                                  legacy: String(day.todayResults),
                                  analyses: String(day.deepAnalyses)
                                }
                              })),
                              '',
                              () => undefined
                            ),
                            flex: 0,
                            height: 220,
                            maxWidth: 800,
                            columns: [
                              { id: 'date', title: 'Date', width: 110 },
                              {
                                id: 'returned',
                                title: 'Returned',
                                width: 85,
                                alignment: 'right' as const
                              },
                              {
                                id: 'discover',
                                title: 'Discover',
                                width: 85,
                                alignment: 'right' as const
                              },
                              {
                                id: 'legacy',
                                title: 'Legacy',
                                width: 75,
                                alignment: 'right' as const
                              },
                              {
                                id: 'analyses',
                                title: 'Analyses',
                                width: 85,
                                alignment: 'right' as const
                              }
                            ]
                          }
                        ]
                      : []),
                    label(
                      'analytics-analysis-heading',
                      `Latest ${Math.min(50, s.analyzedItems.length)} analyses · ${s.totals.analyzedPapers} unique analyzed papers`,
                      { weight: 'bold' }
                    )
                  ]
                : []),
              ...(s.analyzedItems.length ? this.workspace.navigation('Back to history') : []),
              this.workspace.apply({
                id: 'analytics-artifacts',
                kind: 'split' as const,
                flex: 1,
                width: 320,
                minWidth: 260,
                maxWidth: 520,
                collapseAt: 700,
                children: [
                  b.table(
                    'analytics-analyses',
                    'Persisted analyses',
                    s.analyzedItems.slice(0, 50).map((item) => ({
                      id: item.analysisId,
                      title: item.title,
                      subtitle: `${item.providerName} · ${item.model} · ${item.createdAt.slice(0, 10)}`
                    })),
                    this.selected,
                    (id) => this.select(id),
                    {
                      activate: (id) => {
                        this.workspace.open()
                        return this.select(id)
                      }
                    }
                  ),
                  this.reading()
                ]
              })
            ]
          : [
              column(
                'analytics-loading',
                [
                  label(
                    'analytics-loading-message',
                    this.busy
                      ? 'Reading recorded local activity…'
                      : 'No analytics snapshot is available. Retry to read local activity.'
                  )
                ],
                { flex: 1 }
              )
            ])
      ],
      { flex: 1 }
    )
  }
  private trend(snapshot: AnalyticsSnapshot): NativeNode {
    const b = this.controls
    const series = {
      discover: { field: 'discoverResults', title: 'Discover records', unit: 'records returned' },
      today: { field: 'todayResults', title: 'Legacy Today records', unit: 'records returned' },
      analysis: { field: 'deepAnalyses', title: 'Deep analyses', unit: 'stored analyses' }
    } as const
    const selected = series[this.trendKind]
    const points = snapshot.daily.map((day) => ({ date: day.date, value: day[selected.field] }))
    return column(
      'analytics-trend-panel',
      [
        row('analytics-trend-toolbar', [
          label('analytics-trend-title', 'Activity over time', { weight: 'bold', flex: 1 }),
          b.select(
            'analytics-trend-kind',
            'Activity series',
            this.trendKind,
            Object.entries(series).map(([id, entry]) => ({ id, title: entry.title })),
            (value) => {
              this.trendKind = value as typeof this.trendKind
              this.context.redraw()
            },
            { width: 210 }
          ),
          {
            ...b.button(
              'analytics-toggle-values',
              this.showValues ? 'Hide daily values' : 'Show daily values',
              () => {
                this.showValues = !this.showValues
                this.context.redraw()
              }
            ),
            emphasis: 'quiet'
          }
        ]),
        ...(points.some((point) => point.value > 0)
          ? [
              {
                id: 'analytics-trend',
                kind: 'chart' as const,
                title: `${selected.title} by local date`,
                text: selected.unit,
                points,
                height: 156
              }
            ]
          : [
              label('analytics-trend-empty', `No ${selected.title} recorded in this period.`, {
                height: 52,
                weight: 'secondary'
              })
            ]),
        label(
          'analytics-trend-definition',
          this.trendKind === 'analysis'
            ? 'Counts stored analysis artifacts, including repeated analyses of the same item.'
            : 'Counts returned records, including repeat searches. Zero means no records stored for that date.',
          { size: 11, weight: 'secondary', maxLines: 2 }
        )
      ],
      { surface: 'panel', padding: 12, gap: 6 }
    )
  }

  private async select(id: string): Promise<void> {
    if (!this.snapshot?.analyzedItems.some((item) => item.analysisId === id)) return
    const version = ++this.version
    this.selected = id
    this.artifact = null
    this.artifactBusy = true
    this.artifactError = ''
    this.context.redraw()
    try {
      const artifact = await this.context.api.getAnalysisArtifact(id)
      if (!this.disposed && version === this.version) {
        this.artifact = artifact
        if (!artifact) this.artifactError = 'The stored analysis is no longer available.'
      }
    } catch (error) {
      if (!this.disposed && version === this.version) this.artifactError = readableError(error)
    } finally {
      if (version === this.version) {
        this.artifactBusy = false
        this.context.redraw()
      }
    }
  }
  private reading(): NativeNode {
    const b = this.controls,
      item = this.localRecord
        ? this.localRecord.item
          ? { ...this.localRecord.item, analysisId: this.localRecord.state.artifact.id }
          : null
        : this.snapshot?.analyzedItems.find((item) => item.analysisId === this.selected),
      state = this.artifact
    return scroll(
      'analytics-reading',
      column(
        recordViewId('analytics-document', this.selected),
        [
          heading(
            'analytics-document-title',
            item?.title ?? this.localRecord?.state.artifact.itemId ?? 'Persistent analysis'
          ),
          ...(item
            ? [
                row('analytics-original-action', [
                  b.button(
                    'analytics-open-original',
                    'Open original',
                    () => this.context.openExternal(item.url),
                    true,
                    `analysis:${item.analysisId}:open`
                  )
                ])
              ]
            : []),
          ...(this.artifactBusy
            ? [label('analytics-artifact-loading', 'Loading stored analysis…')]
            : []),
          ...(this.artifactError
            ? [
                label('analytics-artifact-error', this.artifactError),
                b.button(
                  'analytics-artifact-retry',
                  'Retry analysis',
                  () => this.select(this.selected),
                  !this.artifactBusy
                )
              ]
            : []),
          ...(state
            ? [
                label('analytics-freshness', `Evidence state: ${state.freshness}`, {
                  weight: 'bold'
                }),
                label(
                  'analytics-freshness-explanation',
                  {
                    current: 'The stored source hash matches the current source.',
                    stale:
                      'The source has changed since this analysis. Reanalyze before relying on its claims.',
                    source_missing:
                      'The original local source is missing; this is a retained historical artifact.',
                    legacy_unavailable: 'A source hash is unavailable for this legacy artifact.'
                  }[state.freshness],
                  { weight: 'secondary' }
                ),
                b.rich('analytics-analysis-content', analysisText(state.artifact))
              ]
            : !item
              ? [
                  label(
                    'analytics-selection-hint',
                    'Select a recorded analysis to read its complete content and provenance.'
                  )
                ]
              : [])
        ],
        { padding: 18 }
      )
    )
  }
}

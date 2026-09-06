import type { AnalyticsSnapshot } from '../../shared/analytics'
import type { AnalysisArtifactState } from '../../shared/models'
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

export class AnalyticsScreen implements NativeScreen {
  private readonly controls: Controls
  private snapshot: AnalyticsSnapshot | null = null
  private selected = ''
  private artifact: AnalysisArtifactState | null = null
  private busy = false
  private artifactBusy = false
  private error = ''
  private artifactError = ''
  private version = 0
  private disposed = false
  constructor(private readonly context: NativeContext) {
    this.controls = new Controls(context)
  }
  dispose(): void {
    this.disposed = true
    this.version++
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
        heading('analytics-title', 'Data Analytics'),
        row('analytics-header', [
          label(
            'analytics-period',
            s
              ? `${s.windowDays} days · Tracking since ${s.trackingStartedAt ?? 'No recorded activity'}`
              : 'Loading local activity…',
            { flex: 1, weight: 'secondary' }
          ),
          b.button(
            'analytics-retry',
            this.busy ? 'Loading…' : 'Refresh',
            () => this.load(),
            !this.busy
          )
        ]),
        ...(this.error ? [label('analytics-error', this.error)] : []),
        ...(s
          ? [
              row('analytics-metrics', [
                metric('analytics-searches', 'Lifetime returned records', s.totals.searchResults),
                metric(
                  'analytics-window',
                  `Last ${s.windowDays} local days`,
                  s.daily.reduce((sum, day) => sum + day.searchResults, 0)
                ),
                metric('analytics-completed', 'Deep analyses', s.totals.deepAnalyses),
                metric('analytics-papers', 'Analyzed papers', s.totals.analyzedPapers)
              ]),
              {
                ...b.table(
                  'analytics-daily',
                  'Daily activity',
                  s.daily.map((day) => ({
                    id: day.date,
                    title: day.date,
                    subtitle: `Search ${day.searchResults} · Source ${day.todayResults} · Discover ${day.discoverResults} · Analysis ${day.deepAnalyses}`
                  })),
                  '',
                  () => undefined
                ),
                flex: 0,
                height: 155
              },
              label(
                'analytics-analysis-heading',
                `Latest ${Math.min(50, s.analyzedItems.length)} analyses · ${s.totals.analyzedPapers} unique analyzed papers`,
                { weight: 'bold' }
              ),
              {
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
                    (id) => this.select(id)
                  ),
                  this.reading()
                ]
              }
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
      item = this.snapshot?.analyzedItems.find((item) => item.analysisId === this.selected),
      state = this.artifact
    return scroll(
      'analytics-reading',
      column(
        recordViewId('analytics-document', this.selected),
        [
          heading('analytics-document-title', item?.title ?? 'Persistent analysis'),
          ...(item
            ? [
                b.button(
                  'analytics-open-original',
                  'Open original',
                  () => this.context.openExternal(item.url),
                  true,
                  `analysis:${item.analysisId}:open`
                )
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

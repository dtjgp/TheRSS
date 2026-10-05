import type { DashboardItem, TriageState } from '../../shared/api'
import type { AnalysisArtifact, AnalysisFreshness, AnalysisRunner } from '../../shared/models'
import { sourceDisplayName } from '../../shared/sourceIdentity'
import {
  emptyState,
  analysisText,
  column,
  Controls,
  heading,
  label,
  readableError,
  recordViewId,
  row,
  runnerAvailable,
  runnerUnavailableReason,
  scroll,
  type NativeContext,
  type NativeScreen
} from './common'
import type { NativeNode } from './presentation'
import { isShareableLink } from './researchMetadata'
import { hashAnalysisSource } from '../../core/analysis/sourceSnapshot'
import { sourcePublicationLabel, sourceMatchReasons } from '../../shared/sourceDate'

export class TriageHistory {
  private previous: { id: string; state: TriageState } | null = null
  private readonly completedStates = new Map<string, TriageState>()
  busy = false
  constructor(private readonly context: NativeContext) {}
  get canUndo(): boolean {
    return this.previous !== null && !this.busy
  }
  async change(item: DashboardItem, state: TriageState, sessionId?: string): Promise<void> {
    if (this.busy) return
    const previousState = this.state(item)
    this.busy = true
    this.context.redraw()
    try {
      this.context.data.dashboard =
        sessionId && state === 'saved'
          ? await this.context.api.saveDiscoverResult(sessionId, item.id)
          : await this.context.api.setTriageState(item.id, state)
      this.completedStates.set(item.id, state)
      if (state !== 'viewed' || previousState === 'saved') {
        this.previous = { id: item.id, state: previousState }
        this.context.notify(
          `${state === 'saved' ? 'Saved' : state === 'dismissed' ? 'Dismissed' : 'Removed from Saved'}: ${item.title}`
        )
      }
    } catch (error) {
      this.context.notify(readableError(error), 'error')
    } finally {
      this.busy = false
      this.context.redraw()
    }
  }
  state(item: DashboardItem): TriageState {
    const current = [
      ...(this.context.data.dashboard?.items ?? []),
      ...(this.context.data.dashboard?.savedItems ?? [])
    ].find((entry) => entry.id === item.id)
    return this.completedStates.get(item.id) ?? current?.triageState ?? item.triageState
  }
  async undo(): Promise<void> {
    if (!this.previous || this.busy) return
    const previous = this.previous
    this.busy = true
    this.context.redraw()
    try {
      this.context.data.dashboard = await this.context.api.setTriageState(
        previous.id,
        previous.state
      )
      this.previous = null
      this.completedStates.set(previous.id, previous.state)
      this.context.notify('Last triage action undone.')
    } catch (error) {
      this.context.notify(readableError(error), 'error')
    } finally {
      this.busy = false
      this.context.redraw()
    }
  }
}

export class ResearchReader implements NativeScreen {
  runner: AnalysisRunner = 'model-provider'
  private readonly controls: Controls
  private item: DashboardItem | null = null
  private sessionId: string | undefined
  private extra = ''
  private metadataExpanded = false
  private artifact: AnalysisArtifact | null = null
  private analysisPending = new Set<string>()
  private readonly analysisCache = new Map<string, AnalysisArtifact>()
  private readonly analysisGeneration = new Map<string, number>()
  private storedReadFailed = false
  private storedLoading = false
  private artifactFreshness: AnalysisFreshness | 'checking' | 'unavailable' = 'unavailable'
  private error = ''
  private version = 0
  private disposed = false

  constructor(
    private readonly context: NativeContext,
    private readonly scope: 'saved' | 'discover',
    private readonly triage: TriageHistory,
    /** Record windows read without changing data (no cross-window updates exist). */
    private readonly options: { readonly readOnly?: boolean } = {}
  ) {
    this.controls = new Controls(context)
  }

  select(item: DashboardItem | null, sessionId?: string, extra = ''): void {
    const changed = this.item?.id !== item?.id || this.sessionId !== sessionId
    const sourceChanged =
      !!item && !!this.item && hashAnalysisSource(item) !== hashAnalysisSource(this.item)
    this.item = item
    this.sessionId = sessionId
    this.extra = extra
    if (!changed && !sourceChanged) return
    if (changed) {
      this.metadataExpanded = false
    }
    this.artifact = item ? (this.analysisCache.get(item.id) ?? null) : null
    this.artifactFreshness = this.artifact ? 'checking' : 'unavailable'
    this.storedLoading = false
    this.storedReadFailed = false
    this.error = ''
    this.version++
    if (item) void this.loadStoredAnalysis()
  }
  dispose(): void {
    this.disposed = true
    this.version++
  }
  get selected(): DashboardItem | null {
    return this.item
  }
  private isSaved(): boolean {
    return !!this.item && this.triage.state(this.item) === 'saved'
  }
  private canAnalyze(): boolean {
    return (
      !!this.item &&
      (this.scope === 'saved' || this.item.kind === 'paper') &&
      runnerAvailable(this.context, this.runner)
    )
  }

  render(): NativeNode {
    const b = this.controls,
      item = this.item,
      prefix = this.scope
    if (!item)
      return emptyState(
        `${prefix}-reader-empty`,
        'doc.text',
        'No selection',
        'Select an item to read its full details.'
      )
    const key = `${prefix}:${this.sessionId ?? ''}:${item.id}`
    const saved = this.isSaved(),
      analyzing = this.analysisPending.has(item.id),
      readOnly = !!this.options.readOnly
    return scroll(
      `${prefix}-reading-scroll`,
      column(
        recordViewId(`${prefix}-reading-content`, `${this.sessionId ?? ''}:${item.id}`),
        [
          heading(`${prefix}-reading-title`, item.title),
          label(
            `${prefix}-reading-meta`,
            `${sourceDisplayName(item.source)} · ${sourcePublicationLabel(item)}${saved ? ' · Saved' : ''}`,
            { weight: 'secondary' }
          ),
          row(`${prefix}-reading-actions`, [
            {
              ...b.button(
                `${prefix}-open`,
                'Open original',
                () => this.context.openExternal(item.url),
                true,
                `${key}:open`
              ),
              symbol: 'arrow.up.right'
            },
            // The system sharing picker (Mail, Messages, Notes ...) for the https link.
            ...(isShareableLink(item.url)
              ? [
                  {
                    id: `${prefix}-share`,
                    kind: 'button' as const,
                    title: 'Share',
                    symbol: 'square.and.arrow.up' as const,
                    help: 'Share the link with another app',
                    share: { url: item.url }
                  }
                ]
              : []),
            ...(readOnly
              ? []
              : [
                  {
                    ...b.button(
                      `${prefix}-save`,
                      saved ? 'Unsave' : 'Save',
                      () => this.toggleSave(),
                      !this.triage.busy,
                      `${key}:save:${saved}`
                    ),
                    symbol: (saved ? 'star.fill' : 'star') as NativeNode['symbol']
                  },
                  {
                    ...b.button(
                      `${prefix}-analyze`,
                      analyzing ? 'Analyzing…' : this.artifact ? 'Analyze again' : 'Analyze',
                      () => this.analyze(),
                      !analyzing && this.canAnalyze(),
                      `${key}:analyze`
                    ),
                    symbol: 'sparkles' as const
                  },
                  ...(prefix === 'saved'
                    ? [
                        b.button(
                          `${prefix}-dismiss`,
                          'Dismiss',
                          () => this.dismiss(),
                          !this.triage.busy,
                          `${key}:dismiss`
                        )
                      ]
                    : [])
                ])
          ]),
          ...(!readOnly && !this.canAnalyze() && !analyzing
            ? [
                label(
                  `${prefix}-analysis-readiness`,
                  this.scope === 'discover' && item.kind !== 'paper'
                    ? saved
                      ? 'Open Saved to analyze this record.'
                      : 'Save this record to analyze it from Saved.'
                    : runnerUnavailableReason(this.context, this.runner),
                  { weight: 'secondary' }
                ),
                ...(this.scope === 'discover' && item.kind !== 'paper' && saved
                  ? [
                      b.button(`${prefix}-analysis-open-saved`, 'Open Saved', () =>
                        this.context.navigate('saved')
                      )
                    ]
                  : []),
                ...(this.scope === 'saved' || item.kind === 'paper'
                  ? [
                      b.button(`${prefix}-analysis-configure-runner`, 'Open Settings', () =>
                        this.context.navigate('settings')
                      )
                    ]
                  : [])
              ]
            : []),
          { ...b.rich(`${prefix}-summary`, item.summary), size: 14 },
          column(
            `${prefix}-evidence-panel`,
            [
              label(
                `${prefix}-evidence`,
                item.kind === 'paper'
                  ? 'Evidence: paper discovery metadata and retrieved summary. Full-paper results are not verified here.'
                  : 'Evidence: source metadata and retrieved summary.',
                { weight: 'secondary', size: 12 }
              )
            ],
            { surface: 'inset', padding: 10 }
          ),
          ...(sourceMatchReasons(item).length
            ? [
                b.rich(
                  `${prefix}-reasons`,
                  `## Why this matches\n\n${sourceMatchReasons(item)
                    .map((reason) => `- ${reason}`)
                    .join('\n')}`
                )
              ]
            : []),
          row(`${prefix}-detail-actions`, [
            {
              ...b.button(
                `${prefix}-metadata-toggle`,
                this.metadataExpanded ? 'Hide source details' : 'Source details',
                () => {
                  this.metadataExpanded = !this.metadataExpanded
                  this.context.redraw()
                }
              ),
              emphasis: 'quiet'
            },
            ...(!readOnly && item.source === 'arxiv'
              ? [
                  b.button(
                    `${prefix}-promote`,
                    'Preview llm-wiki promotion',
                    () => this.context.promote(item.id, this.sessionId),
                    true,
                    `${key}:promote`
                  )
                ]
              : [])
          ]),
          ...(this.metadataExpanded
            ? [
                b.rich(
                  `${prefix}-provenance`,
                  `${this.extra ? this.extra + '\n\n' : ''}## Ranking\nMatch score: ${item.score}\nDeterministic relevance ranking, not confidence or verified research quality.`
                )
              ]
            : []),
          ...(this.error ? [label(`${prefix}-analysis-error`, this.error)] : []),
          ...(this.storedReadFailed
            ? [
                b.button(
                  `${prefix}-retry-stored-analysis`,
                  'Retry stored analysis',
                  () => this.loadStoredAnalysis(),
                  true,
                  `${key}:retry-stored`
                )
              ]
            : []),
          ...(this.artifact
            ? [
                label(
                  `${prefix}-analysis-freshness`,
                  {
                    current: 'Source checked: unchanged when this analysis was opened.',
                    stale: 'Source changed since this analysis. Reanalyze before relying on it.',
                    source_missing:
                      'The original local source is missing. This is retained historical analysis.',
                    legacy_unavailable: 'This legacy analysis has no verifiable source hash.',
                    checking: 'Checking stored analysis against the local source…',
                    unavailable:
                      'Source freshness could not be verified. Original analysis provenance is retained.'
                  }[this.artifactFreshness],
                  { weight: this.artifactFreshness === 'stale' ? 'bold' : 'secondary' }
                ),
                ...(this.artifactFreshness === 'unavailable'
                  ? [
                      row(`${prefix}-freshness-actions`, [
                        b.button(`${prefix}-retry-freshness`, 'Recheck source', () =>
                          this.checkFreshness(this.artifact!, this.version)
                        )
                      ])
                    ]
                  : []),
                b.rich(`${prefix}-analysis`, analysisText(this.artifact))
              ]
            : this.storedLoading
              ? [
                  label(`${prefix}-stored-analysis-loading`, 'Loading stored analysis…', {
                    weight: 'secondary'
                  })
                ]
              : [
                  label(`${prefix}-no-analysis`, 'No stored analysis for this item.', {
                    weight: 'secondary'
                  })
                ])
        ],
        { padding: 22, gap: 12 }
      ),
      { surface: 'reading' }
    )
  }

  async analyze(): Promise<void> {
    const item = this.item,
      sessionId = this.sessionId
    if (!item || !this.canAnalyze() || this.analysisPending.has(item.id)) return
    this.analysisGeneration.set(item.id, (this.analysisGeneration.get(item.id) ?? 0) + 1)
    this.analysisPending.add(item.id)
    this.error = ''
    this.context.redraw()
    try {
      const artifact = sessionId
        ? await this.context.api.analyzeDiscoverResult(sessionId, item.id, this.runner)
        : await this.context.api.analyzeItem(item.id, this.runner)
      this.analysisCache.set(item.id, artifact)
      this.analysisGeneration.set(item.id, (this.analysisGeneration.get(item.id) ?? 0) + 1)
      if (!this.disposed && this.item?.id === item.id && this.sessionId === sessionId) {
        this.artifact = artifact
        this.storedReadFailed = false
        await this.checkFreshness(artifact, this.version)
      }
    } catch (error) {
      if (!this.disposed && this.item?.id === item.id && this.sessionId === sessionId)
        this.error = readableError(error)
    } finally {
      this.analysisPending.delete(item.id)
      this.context.redraw()
    }
  }
  private async loadStoredAnalysis(): Promise<void> {
    const item = this.item
    if (!item || this.storedLoading) return
    const version = this.version,
      generation = this.analysisGeneration.get(item.id)
    this.storedReadFailed = false
    this.storedLoading = true
    this.error = ''
    this.context.redraw()
    try {
      const artifact = await this.context.api.getLatestAnalysis(item.id)
      if (
        !this.disposed &&
        version === this.version &&
        generation === this.analysisGeneration.get(item.id)
      ) {
        this.artifact = artifact ?? this.analysisCache.get(item.id) ?? null
        if (this.artifact) await this.checkFreshness(this.artifact, version)
      }
    } catch {
      if (!this.disposed && version === this.version) {
        this.error = 'Stored analysis could not be opened.'
        this.storedReadFailed = true
      }
    }
    if (version === this.version) this.storedLoading = false
    this.context.redraw()
  }
  private async checkFreshness(artifact: AnalysisArtifact, version: number): Promise<void> {
    this.artifactFreshness = 'checking'
    this.context.redraw()
    try {
      const state = await this.context.api.getAnalysisArtifact(artifact.id)
      if (!this.disposed && version === this.version && this.artifact?.id === artifact.id)
        this.artifactFreshness =
          state?.artifact.id === artifact.id
            ? state.freshness === 'current' &&
              this.item &&
              hashAnalysisSource(this.item) !== artifact.sourceHash
              ? 'stale'
              : state.freshness
            : 'unavailable'
    } catch {
      if (!this.disposed && version === this.version && this.artifact?.id === artifact.id)
        this.artifactFreshness = 'unavailable'
    }
    this.context.redraw()
  }
  async toggleSave(): Promise<void> {
    if (this.item)
      await this.triage.change(this.item, this.isSaved() ? 'viewed' : 'saved', this.sessionId)
  }
  async dismiss(): Promise<void> {
    if (this.item && this.scope === 'saved') await this.triage.change(this.item, 'dismissed')
  }
  /** Opens the selected record in its own read-only window. */
  openWindow(): void {
    // The window shows the state as of opening (it receives no later updates).
    if (this.item)
      this.context.openRecord({
        item: { ...this.item, triageState: this.triage.state(this.item) },
        sessionId: this.sessionId,
        scope: this.scope,
        extra: this.extra
      })
  }
  async contextMenu(): Promise<void> {
    const item = this.item,
      sessionId = this.sessionId,
      version = this.version
    if (!item) return
    const result = await this.context.api.showContextMenu({
      kind: this.scope === 'saved' ? 'saved-item' : 'discover-result',
      itemId: item.id,
      ...(sessionId ? { sessionId } : {}),
      title: item.title,
      url: item.url,
      sourceLabel: sourceDisplayName(item.source),
      publishedAt: item.publishedAt,
      isSaved: this.isSaved(),
      canAnalyze: this.canAnalyze(),
      canPromote: item.source === 'arxiv',
      canOpenWindow: !this.options.readOnly
    })
    if (
      version !== this.version ||
      result.action === 'none' ||
      result.itemId !== item.id ||
      result.sessionId !== sessionId
    )
      return
    if (result.action === 'open-window') this.openWindow()
    else if (result.action === 'save' || result.action === 'unsave') await this.toggleSave()
    else if (result.action === 'analyze') await this.analyze()
    else if (result.action === 'promote') await this.context.promote(item.id, sessionId)
  }
}

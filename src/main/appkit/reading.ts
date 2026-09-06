import type { DashboardItem, TriageState } from '../../shared/api'
import type { AnalysisArtifact, AnalysisRunner } from '../../shared/models'
import { sourceDisplayName } from '../../shared/sourceIdentity'
import {
  analysisText,
  column,
  Controls,
  heading,
  label,
  readableError,
  recordViewId,
  row,
  runnerAvailable,
  scroll,
  type NativeContext,
  type NativeScreen
} from './common'
import type { NativeNode } from './presentation'

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
      this.context.notify(readableError(error))
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
      this.context.notify(readableError(error))
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
  private expanded = false
  private artifact: AnalysisArtifact | null = null
  private analysisPending = new Set<string>()
  private readonly analysisCache = new Map<string, AnalysisArtifact>()
  private readonly analysisGeneration = new Map<string, number>()
  private storedReadFailed = false
  private error = ''
  private version = 0
  private disposed = false

  constructor(
    private readonly context: NativeContext,
    private readonly scope: 'saved' | 'discover',
    private readonly triage: TriageHistory
  ) {
    this.controls = new Controls(context)
  }

  select(item: DashboardItem | null, sessionId?: string, extra = ''): void {
    const changed = this.item?.id !== item?.id || this.sessionId !== sessionId
    this.item = item
    this.sessionId = sessionId
    this.extra = extra
    if (!changed) return
    this.expanded = false
    this.artifact = item ? (this.analysisCache.get(item.id) ?? null) : null
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
      return column(
        `${prefix}-reader-empty`,
        [label(`${prefix}-empty-hint`, 'Select an item to read its full details.')],
        { flex: 1, padding: 18 }
      )
    const key = `${prefix}:${this.sessionId ?? ''}:${item.id}`
    const saved = this.isSaved(),
      analyzing = this.analysisPending.has(item.id)
    return scroll(
      `${prefix}-reading-scroll`,
      column(
        recordViewId(`${prefix}-reading-content`, `${this.sessionId ?? ''}:${item.id}`),
        [
          heading(`${prefix}-reading-title`, item.title),
          label(
            `${prefix}-reading-meta`,
            `${sourceDisplayName(item.source)} · ${item.kind ?? 'item'} · ${item.publishedAt.slice(0, 10)} · Score ${item.score}`,
            { weight: 'secondary' }
          ),
          row(`${prefix}-reading-actions`, [
            b.button(
              `${prefix}-open`,
              'Open original',
              () => this.context.openExternal(item.url),
              true,
              `${key}:open`
            ),
            b.button(
              `${prefix}-save`,
              saved ? 'Unsave' : 'Save',
              () => this.toggleSave(),
              !this.triage.busy,
              `${key}:save:${saved}`
            ),
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
          ]),
          b.rich(
            `${prefix}-summary`,
            this.expanded || item.summary.length <= 420
              ? item.summary
              : `${item.summary.slice(0, 420)}…`
          ),
          ...(item.summary.length > 420
            ? [
                b.button(
                  `${prefix}-expand`,
                  this.expanded ? 'Show less' : 'Read full summary',
                  () => {
                    this.expanded = !this.expanded
                    this.context.redraw()
                  },
                  true,
                  `${key}:expand`
                )
              ]
            : []),
          label(
            `${prefix}-evidence`,
            item.kind === 'paper'
              ? 'Evidence: arXiv abstract and metadata. Full-paper results are not verified here.'
              : 'Evidence: source metadata and retrieved summary.',
            { weight: 'secondary' }
          ),
          ...(item.reasons.length
            ? [
                b.rich(
                  `${prefix}-reasons`,
                  `## Why this matches\n\n${item.reasons.map((reason) => `- ${reason}`).join('\n')}`
                )
              ]
            : []),
          ...(this.extra ? [b.rich(`${prefix}-provenance`, this.extra)] : []),
          row(`${prefix}-analysis-actions`, [
            b.button(
              `${prefix}-analyze`,
              analyzing ? 'Analyzing…' : 'Analyze',
              () => this.analyze(),
              !analyzing && this.canAnalyze(),
              `${key}:analyze`
            ),
            ...(item.source === 'arxiv'
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
            ? [b.rich(`${prefix}-analysis`, analysisText(this.artifact))]
            : [
                label(`${prefix}-no-analysis`, 'No stored analysis for this item.', {
                  weight: 'secondary'
                })
              ])
        ],
        { padding: 18 }
      )
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
    if (!item) return
    const version = this.version,
      generation = this.analysisGeneration.get(item.id)
    this.storedReadFailed = false
    this.error = ''
    try {
      const artifact = await this.context.api.getLatestAnalysis(item.id)
      if (
        !this.disposed &&
        version === this.version &&
        generation === this.analysisGeneration.get(item.id)
      )
        this.artifact = artifact ?? this.analysisCache.get(item.id) ?? null
    } catch {
      if (!this.disposed && version === this.version) {
        this.error = 'Stored analysis could not be opened.'
        this.storedReadFailed = true
      }
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
      canPromote: item.source === 'arxiv'
    })
    if (
      version !== this.version ||
      result.action === 'none' ||
      result.itemId !== item.id ||
      result.sessionId !== sessionId
    )
      return
    if (result.action === 'save' || result.action === 'unsave') await this.toggleSave()
    else if (result.action === 'analyze') await this.analyze()
    else if (result.action === 'promote') await this.context.promote(item.id, sessionId)
  }
}

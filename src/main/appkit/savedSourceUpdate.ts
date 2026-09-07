import type { DashboardItem } from '../../shared/api'
import type { SavedSourceUpdateCandidate } from '../../shared/savedSourceUpdate'
import { hashAnalysisSource } from '../../core/analysis/sourceSnapshot'
import { Controls, column, label, readableError, row, type NativeContext } from './common'
import type { NativeNode } from './presentation'

export class SavedSourceUpdateControls {
  private readonly controls: Controls
  private item: DashboardItem | null = null
  private key = ''
  private version = 0
  private disposed = false
  private candidate: SavedSourceUpdateCandidate | null = null
  private loading = false
  private updating = false
  private failed = false
  constructor(
    private readonly context: NativeContext,
    private readonly onApplied: (item: DashboardItem | null, id: string) => void
  ) {
    this.controls = new Controls(context)
  }
  dispose(): void {
    this.disposed = true
    this.version++
  }
  select(item: DashboardItem | null): void {
    const key = item ? `${item.id}:${hashAnalysisSource(item)}:${item.triageState}` : ''
    this.item = item
    if (this.key === key) return
    this.key = key
    this.version++
    this.candidate = null
    this.loading = false
    this.updating = false
    this.failed = false
    if (item?.triageState === 'saved') void this.load()
  }
  private async load(): Promise<void> {
    const item = this.item,
      version = this.version
    if (!item || this.disposed) return
    this.loading = true
    this.failed = false
    this.context.redraw()
    try {
      const candidate = await this.context.api.getSavedSourceUpdate(item.id)
      if (this.disposed || version !== this.version) return
      this.candidate =
        candidate?.itemId === item.id && candidate.currentSourceHash === hashAnalysisSource(item)
          ? candidate
          : null
    } catch {
      if (version === this.version && !this.disposed) this.failed = true
    } finally {
      if (version === this.version && !this.disposed) {
        this.loading = false
        this.context.redraw()
      }
    }
  }
  private async update(): Promise<void> {
    const candidate = this.candidate,
      version = this.version
    if (!candidate || this.updating) return
    this.updating = true
    this.context.redraw()
    try {
      const result = await this.context.api.applySavedSourceUpdate({
        itemId: candidate.itemId,
        sessionId: candidate.sessionId,
        expectedSourceHash: candidate.currentSourceHash,
        sourceHash: candidate.sourceHash
      })
      if (this.disposed) return
      this.context.data.dashboard = result.dashboard
      this.onApplied(result.item, candidate.itemId)
      if (result.status === 'updated')
        this.context.notify('Saved snapshot updated; analysis history retained.')
      else if (result.status === 'unchanged')
        this.context.notify('The saved snapshot is already current.')
      else
        this.context.notify(
          result.status === 'conflict'
            ? 'The source changed while preparing the update. Check the latest snapshot and try again.'
            : 'This record is no longer saved. Its previous analyses were retained.',
          'error'
        )
    } catch (error) {
      if (!this.disposed && version === this.version)
        this.context.notify(readableError(error), 'error')
    } finally {
      if (!this.disposed && version === this.version) {
        this.updating = false
        await this.load()
      }
      if (!this.disposed) this.context.redraw()
    }
  }
  render(): NativeNode {
    return column(
      'saved-source-update',
      [
        row('saved-source-update-actions', [
          {
            ...this.controls.button(
              'saved-update-source',
              this.updating ? 'Updating snapshot…' : 'Update saved snapshot',
              () => this.update(),
              !!this.candidate && !this.loading && !this.updating
            )
          },
          ...(this.failed
            ? [this.controls.button('saved-source-update-retry', 'Retry check', () => this.load())]
            : [])
        ]),
        label(
          'saved-source-update-status',
          this.failed
            ? 'Could not check newer local snapshots.'
            : this.loading
              ? 'Checking newer local snapshots…'
              : this.candidate
                ? `Local retrieval: ${this.candidate.retrievedAt.slice(0, 10)}. Updates metadata and match reasons; keeps analysis history.`
                : 'No newer local snapshot. Search again to retrieve fresh metadata.',
          { weight: 'secondary' }
        )
      ],
      { gap: 6 }
    )
  }
}

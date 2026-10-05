import type { TheRSSApi } from '../../shared/api'
import { column, type NativeContext, type NativeRecord } from './common'
import { NativePresentation, type NativeAnnouncement } from './presentation'
import { ResearchReader, TriageHistory } from './reading'

export interface NativeRecordPort {
  readonly record: NativeRecord
  readonly locale?: string
  present(scene: string): void
  openExternal(url: string): void
}

/**
 * One record in its own window, as Mail opens a message: the shared reader in read-only mode.
 * Data-changing actions stay in the main window because presenters do not share updates.
 */
export class NativeRecordPresenter {
  readonly presentation = new NativePresentation()
  private readonly context: NativeContext
  private readonly reader: ResearchReader
  private zoomLevel = 1
  private pendingFocus: string | undefined
  private announcement: NativeAnnouncement | undefined
  private disposed = false

  constructor(
    api: TheRSSApi,
    private readonly port: NativeRecordPort
  ) {
    this.context = {
      api,
      locale: port.locale ?? Intl.DateTimeFormat().resolvedOptions().locale,
      presentation: this.presentation,
      data: { dashboard: null, provider: null, personalPrompt: '', agents: [] },
      redraw: () => this.redraw(),
      focus: (id) => {
        this.pendingFocus = id
        this.redraw()
      },
      notify: (message) => {
        this.announcement = {
          id: (this.announcement?.id ?? 0) + 1,
          message: message.slice(0, 2000)
        }
        this.redraw()
      },
      // A record window has no workspaces, sheets or further windows.
      navigate: async () => undefined,
      compact: () => false,
      openLocal: async () => null,
      openExternal: (url) => port.openExternal(url),
      showDocument: () => undefined,
      promote: async () => undefined,
      openRecord: () => undefined,
      width: () => 320,
      setWidth: () => undefined
    }
    this.reader = new ResearchReader(
      this.context,
      port.record.scope,
      new TriageHistory(this.context),
      {
        readOnly: true
      }
    )
  }

  async start(): Promise<void> {
    this.reader.select(this.port.record.item, this.port.record.sessionId, this.port.record.extra)
    this.redraw()
  }
  receive(json: string, secure = false): void {
    void (secure ? this.presentation.dispatchSecret(json) : this.presentation.dispatch(json))
  }
  zoom(direction: 'in' | 'out' | 'reset'): void {
    this.zoomLevel =
      direction === 'reset'
        ? 1
        : Math.max(
            0.8,
            Math.min(
              1.5,
              Math.round((this.zoomLevel + (direction === 'in' ? 0.1 : -0.1)) * 10) / 10
            )
          )
    this.redraw()
  }
  /** App menu commands (Find, workspaces, undo) belong to the main window. */
  async command(_command: string): Promise<void> {}
  layoutChanged(): void {
    this.redraw()
  }
  async flushPreferences(): Promise<void> {}
  dispose(): void {
    this.disposed = true
    this.reader.dispose()
    this.presentation.dispose()
  }
  private redraw(): void {
    if (this.disposed) return
    this.presentation.begin()
    const root = column('record-window', [this.reader.render()], {
      flex: 1,
      safeArea: true
    })
    const focus = this.pendingFocus
    this.pendingFocus = undefined
    this.port.present(
      this.presentation.finish(root, undefined, focus, this.zoomLevel, this.announcement, {
        title: this.port.record.item.title.slice(0, 200) || 'TheRSS',
        items: []
      })
    )
  }
}

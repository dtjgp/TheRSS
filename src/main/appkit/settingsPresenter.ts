import type { TheRSSApi } from '../../shared/api'
import { column, type NativeContext, type SettingsSection } from './common'
import { NativeModals } from './modals'
import { NativePresentation, type NativeAnnouncement, type NativeToolbar } from './presentation'
import { SETTINGS_SECTIONS, SettingsScreen } from './settings'

export interface NativeSettingsPort {
  readonly locale?: string
  present(scene: string): void
  openExternal(url: string): void
  /** Settings were saved: other windows reload provider, personal context and agents. */
  changed(): void
}

const sections = Object.keys(SETTINGS_SECTIONS) as SettingsSection[]

/**
 * The Settings window, as in Mail and Notes: a preference toolbar selects the pane and the
 * window title names it. Saving stays explicit; unsaved edits are guarded when it closes.
 */
export class NativeSettingsPresenter {
  readonly presentation = new NativePresentation()
  private readonly context: NativeContext
  private readonly modals: NativeModals
  private readonly screen: SettingsScreen
  private zoomLevel = 1
  private pendingFocus: string | undefined
  private announcement: NativeAnnouncement | undefined
  private renderQueued = false
  private disposed = false

  constructor(
    private readonly api: TheRSSApi,
    private readonly port: NativeSettingsPort
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
      // The Settings window has no workspaces, records or further windows.
      navigate: async () => undefined,
      compact: () => false,
      openLocal: async () => null,
      openExternal: (url) => port.openExternal(url),
      showDocument: (title, content) => this.modals.openDocument(title, content),
      promote: async () => undefined,
      openRecord: () => undefined,
      openSettings: (section) => {
        if (section) this.select(section)
      },
      width: () => 320,
      setWidth: () => undefined
    }
    this.modals = new NativeModals(this.context)
    this.screen = new SettingsScreen(this.context, { changed: () => port.changed() })
  }

  async start(): Promise<void> {
    const agents = this.api
      .getLocalAgentStatuses()
      .then((statuses) => {
        this.context.data.agents = statuses
        this.redraw()
      })
      .catch(() => undefined)
    await Promise.all([agents, this.screen.load()])
  }
  select(section: SettingsSection): void {
    this.screen.select(section)
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
  /** Workspace, item and triage commands belong to the main window. */
  async command(_command: string): Promise<void> {}
  layoutChanged(): void {
    this.redraw()
  }
  async flushPreferences(): Promise<void> {}
  dispose(): void {
    this.disposed = true
    this.screen.dispose()
    this.modals.dispose()
    this.presentation.dispose()
  }
  private redraw(): void {
    if (this.disposed || this.renderQueued) return
    this.renderQueued = true
    queueMicrotask(() => {
      this.renderQueued = false
      this.renderNow()
    })
  }
  private renderNow(): void {
    if (this.disposed) return
    this.presentation.begin()
    const root = column('settings-window', [this.screen.render()], {
      flex: 1,
      padding: 20,
      safeArea: true
    })
    const modal = this.modals.render(),
      focus = this.modals.focus ?? (modal ? undefined : this.pendingFocus)
    this.pendingFocus = undefined
    this.modals.focus = undefined
    this.port.present(
      this.presentation.finish(
        root,
        modal,
        focus,
        this.zoomLevel,
        this.announcement,
        this.toolbar()
      )
    )
  }
  private toolbar(): NativeToolbar {
    const selected = this.screen.section
    return {
      title: SETTINGS_SECTIONS[selected].title,
      style: 'preference',
      selected: `settings-${selected}`,
      items: sections.map((section) => ({
        id: `settings-${section}`,
        title: SETTINGS_SECTIONS[section].title,
        symbol: SETTINGS_SECTIONS[section].symbol,
        help: `Show ${SETTINGS_SECTIONS[section].title} settings`,
        action: this.presentation.action(`toolbar:settings-${section}`, () => this.select(section))
      }))
    }
  }
}

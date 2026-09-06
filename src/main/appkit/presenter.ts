import type { TheRSSApi } from '../../shared/api'
import type { AppCommand } from '../../shared/ipc'
import {
  column,
  Controls,
  heading,
  label,
  row,
  type NativeContext,
  type NativeScreen,
  type Route
} from './common'
import { NativePresentation } from './presentation'
import { DiscoverScreen } from './discover'
import { SavedScreen } from './saved'
import { SettingsScreen } from './settings'
import { SourcesScreen } from './sources'
import { AnalyticsScreen } from './analytics'
import { NativeModals } from './modals'
import { TriageHistory } from './reading'
import type { NativePreferences } from './preferences'

export interface NativePresenterPort {
  readonly preferences: NativePreferences
  present(scene: string): void
  persist(preferences: NativePreferences): Promise<void>
  openExternal(url: string): void
}
const routes: readonly { id: Route; title: string; short: string }[] = [
  { id: 'discover', title: 'Discover', short: 'Find' },
  { id: 'saved', title: 'Saved', short: 'Saved' },
  { id: 'analytics', title: 'Data Analytics', short: 'Stats' },
  { id: 'sources', title: 'Sources', short: 'Sources' },
  { id: 'settings', title: 'Settings', short: 'Settings' }
]

export class NativePresenter {
  readonly presentation = new NativePresentation()
  private readonly context: NativeContext
  private readonly controls: Controls
  private readonly triage: TriageHistory
  private readonly modals: NativeModals
  private readonly screens: Record<Route, NativeScreen>
  private route: Route = 'discover'
  private preferences: NativePreferences
  private loading = false
  private ready = false
  private disposed = false
  private renderQueued = false
  private navigating = false
  private notice = ''
  private noticeTimer: ReturnType<typeof setTimeout> | null = null
  private preferenceTimer: ReturnType<typeof setTimeout> | null = null
  private preferenceWork: Promise<void> = Promise.resolve()
  private readonly unsubscribe: () => void

  constructor(
    private readonly api: TheRSSApi,
    private readonly port: NativePresenterPort
  ) {
    this.preferences = { ...port.preferences }
    this.context = {
      api,
      presentation: this.presentation,
      data: { dashboard: null, provider: null, personalPrompt: '', agents: [] },
      redraw: () => this.redraw(),
      notify: (message) => this.notify(message),
      openExternal: (url) => port.openExternal(url),
      showDocument: (title, content) => this.modals.openDocument(title, content),
      promote: (itemId, sessionId) => this.modals.openPromotion(itemId, sessionId),
      width: (key) => this.preferences[key],
      setWidth: (key, width) => {
        this.preferences = { ...this.preferences, [key]: Math.round(width) }
        this.persistSoon()
      }
    }
    this.controls = new Controls(this.context)
    this.triage = new TriageHistory(this.context)
    this.modals = new NativeModals(this.context)
    this.screens = {
      discover: new DiscoverScreen(this.context, this.triage),
      saved: new SavedScreen(this.context, this.triage),
      settings: new SettingsScreen(this.context),
      sources: new SourcesScreen(this.context),
      analytics: new AnalyticsScreen(this.context)
    }
    this.unsubscribe = api.onAppCommand((command) => {
      void this.command(command).catch(() => this.notify('The command could not be completed.'))
    })
  }

  async start(): Promise<void> {
    if (this.loading || this.disposed) return
    this.loading = true
    this.notice = ''
    this.renderNow()
    try {
      const [dashboard, provider, agents, personal] = await Promise.all([
        this.api.getDashboard(),
        this.api.getModelProvider(),
        this.api.getLocalAgentStatuses(),
        this.api.getDiscoverPersonalizationSettings()
      ])
      if (this.disposed) return
      Object.assign(this.context.data, {
        dashboard,
        provider,
        agents,
        personalPrompt: personal?.prompt ?? ''
      })
      await this.screens.discover.load?.()
      this.ready = true
    } catch {
      this.notice = 'The local research index could not be opened. Retry to load your workspace.'
    } finally {
      this.loading = false
      this.renderNow()
    }
  }
  async navigate(route: Route): Promise<void> {
    if (route === this.route || this.navigating || this.modals.blocksNavigation || !this.ready)
      return
    this.navigating = true
    try {
      if (this.route === 'settings') {
        if (!(await this.api.confirmDiscardSettings())) return
        ;(this.screens.settings as SettingsScreen).discard()
      }
      await this.modals.close()
      this.route = route
      this.renderNow()
      await this.screens[route].load?.()
    } finally {
      this.navigating = false
      this.renderNow()
    }
  }
  async command(command: AppCommand): Promise<void> {
    if (this.disposed) return
    if (command === 'open-settings') await this.navigate('settings')
    else if (command === 'show-saved') await this.navigate('saved')
    else if (command === 'show-discover') await this.navigate('discover')
    else if (command === 'toggle-sidebar') {
      this.preferences = { ...this.preferences, collapsed: !this.preferences.collapsed }
      this.persistSoon()
      this.redraw()
    } else if (command === 'open-local-search') this.modals.openSearch()
    else if (command === 'open-help')
      this.modals.openDocument(
        'TheRSS Help',
        '# Your local research desk\n\nDiscover searches 22 sources using a model provider, Codex CLI, or Claude Code. Sources and returned metadata are discovery evidence. Save relevant records, read their summaries, and run a derived analysis when useful.\n\n## Keyboard\n- Command+1: Discover\n- Command+2: Saved\n- Command+F: Search local records\n- Command+comma: Settings\n- Control+Command+S: Show or hide the sidebar\n- Shift+Command+D: Save selected\n- Shift+Command+A: Analyze selected\n- Command+Backspace: Dismiss selected Saved item\n- Escape: Close a sheet\n\nNative text controls use the standard editing shortcuts. Focus a divider and use arrow keys to resize; Shift uses larger steps, Home/End reach the limits, and Escape restores its starting position.\n\n## Evidence and privacy\nSQLite is the local operational index. Analysis is derived from retrieved content and retains provider, model, prompt, source hash, and creation time. API keys are protected by the operating system. A llm-wiki promotion requires a reviewed PDF/path preview and a final write confirmation.'
      )
    else if (!this.modals.visible && this.ready) {
      const reader =
        this.route === 'discover'
          ? (this.screens.discover as DiscoverScreen).reader
          : this.route === 'saved'
            ? (this.screens.saved as SavedScreen).reader
            : null
      if (command === 'save-selected') await reader?.toggleSave()
      else if (command === 'dismiss-selected') await reader?.dismiss()
      else if (command === 'analyze-selected') await reader?.analyze()
      else if (command === 'undo-triage') await this.triage.undo()
    }
  }
  zoom(direction: 'in' | 'out' | 'reset'): void {
    this.preferences = {
      ...this.preferences,
      zoom:
        direction === 'reset'
          ? 1
          : Math.max(
              0.8,
              Math.min(
                1.5,
                Math.round((this.preferences.zoom + (direction === 'in' ? 0.1 : -0.1)) * 10) / 10
              )
            )
    }
    this.persistSoon()
    this.redraw()
  }
  receive(json: string, secure = false): void {
    void (secure ? this.presentation.dispatchSecret(json) : this.presentation.dispatch(json)).catch(
      () => this.notify('The requested operation could not be completed.')
    )
  }
  async flushPreferences(): Promise<void> {
    if (this.preferenceTimer) {
      clearTimeout(this.preferenceTimer)
      this.preferenceTimer = null
      this.queuePreferenceSave()
    }
    await this.preferenceWork
  }
  dispose(): void {
    this.disposed = true
    this.unsubscribe()
    this.presentation.dispose()
    this.modals.dispose()
    Object.values(this.screens).forEach((screen) => screen.dispose?.())
    if (this.noticeTimer) clearTimeout(this.noticeTimer)
    void this.flushPreferences()
  }
  private persistSoon(): void {
    if (this.preferenceTimer) clearTimeout(this.preferenceTimer)
    this.preferenceTimer = setTimeout(() => {
      this.preferenceTimer = null
      this.queuePreferenceSave()
    }, 200)
  }
  private queuePreferenceSave(): void {
    const snapshot = { ...this.preferences }
    this.preferenceWork = this.preferenceWork
      .then(() => this.port.persist(snapshot))
      .catch(() => this.notify('Window layout preferences could not be saved.'))
  }
  private notify(message: string): void {
    this.notice = message.slice(0, 2000)
    if (this.noticeTimer) clearTimeout(this.noticeTimer)
    this.noticeTimer = setTimeout(() => {
      this.notice = ''
      this.redraw()
    }, 6000)
    this.redraw()
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
    const b = this.controls,
      collapsed = this.preferences.collapsed
    this.presentation.begin()
    const sourceAttention = Object.values(this.context.data.dashboard?.sourceHealth ?? {}).filter(
      (status) => status === 'failed' || status === 'partial'
    ).length
    const root = {
      id: 'native-workspace',
      kind: 'split' as const,
      width: collapsed ? 84 : this.preferences.sidebar,
      minWidth: collapsed ? 84 : 184,
      minContentWidth: 636,
      maxWidth: collapsed ? 84 : 360,
      action: this.presentation.action(
        'sidebar-width',
        (width) => {
          if (!collapsed) this.context.setWidth('sidebar', width as number)
        },
        { type: 'number', min: collapsed ? 84 : 184, max: collapsed ? 84 : 360 }
      ),
      children: [
        column(
          'native-sidebar',
          [
            heading('native-brand', collapsed ? 'RSS' : 'TheRSS'),
            ...routes.map((route) => ({
              ...b.button(
                `navigate-${route.id}`,
                collapsed ? route.short : route.title,
                () => this.navigate(route.id),
                this.ready
              ),
              checked: route.id === this.route
            })),
            label('native-sidebar-space', '', { flex: 1 }),
            ...(sourceAttention
              ? [
                  b.button(
                    'source-health-attention',
                    collapsed
                      ? `! ${sourceAttention}`
                      : `${sourceAttention} sources need attention`,
                    async () => {
                      ;(this.screens.sources as SourcesScreen).attention = true
                      this.redraw()
                      await this.navigate('sources')
                    },
                    this.ready
                  )
                ]
              : []),
            b.button('sidebar-toggle', collapsed ? 'Expand' : 'Collapse sidebar', () =>
              this.command('toggle-sidebar')
            )
          ],
          { padding: collapsed ? 8 : 18, gap: 12, glass: true }
        ),
        column(
          'native-main',
          [
            row('native-toolbar', [
              label('native-workspace-label', 'RESEARCH WORKSPACE', {
                weight: 'secondary',
                flex: 1
              }),
              b.button(
                'open-local-search',
                'Find local research',
                () => this.command('open-local-search'),
                this.ready
              ),
              b.button('undo-triage', 'Undo triage', () => this.triage.undo(), this.triage.canUndo)
            ]),
            ...(this.notice ? [label('native-notice', this.notice)] : []),
            ...(this.ready
              ? [this.screens[this.route].render()]
              : [
                  column(
                    'native-loading',
                    [
                      heading(
                        'native-loading-title',
                        this.loading ? 'Opening your research desk…' : 'Workspace unavailable'
                      ),
                      ...(!this.loading
                        ? [b.button('native-load-retry', 'Retry', () => this.start())]
                        : [])
                    ],
                    { flex: 1 }
                  )
                ])
          ],
          { padding: 22, gap: 18, adaptiveScroll: true }
        )
      ]
    }
    const modal = this.modals.render(),
      focus = this.modals.focus
    this.modals.focus = undefined
    this.port.present(this.presentation.finish(root, modal, focus, this.preferences.zoom))
  }
}

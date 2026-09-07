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
import type { NativeAnnouncement, NativeNode } from './presentation'
import { DiscoverScreen } from './discover'
import { SavedScreen } from './saved'
import { SettingsScreen } from './settings'
import { SourcesScreen } from './sources'
import { AnalyticsScreen } from './analytics'
import { NativeModals } from './modals'
import { TriageHistory } from './reading'
import type { NativePreferences } from './preferences'
import type { LocalResearchTarget } from '../../shared/localResearch'

export interface NativePresenterPort {
  readonly preferences: NativePreferences
  present(scene: string): void
  persist(preferences: NativePreferences): Promise<void>
  openExternal(url: string): void
  contentSize?(): { readonly width: number; readonly height: number }
}
const routes: readonly { id: Route; title: string; short: string; symbol: NativeNode['symbol'] }[] =
  [
    { id: 'discover', title: 'Discover', short: 'Find', symbol: 'sparkle.magnifyingglass' },
    { id: 'saved', title: 'Saved', short: 'Saved', symbol: 'star' },
    { id: 'analytics', title: 'Data Analytics', short: 'Stats', symbol: 'chart.bar' },
    { id: 'sources', title: 'Sources', short: 'Sources', symbol: 'square.stack' },
    { id: 'settings', title: 'Settings', short: 'Settings', symbol: 'gearshape' }
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
  private pendingFocus: string | undefined
  private notice = ''
  private noticeKind: 'success' | 'error' = 'success'
  private announcement: NativeAnnouncement | undefined
  private localReturn: { route: Route; restore: () => void } | null = null
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
      focus: (id) => {
        this.pendingFocus = id
        this.redraw()
      },
      notify: (message, kind) => this.notify(message, kind),
      navigate: (route) => this.navigate(route),
      openLocal: (target, isCurrent) => this.openLocal(target, isCurrent),
      compact: () => {
        const width = this.port.contentSize?.().width ?? 1360
        const sidebar = this.preferences.collapsed
          ? 84
          : Math.min(this.preferences.sidebar, Math.max(184, width - 637))
        return (width - sidebar - 18 - 44 * this.preferences.zoom) / this.preferences.zoom < 700
      },
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
      void this.command(command).catch(() =>
        this.notify('The command could not be completed.', 'error')
      )
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
    if (this.navigating || this.modals.blocksNavigation || !this.ready) return
    if (
      this.localReturn &&
      !this.modals.visible &&
      !(this.screens.discover as DiscoverScreen).searching
    ) {
      this.localReturn.restore()
      this.localReturn = null
      this.redraw()
    }
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
    } else if (command === 'open-local-search') {
      this.returnToSearch(false)
    } else if (command === 'open-help')
      this.modals.openDocument(
        'TheRSS Help',
        '# Your local research desk\n\nDiscover searches 22 sources using a model provider, Codex CLI, or Claude Code. Sources and returned metadata are discovery evidence. Save relevant records, read their summaries, and run a derived analysis when useful.\n\n## Keyboard\n- Command+1: Discover\n- Command+2: Saved\n- Command+F: Search local records\n- Command+comma: Settings\n- Control+Command+S: Show or hide the sidebar\n- Shift+Command+D: Save selected\n- Shift+Command+A: Analyze selected\n- Command+Backspace: Dismiss selected Saved item\n- Escape: Close a sheet\n\nNative text controls use the standard editing shortcuts. Focus a divider and use arrow keys to resize; Shift uses larger steps, Home/End reach the limits, and Escape restores its starting position.\n\n## Evidence and privacy\nSQLite is the local operational index. Analysis is derived from retrieved content and retains provider, model, prompt, source hash, and creation time. API keys are protected by the operating system. A llm-wiki promotion requires a reviewed PDF/path preview and a final write confirmation.\n\n## Reading and recovery\nOn a narrow window, click a result or press Return to read it, then return to the retained list. Local search opens the exact Saved, search-session or analysis record; Back to search results restores the search and any original unsubmitted question.\n\n## Help and privacy\nDiscover sends your question and enabled personal context to the selected planner. Analyze sends the selected source content to its chosen provider. Local search, Saved and analytics stay in the local database. The current app has no telemetry or account synchronization.\n\n[Documentation and support](https://github.com/dtjgp/TheRSS#readme)'
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
  layoutChanged(): void {
    this.redraw()
  }
  private async openLocal(
    target: LocalResearchTarget,
    isCurrent: () => boolean
  ): Promise<string | null> {
    const record = await this.api.getLocalResearch(target)
    if (!isCurrent() || this.disposed) return null
    if (!record)
      return 'This local result is no longer available in the selected location. Search again or open its original link.'
    const route: Route = record.kind === 'analysis' ? 'analytics' : record.kind
    const discover = this.screens.discover as DiscoverScreen
    if (record.kind === 'discover' && discover.searching)
      return 'Wait for the active Discover search to finish before opening a historical session.'
    if (this.route === 'settings') {
      if (!(await this.api.confirmDiscardSettings()))
        return 'Settings were kept. Finish editing before opening this local result.'
      if (!isCurrent()) return null
      ;(this.screens.settings as SettingsScreen).discard()
    }
    if (route === 'analytics') await this.screens.analytics.load?.()
    if (!isCurrent() || this.disposed) return null
    const origin = this.route
    const restore =
      record.kind === 'discover'
        ? discover.openLocal(record.snapshot, record.itemId)
        : record.kind === 'saved'
          ? (this.screens.saved as SavedScreen).openLocal(record.item)
          : (this.screens.analytics as AnalyticsScreen).openLocal(record)
    this.localReturn = { route: origin, restore }
    this.route = route
    await this.modals.close()
    this.redraw()
    return null
  }
  private returnToSearch(restoreResults: boolean): void {
    if (!this.modals.canOpenSearch) return
    if (this.localReturn && (this.screens.discover as DiscoverScreen).searching) {
      this.notify(
        'Finish or cancel the active Discover search before returning to the earlier search context.'
      )
      return
    }
    if (this.localReturn) {
      const previous = this.localReturn
      this.localReturn = null
      previous.restore()
      this.route = previous.route
    }
    this.modals.openSearch(restoreResults)
  }
  receive(json: string, secure = false): void {
    void (secure ? this.presentation.dispatchSecret(json) : this.presentation.dispatch(json)).catch(
      () => this.notify('The requested operation could not be completed.', 'error')
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
      .catch(() => this.notify('Window layout preferences could not be saved.', 'error'))
  }
  private notify(message: string, kind: 'success' | 'error' = 'success'): void {
    this.notice = message.slice(0, 2000)
    this.noticeKind = kind
    this.announcement = this.notice
      ? { id: (this.announcement?.id ?? 0) + 1, message: this.notice }
      : this.announcement
    if (this.noticeTimer) clearTimeout(this.noticeTimer)
    this.noticeTimer =
      kind === 'error'
        ? null
        : setTimeout(() => {
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
      collapsed = this.preferences.collapsed,
      compact = this.context.compact()
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
            ...(!collapsed
              ? [
                  label('native-sidebar-caption', 'YOUR RESEARCH DESK', {
                    size: 10,
                    weight: 'secondary'
                  })
                ]
              : []),
            ...routes.map((route) => ({
              ...b.button(
                `navigate-${route.id}`,
                collapsed ? route.short : route.title,
                () => this.navigate(route.id),
                this.ready
              ),
              checked: route.id === this.route,
              emphasis: 'navigation' as const,
              symbol: collapsed ? undefined : route.symbol,
              height: 38
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
            {
              ...b.button('sidebar-toggle', collapsed ? 'Expand' : 'Collapse sidebar', () =>
                this.command('toggle-sidebar')
              ),
              emphasis: 'quiet',
              symbol: collapsed ? undefined : 'sidebar.left'
            }
          ],
          { padding: collapsed ? 8 : 18, gap: 8, glass: true }
        ),
        column(
          'native-main',
          [
            row(
              'native-toolbar',
              [
                ...(this.localReturn
                  ? [
                      {
                        ...b.button(
                          'return-local-search',
                          compact ? 'Search results' : 'Back to search results',
                          () => this.returnToSearch(true),
                          !(this.screens.discover as DiscoverScreen).searching
                        ),
                        emphasis: 'quiet' as const
                      }
                    ]
                  : []),
                label('native-notice', this.notice, {
                  weight: this.noticeKind === 'error' ? 'bold' : 'secondary',
                  maxLines: 1,
                  flex: 1
                }),
                ...(this.notice && this.noticeKind === 'error'
                  ? [
                      {
                        ...b.button(
                          'dismiss-notice',
                          compact ? 'Dismiss' : 'Dismiss message',
                          () => {
                            this.notice = ''
                            this.redraw()
                          }
                        ),
                        emphasis: 'quiet' as const
                      }
                    ]
                  : []),
                {
                  ...b.button(
                    'open-local-search',
                    compact ? 'Find' : 'Find local research',
                    () => this.command('open-local-search'),
                    this.ready
                  ),
                  emphasis: 'quiet',
                  help: 'Find local research (Command-F)',
                  symbol: 'magnifyingglass'
                },
                {
                  ...b.button(
                    'undo-triage',
                    compact ? 'Undo' : 'Undo triage',
                    () => this.triage.undo(),
                    this.triage.canUndo
                  ),
                  emphasis: 'quiet',
                  help: 'Undo the last Save, Unsave or Dismiss action',
                  symbol: 'arrow.uturn.backward'
                }
              ],
              { wrap: false }
            ),
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
      focus = this.modals.focus ?? (modal ? undefined : this.pendingFocus)
    this.pendingFocus = undefined
    this.modals.focus = undefined
    this.port.present(
      this.presentation.finish(root, modal, focus, this.preferences.zoom, this.announcement)
    )
  }
}

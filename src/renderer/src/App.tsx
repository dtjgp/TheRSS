import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import { BarChart3, Compass, Library, Settings, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DashboardSnapshot, TheRSSApi, TriageState } from '../../shared/api'
import type { AnalysisArtifact, AnalysisRunner, LocalAgentStatus } from '../../shared/models'
import { DiscoverView } from './DiscoverView'
import { DataAnalyticsView } from './DataAnalyticsView'
import { SignalWorkspace } from './SignalWorkspace'
import { useSystemAccent } from './useSystemAccent'
import { SourceCatalogView } from './SourceCatalogView'
import { SettingsView } from './SettingsView'
import { AppTopbar } from './AppTopbar'
import type { AppView } from './AppTopbar'
import type { DiscoverySource } from '../../shared/discovery'
import { ACTIVE_TODAY_SOURCE_IDS, sourceDisplayName } from '../../shared/sourceIdentity'
import { LocalSearchPanel } from './LocalSearchPanel'

interface AppProps {
  readonly api: TheRSSApi
}

interface NavigationItem {
  readonly view: AppView
  readonly index: string
  readonly label: string
  readonly icon: LucideIcon
}

const primaryNavigationItems: readonly NavigationItem[] = [
  { view: 'discover', index: '01', label: 'Discover', icon: Compass },
  { view: 'saved', index: '02', label: 'Saved', icon: Star }
]

const secondaryNavigationItems: readonly NavigationItem[] = [
  { view: 'analytics', index: '03', label: 'Data Analytics', icon: BarChart3 },
  { view: 'sources', index: '04', label: 'Sources', icon: Library }
]

const SIDEBAR_WIDTH_STORAGE_KEY = 'therss.sidebar-width'
const SIDEBAR_MIN_WIDTH = 184
const SIDEBAR_MAX_WIDTH = 360
const SIDEBAR_KEYBOARD_STEP = 8
const SIDEBAR_CONSTRAINED_VIEWPORT_WIDTH = 760
const MAIN_CONTENT_MIN_WIDTH = 640

interface SidebarResizeDrag {
  readonly pointerId: number
  readonly startX: number
  readonly startWidth: number
  readonly startPreferredWidth: number
}

function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)))
}

function defaultSidebarWidth(viewportWidth: number): number {
  if (viewportWidth <= 920) return SIDEBAR_MIN_WIDTH
  if (viewportWidth <= 1120) return 196
  return 224
}

function maximumSidebarWidth(viewportWidth: number): number {
  return clampSidebarWidth(viewportWidth - MAIN_CONTENT_MIN_WIDTH)
}

function readSidebarWidth(): number {
  try {
    const storedWidth = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY))
    return Number.isFinite(storedWidth) && storedWidth > 0
      ? clampSidebarWidth(storedWidth)
      : defaultSidebarWidth(window.innerWidth)
  } catch {
    return defaultSidebarWidth(window.innerWidth)
  }
}

function persistSidebarWidth(width: number): void {
  try {
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(width))
  } catch {
    // Resizing remains available when renderer storage is unavailable.
  }
}

interface LastTriageAction {
  readonly id: string
  readonly title: string
  readonly previousState: TriageState
  readonly nextState: TriageState
}

function getSourceHealthSummary(snapshot: DashboardSnapshot | null): {
  readonly label: string
  readonly tone: 'ready' | 'working' | 'attention' | 'idle'
} {
  if (!snapshot) return { label: 'Opening local index', tone: 'idle' }
  const states = Object.values(snapshot.sourceHealth)
  if (states.some((state) => state === 'failed' || state === 'partial')) {
    return { label: 'Source attention needed', tone: 'attention' }
  }
  if (states.some((state) => state === 'refreshing')) {
    return { label: 'Refreshing sources', tone: 'working' }
  }
  if (states.every((state) => state === 'healthy' || state === 'no_results')) {
    return { label: 'Sources ready', tone: 'ready' }
  }
  if (states.some((state) => state === 'healthy' || state === 'no_results')) {
    return { label: 'Some sources pending', tone: 'idle' }
  }
  return { label: 'Local index ready', tone: 'idle' }
}

export function App({ api }: AppProps) {
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<AppView>('discover')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [preferredSidebarWidth, setPreferredSidebarWidth] = useState(readSidebarWidth)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const [isSidebarResizing, setIsSidebarResizing] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const preferredSidebarWidthRef = useRef(preferredSidebarWidth)
  const sidebarResizeDragRef = useRef<SidebarResizeDrag | null>(null)
  const [sourceFilter, setSourceFilter] = useState<'all' | DiscoverySource>('all')
  const [sourceAttentionOnly, setSourceAttentionOnly] = useState(false)
  const [analysisRunner, setAnalysisRunner] = useState<AnalysisRunner>('model-provider')
  const [localAgents, setLocalAgents] = useState<readonly LocalAgentStatus[]>([])
  const [analysis, setAnalysis] = useState<AnalysisArtifact | null>(null)
  const [analyzingItemId, setAnalyzingItemId] = useState<string | null>(null)
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null)
  const [lastTriageAction, setLastTriageAction] = useState<LastTriageAction | null>(null)
  const [isTriageToastVisible, setIsTriageToastVisible] = useState(false)
  const [settingsDirty, setSettingsDirty] = useState(false)
  const [isLocalSearchOpen, setIsLocalSearchOpen] = useState(false)

  const navigate = useCallback(
    async (view: AppView) => {
      if (view === activeView) return
      if (activeView === 'settings' && settingsDirty) {
        const shouldDiscard = await api.confirmDiscardSettings()
        if (!shouldDiscard) return
        setSettingsDirty(false)
        api.setSettingsDirty(false)
      }
      if (mainRef.current) {
        mainRef.current.scrollTop = 0
        mainRef.current.scrollLeft = 0
      }
      setActiveView(view)
      setIsTriageToastVisible(false)
    },
    [activeView, api, settingsDirty]
  )

  const handleSettingsDirtyChange = useCallback(
    (isDirty: boolean) => {
      setSettingsDirty(isDirty)
      api.setSettingsDirty(isDirty)
    },
    [api]
  )

  const viewItems = dashboard?.savedItems.length
    ? dashboard.savedItems
    : (dashboard?.items.filter((item) => item.triageState === 'saved') ?? [])
  const visibleItems = viewItems.filter(
    (item) => sourceFilter === 'all' || item.source === sourceFilter
  )
  const viewCounts = {
    arxiv: viewItems.filter((item) => item.source === 'arxiv').length,
    github: viewItems.filter((item) => item.source === 'github').length,
    other: viewItems.filter((item) => item.source !== 'arxiv' && item.source !== 'github').length,
    unread: viewItems.filter((item) => item.triageState === 'new').length
  }
  const additionalSources = ACTIVE_TODAY_SOURCE_IDS.filter(
    (source) => source !== 'arxiv' && source !== 'github'
  )
  const sourceHealthSummary = getSourceHealthSummary(dashboard)
  const savedFilterLabel =
    sourceFilter === 'all'
      ? 'All sources'
      : sourceFilter === 'arxiv'
        ? 'arXiv only'
        : sourceFilter === 'github'
          ? 'GitHub only'
          : sourceDisplayName(sourceFilter)
  const sidebarMaximumWidth = maximumSidebarWidth(viewportWidth)
  const sidebarWidth = Math.min(preferredSidebarWidth, sidebarMaximumWidth)
  const isSidebarConstrained = viewportWidth <= SIDEBAR_CONSTRAINED_VIEWPORT_WIDTH
  const isSidebarEffectivelyCollapsed = isSidebarCollapsed || isSidebarConstrained

  const updateSidebarWidth = useCallback(
    (width: number, persist: boolean) => {
      const maximumWidth = maximumSidebarWidth(viewportWidth)
      const currentPreferredWidth = preferredSidebarWidthRef.current
      const currentWidth = Math.min(currentPreferredWidth, maximumWidth)
      const nextWidth = Math.min(clampSidebarWidth(width), maximumWidth)
      if (nextWidth === currentWidth && currentPreferredWidth !== currentWidth) return
      preferredSidebarWidthRef.current = nextWidth
      setPreferredSidebarWidth(nextWidth)
      if (persist) persistSidebarWidth(nextWidth)
    },
    [viewportWidth]
  )

  const startSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isSidebarEffectivelyCollapsed || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    sidebarResizeDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: sidebarWidth,
      startPreferredWidth: preferredSidebarWidthRef.current
    }
    setIsSidebarResizing(true)
  }

  const moveSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = sidebarResizeDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    updateSidebarWidth(drag.startWidth + event.clientX - drag.startX, false)
  }

  const finishSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = sidebarResizeDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    const finalWidth = Math.min(
      clampSidebarWidth(drag.startWidth + event.clientX - drag.startX),
      maximumSidebarWidth(viewportWidth)
    )
    if (finalWidth === drag.startWidth && drag.startPreferredWidth !== drag.startWidth) {
      preferredSidebarWidthRef.current = drag.startPreferredWidth
      setPreferredSidebarWidth(drag.startPreferredWidth)
    } else {
      updateSidebarWidth(finalWidth, true)
    }
    sidebarResizeDragRef.current = null
    setIsSidebarResizing(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const cancelSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = sidebarResizeDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    preferredSidebarWidthRef.current = drag.startPreferredWidth
    setPreferredSidebarWidth(drag.startPreferredWidth)
    sidebarResizeDragRef.current = null
    setIsSidebarResizing(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const resizeSidebarWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    let nextWidth: number | null = null
    const step = event.shiftKey ? SIDEBAR_KEYBOARD_STEP * 4 : SIDEBAR_KEYBOARD_STEP
    if (event.key === 'ArrowLeft') nextWidth = sidebarWidth - step
    if (event.key === 'ArrowRight') nextWidth = sidebarWidth + step
    if (event.key === 'Home') nextWidth = SIDEBAR_MIN_WIDTH
    if (event.key === 'End') nextWidth = SIDEBAR_MAX_WIDTH
    if (nextWidth === null) return
    event.preventDefault()
    updateSidebarWidth(nextWidth, true)
  }

  useEffect(() => {
    const handleWindowResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [])

  useEffect(() => {
    let isActive = true
    api
      .getDashboard()
      .then((snapshot) => {
        if (!isActive) return
        setDashboard(snapshot)
      })
      .catch(() => {
        if (isActive) setError('The local research index could not be opened.')
      })
    return () => {
      isActive = false
    }
  }, [api])

  useEffect(() => {
    let isActive = true
    api
      .getLocalAgentStatuses()
      .then((statuses) => {
        if (isActive) setLocalAgents(statuses)
      })
      .catch(() => {
        if (isActive) setLocalAgents([])
      })
    return () => {
      isActive = false
    }
  }, [api])

  const updateTriage = useCallback(
    async (id: string, state: TriageState) => {
      setError(null)
      const item = [...(dashboard?.items ?? []), ...(dashboard?.savedItems ?? [])].find(
        (candidate) => candidate.id === id
      )
      try {
        setDashboard(await api.setTriageState(id, state))
        const isPassiveRead = item?.triageState === 'new' && state === 'viewed'
        if (item && item.triageState !== state && !isPassiveRead) {
          setLastTriageAction({
            id,
            title: item.title,
            previousState: item.triageState,
            nextState: state
          })
          setIsTriageToastVisible(true)
        }
      } catch {
        setError('The item state could not be updated. The local index was not changed.')
      }
    },
    [api, dashboard]
  )

  const undoLastTriage = useCallback(async () => {
    if (!lastTriageAction) return
    setError(null)
    try {
      setDashboard(await api.setTriageState(lastTriageAction.id, lastTriageAction.previousState))
      setLastTriageAction(null)
      setIsTriageToastVisible(false)
    } catch {
      setError('Undo failed. The latest item state is still active.')
    }
  }, [api, lastTriageAction])

  useEffect(() => {
    if (!lastTriageAction || !isTriageToastVisible) return
    const timeout = window.setTimeout(() => setIsTriageToastVisible(false), 6_000)
    return () => window.clearTimeout(timeout)
  }, [isTriageToastVisible, lastTriageAction])

  useEffect(() => {
    const handleUndoShortcut = (event: KeyboardEvent) => {
      if (
        !lastTriageAction ||
        event.key.toLowerCase() !== 'z' ||
        !event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey ||
        (event.target instanceof HTMLElement &&
          (event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLSelectElement ||
            event.target instanceof HTMLTextAreaElement ||
            event.target.isContentEditable))
      ) {
        return
      }
      event.preventDefault()
      void undoLastTriage()
    }
    window.addEventListener('keydown', handleUndoShortcut)
    return () => window.removeEventListener('keydown', handleUndoShortcut)
  }, [lastTriageAction, undoLastTriage])

  const analyzeItem = useCallback(
    async (id: string) => {
      setAnalyzingItemId(id)
      setError(null)
      try {
        setAnalysis(await api.analyzeItem(id, analysisRunner))
      } catch {
        setError(
          analysisRunner === 'model-provider'
            ? 'Analysis failed. Configure or check the selected model provider.'
            : `Analysis failed. Confirm ${analysisRunner === 'codex' ? 'Codex CLI' : 'Claude Code'} is installed and signed in.`
        )
      } finally {
        setAnalyzingItemId(null)
      }
    },
    [analysisRunner, api]
  )

  useEffect(() => {
    if (!selectedSignalId || activeView !== 'saved') return
    let isActive = true
    api
      .getLatestAnalysis(selectedSignalId)
      .then((artifact) => {
        if (isActive && artifact?.itemId === selectedSignalId) setAnalysis(artifact)
      })
      .catch(() => {
        if (isActive) setError('The latest saved analysis could not be opened.')
      })
    return () => {
      isActive = false
    }
  }, [activeView, api, selectedSignalId])

  useSystemAccent(api)

  useEffect(
    () =>
      api.onAppCommand((command) => {
        switch (command) {
          case 'open-help':
            // Routed through the main process' vetted external-URL handler.
            window.open('https://github.com/dtjgp/TheRSS#readme', '_blank', 'noreferrer')
            return
          case 'open-settings':
            void navigate('settings')
            return
          case 'open-local-search':
            setIsLocalSearchOpen(true)
            return
          case 'show-saved':
            void navigate('saved')
            return
          case 'show-discover':
            void navigate('discover')
            return
          case 'toggle-sidebar':
            if (!isSidebarConstrained) setIsSidebarCollapsed((current) => !current)
            return
          case 'undo-triage':
            void undoLastTriage()
            return
        }

        if (!selectedSignalId || activeView !== 'saved') return
        const selectedItem = [...(dashboard?.items ?? []), ...(dashboard?.savedItems ?? [])].find(
          (item) => item.id === selectedSignalId
        )
        if (!selectedItem) return

        if (command === 'save-selected') {
          void updateTriage(
            selectedItem.id,
            selectedItem.triageState === 'saved' ? 'viewed' : 'saved'
          )
        } else if (command === 'dismiss-selected') {
          void updateTriage(selectedItem.id, 'dismissed')
        } else if (command === 'analyze-selected') {
          void analyzeItem(selectedItem.id)
        }
      }),
    [
      activeView,
      analyzeItem,
      api,
      dashboard,
      isSidebarConstrained,
      navigate,
      selectedSignalId,
      undoLastTriage,
      updateTriage
    ]
  )

  return (
    <div
      className={`app-shell ${isSidebarEffectivelyCollapsed ? 'app-shell--sidebar-collapsed' : ''} ${isSidebarResizing ? 'app-shell--sidebar-resizing' : ''}`}
      data-view={activeView}
      data-sidebar-constrained={String(isSidebarConstrained)}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-lockup__index">TR</span>
          <div className="brand-lockup__copy">
            <strong>TheRSS</strong>
            <span>research signal desk</span>
          </div>
        </div>
        <nav aria-label="Primary navigation">
          {primaryNavigationItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.view}
                type="button"
                className={`nav-item ${activeView === item.view ? 'nav-item--active' : ''}`}
                aria-current={activeView === item.view ? 'page' : undefined}
                aria-label={`${item.index} ${item.label}`}
                title={isSidebarEffectivelyCollapsed ? item.label : undefined}
                onClick={() => void navigate(item.view)}
              >
                <Icon className="nav-item__icon" aria-hidden="true" size={17} strokeWidth={1.8} />
                <span className="nav-item__label">{item.label}</span>
              </button>
            )
          })}
        </nav>
        <nav className="sidebar__secondary" aria-label="Research utilities">
          {secondaryNavigationItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.view}
                type="button"
                className={`nav-item ${activeView === item.view ? 'nav-item--active' : ''}`}
                aria-current={activeView === item.view ? 'page' : undefined}
                aria-label={`${item.index} ${item.label}`}
                title={isSidebarEffectivelyCollapsed ? item.label : undefined}
                onClick={() => {
                  if (item.view === 'sources') setSourceAttentionOnly(false)
                  void navigate(item.view)
                }}
              >
                <Icon className="nav-item__icon" aria-hidden="true" size={17} strokeWidth={1.8} />
                <span className="nav-item__label">{item.label}</span>
              </button>
            )
          })}
        </nav>
        <nav className="sidebar__utility" aria-label="Application utilities">
          <button
            type="button"
            className={`nav-item sidebar__settings ${activeView === 'settings' ? 'nav-item--active' : ''}`}
            aria-current={activeView === 'settings' ? 'page' : undefined}
            aria-label="Settings"
            title={isSidebarEffectivelyCollapsed ? 'Settings' : undefined}
            onClick={() => void navigate('settings')}
          >
            <Settings className="nav-item__icon" aria-hidden="true" size={17} strokeWidth={1.8} />
            <span className="nav-item__label">Settings</span>
          </button>
          <button
            type="button"
            className="sidebar__footer"
            aria-label={sourceHealthSummary.label}
            title={sourceHealthSummary.label}
            onClick={() => {
              setSourceAttentionOnly(sourceHealthSummary.tone === 'attention')
              void navigate('sources')
            }}
          >
            <span className={`status-dot status-dot--${sourceHealthSummary.tone}`} />
            <span>{sourceHealthSummary.label}</span>
          </button>
        </nav>
      </aside>

      <div
        className="sidebar-resizer"
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={sidebarMaximumWidth}
        aria-valuenow={sidebarWidth}
        aria-valuetext={`${sidebarWidth} pixels`}
        hidden={isSidebarEffectivelyCollapsed}
        tabIndex={isSidebarEffectivelyCollapsed ? -1 : 0}
        title="Drag to resize sidebar"
        onPointerDown={startSidebarResize}
        onPointerMove={moveSidebarResize}
        onPointerUp={finishSidebarResize}
        onPointerCancel={cancelSidebarResize}
        onLostPointerCapture={cancelSidebarResize}
        onKeyDown={resizeSidebarWithKeyboard}
      />

      <main ref={mainRef}>
        <AppTopbar
          activeView={activeView}
          dashboard={dashboard}
          date={dashboard?.date ?? null}
          isSidebarCollapsed={isSidebarEffectivelyCollapsed}
          isSidebarConstrained={isSidebarConstrained}
          onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
          savedCount={viewItems.length}
          savedFilterLabel={savedFilterLabel}
          settingsDirty={settingsDirty}
        />

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {!dashboard && !error && (
          <div className="loading-state" role="status">
            Opening local research index…
          </div>
        )}
        {activeView === 'settings' && (
          <SettingsView
            api={api}
            localAgents={localAgents}
            onDirtyChange={handleSettingsDirtyChange}
          />
        )}
        {activeView === 'discover' && (
          <DiscoverView api={api} localAgents={localAgents} onDashboardChange={setDashboard} />
        )}
        {activeView === 'analytics' && <DataAnalyticsView api={api} />}
        {activeView === 'sources' && (
          <SourceCatalogView
            api={api}
            sourceHealth={dashboard?.sourceHealth}
            sourceHealthDetails={dashboard?.sourceHealthDetails}
            attentionOnly={sourceAttentionOnly}
            onAttentionOnlyChange={setSourceAttentionOnly}
            onDashboardChange={setDashboard}
          />
        )}
        {dashboard && activeView === 'saved' && (
          <section className="today-view">
            <div className="today-view__heading">
              <div>
                <p className="eyebrow">RESEARCH SHELF</p>
                <h1>Saved research signals</h1>
              </div>
              <div className="signal-counts" aria-label="Inbox counts">
                <span>
                  <strong>{viewCounts.arxiv}</strong> papers
                </span>
                <span>
                  <strong>{viewCounts.github}</strong> repos
                </span>
                <span>
                  <strong>{viewCounts.other}</strong> other
                </span>
                <span>
                  <strong>{viewCounts.unread}</strong> unread
                </span>
              </div>
            </div>

            <div className="inbox-toolbar">
              <div className="inbox-toolbar__sources">
                <div
                  className="source-filters"
                  role="group"
                  aria-label="Filter saved signals by source"
                >
                  <button
                    type="button"
                    aria-label="Show all sources"
                    aria-pressed={sourceFilter === 'all'}
                    onClick={() => setSourceFilter('all')}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    aria-label="Show arXiv only"
                    aria-pressed={sourceFilter === 'arxiv'}
                    onClick={() => setSourceFilter('arxiv')}
                  >
                    arXiv
                  </button>
                  <button
                    type="button"
                    aria-label="Show GitHub only"
                    aria-pressed={sourceFilter === 'github'}
                    onClick={() => setSourceFilter('github')}
                  >
                    GitHub
                  </button>
                  <select
                    aria-label="Show another source"
                    value={
                      sourceFilter !== 'all' &&
                      sourceFilter !== 'arxiv' &&
                      sourceFilter !== 'github'
                        ? sourceFilter
                        : ''
                    }
                    onChange={(event) => {
                      if (event.target.value) setSourceFilter(event.target.value as DiscoverySource)
                    }}
                  >
                    <option value="">More sources</option>
                    {additionalSources.map((source) => (
                      <option key={source} value={source}>
                        {sourceDisplayName(source)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="analysis-runner-control">
                <span>Analyze with</span>
                <select
                  aria-label="Analysis runner"
                  value={analysisRunner}
                  onChange={(event) => setAnalysisRunner(event.target.value as AnalysisRunner)}
                >
                  <option value="model-provider">Model provider</option>
                  {localAgents.map((agent) => (
                    <option key={agent.runner} value={agent.runner} disabled={!agent.available}>
                      {agent.label}
                      {agent.available ? '' : ' (not detected)'}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {viewItems.length === 0 ? (
              <div className="quiet-state">
                <span>0 SIGNALS</span>
                <h2>No saved signals yet.</h2>
                <p>Save a Discover result and it will appear here.</p>
              </div>
            ) : (
              <div className="today-stage today-stage--single">
                {visibleItems.length === 0 ? (
                  <div className="quiet-state quiet-state--filtered">
                    <span>0 MATCHES</span>
                    <h2>No signals from this source.</h2>
                    <p>Choose another source to see saved records.</p>
                  </div>
                ) : (
                  <SignalWorkspace
                    api={api}
                    items={visibleItems}
                    analysis={analysis}
                    analyzingItemId={analyzingItemId}
                    selectedItemId={selectedSignalId}
                    onTriage={updateTriage}
                    onAnalyze={analyzeItem}
                    onSelectionChange={setSelectedSignalId}
                  />
                )}
              </div>
            )}
          </section>
        )}
        {lastTriageAction && isTriageToastVisible && (
          <div className="triage-toast" role="status">
            <span>
              {lastTriageAction.nextState === 'dismissed'
                ? `Dismissed “${lastTriageAction.title}”`
                : `Updated “${lastTriageAction.title}”`}
            </span>
            <button type="button" onClick={() => void undoLastTriage()}>
              Undo
            </button>
          </div>
        )}
      </main>
      {isLocalSearchOpen && (
        <LocalSearchPanel api={api} onClose={() => setIsLocalSearchOpen(false)} />
      )}
    </div>
  )
}

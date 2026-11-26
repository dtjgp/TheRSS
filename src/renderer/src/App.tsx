import { useNativeGlass } from './useNativeGlass'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { BarChart3, Compass, Library, Settings, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DashboardSnapshot, TheRSSApi, TriageState } from '../../shared/api'
import type { AnalysisArtifact, AnalysisRunner, LocalAgentStatus } from '../../shared/models'
import { DiscoverView } from './DiscoverView'
import { DataAnalyticsView } from './DataAnalyticsView'
import { useSystemAccent } from './useSystemAccent'
import { SourceCatalogView } from './SourceCatalogView'
import { SettingsView } from './SettingsView'
import { AppTopbar } from './AppTopbar'
import type { AppView } from './AppTopbar'
import type { DiscoverySource } from '../../shared/discovery'
import { sourceDisplayName } from '../../shared/sourceIdentity'
import { LocalSearchPanel } from './LocalSearchPanel'
import { SavedSignalsView } from './SavedSignalsView'
import { SIDEBAR_MIN_WIDTH, useSidebarResize } from './useSidebarResize'

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

interface LastTriageAction {
  readonly id: string
  readonly title: string
  readonly previousState: TriageState
  readonly nextState: TriageState
}

export function App({ api }: AppProps) {
  useNativeGlass(api.nativeGlass)
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<AppView>('discover')
  const mainRef = useRef<HTMLElement>(null)
  const {
    sidebarWidth,
    sidebarMaximumWidth,
    isSidebarConstrained,
    isSidebarEffectivelyCollapsed,
    isSidebarResizing,
    toggleSidebar,
    toggleSidebarIfUnconstrained,
    startSidebarResize,
    moveSidebarResize,
    finishSidebarResize,
    cancelSidebarResize,
    resizeSidebarWithKeyboard
  } = useSidebarResize()
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
  const savedFilterLabel =
    sourceFilter === 'all'
      ? 'All sources'
      : sourceFilter === 'arxiv'
        ? 'arXiv only'
        : sourceFilter === 'github'
          ? 'GitHub only'
          : sourceDisplayName(sourceFilter)

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
          case 'show-analytics':
            void navigate('analytics')
            return
          case 'show-sources':
            void navigate('sources')
            return
          case 'toggle-sidebar':
            toggleSidebarIfUnconstrained()
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
      navigate,
      selectedSignalId,
      toggleSidebarIfUnconstrained,
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
        <p className="sidebar__title">TheRSS</p>
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
          onToggleSidebar={toggleSidebar}
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
          <SavedSignalsView
            api={api}
            viewItems={viewItems}
            visibleItems={visibleItems}
            sourceFilter={sourceFilter}
            onSourceFilterChange={setSourceFilter}
            analysisRunner={analysisRunner}
            onAnalysisRunnerChange={setAnalysisRunner}
            localAgents={localAgents}
            analysis={analysis}
            analyzingItemId={analyzingItemId}
            selectedSignalId={selectedSignalId}
            onTriage={updateTriage}
            onAnalyze={analyzeItem}
            onSelectionChange={setSelectedSignalId}
            onDashboardChange={setDashboard}
          />
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

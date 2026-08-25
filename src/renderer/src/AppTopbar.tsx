import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { DashboardSnapshot, SourceHealth } from '../../shared/api'
import { ACTIVE_TODAY_SOURCE_IDS } from '../../shared/sourceIdentity'

export type AppView = 'discover' | 'saved' | 'settings' | 'analytics' | 'sources'

type ContextTone = 'ready' | 'working' | 'attention' | 'idle'

interface TopbarContext {
  readonly primary: string
  readonly secondary: string
  readonly tone: ContextTone
}

interface AppTopbarProps {
  readonly activeView: AppView
  readonly dashboard: DashboardSnapshot | null
  readonly date: string | null
  readonly isSidebarCollapsed: boolean
  readonly onToggleSidebar: () => void
  readonly savedCount: number
  readonly savedFilterLabel: string
  readonly settingsDirty: boolean
}

const viewLabels: Readonly<Record<AppView, string>> = {
  discover: 'Discover',
  saved: 'Saved',
  settings: 'Settings',
  analytics: 'Data Analytics',
  sources: 'Sources'
}

function sourceStates(dashboard: DashboardSnapshot): readonly SourceHealth[] {
  return ACTIVE_TODAY_SOURCE_IDS.map((source) => dashboard.sourceHealth[source] ?? 'idle')
}

function sourceStatus(dashboard: DashboardSnapshot): {
  readonly attention: number
  readonly idle: number
  readonly ready: number
  readonly refreshing: number
} {
  const states = sourceStates(dashboard)
  return {
    attention: states.filter((state) => state === 'failed' || state === 'partial').length,
    idle: states.filter((state) => state === 'idle').length,
    ready: states.filter((state) => state === 'healthy' || state === 'no_results').length,
    refreshing: states.filter((state) => state === 'refreshing').length
  }
}

function discoverContext(dashboard: DashboardSnapshot): TopbarContext {
  const status = sourceStatus(dashboard)
  if (status.attention > 0) {
    return {
      primary: `${ACTIVE_TODAY_SOURCE_IDS.length} sources`,
      secondary: `${status.attention} need attention`,
      tone: 'attention'
    }
  }
  if (status.refreshing > 0) {
    return {
      primary: `${ACTIVE_TODAY_SOURCE_IDS.length} sources`,
      secondary: `${status.refreshing} refreshing`,
      tone: 'working'
    }
  }
  if (status.ready === ACTIVE_TODAY_SOURCE_IDS.length) {
    return {
      primary: `${ACTIVE_TODAY_SOURCE_IDS.length} sources`,
      secondary: 'Sources ready',
      tone: 'ready'
    }
  }
  return {
    primary: `${ACTIVE_TODAY_SOURCE_IDS.length} sources`,
    secondary: 'Some sources pending',
    tone: 'idle'
  }
}

function sourcesContext(dashboard: DashboardSnapshot): TopbarContext {
  const status = sourceStatus(dashboard)
  const secondary = `${ACTIVE_TODAY_SOURCE_IDS.length} configured`
  if (status.attention > 0) {
    return {
      primary: `${status.attention} need attention`,
      secondary,
      tone: 'attention'
    }
  }
  if (status.refreshing > 0) {
    return { primary: `${status.refreshing} refreshing`, secondary, tone: 'working' }
  }
  if (status.ready > 0) {
    return { primary: `${status.ready} recorded ready`, secondary, tone: 'ready' }
  }
  return { primary: `${status.idle} not checked`, secondary, tone: 'idle' }
}

function topbarContext({
  activeView,
  dashboard,
  savedCount,
  savedFilterLabel,
  settingsDirty
}: Pick<
  AppTopbarProps,
  'activeView' | 'dashboard' | 'savedCount' | 'savedFilterLabel' | 'settingsDirty'
>): TopbarContext {
  if (!dashboard) {
    return { primary: 'Opening local index', secondary: 'No status yet', tone: 'idle' }
  }
  if (activeView === 'discover') return discoverContext(dashboard)
  if (activeView === 'saved') {
    return {
      primary: `${savedCount} saved`,
      secondary: savedFilterLabel,
      tone: savedCount > 0 ? 'ready' : 'idle'
    }
  }
  if (activeView === 'analytics') {
    return { primary: 'Local only', secondary: 'No telemetry', tone: 'ready' }
  }
  if (activeView === 'sources') return sourcesContext(dashboard)
  if (settingsDirty) {
    return {
      primary: 'Unsaved changes',
      secondary: 'Review before leaving',
      tone: 'attention'
    }
  }
  return { primary: 'Local settings', secondary: 'All changes saved', tone: 'idle' }
}

export function AppTopbar(props: AppTopbarProps) {
  const context = topbarContext(props)
  return (
    <header className="topbar">
      <div className="topbar__leading">
        <button
          type="button"
          className="toolbar-button"
          aria-label={props.isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          aria-pressed={props.isSidebarCollapsed}
          onClick={props.onToggleSidebar}
        >
          {props.isSidebarCollapsed ? (
            <PanelLeftOpen aria-hidden="true" size={17} strokeWidth={1.8} />
          ) : (
            <PanelLeftClose aria-hidden="true" size={17} strokeWidth={1.8} />
          )}
        </button>
        <div className="topbar__identity">
          <span className="profile-name">{viewLabels[props.activeView]}</span>
          <span className="dateline">{props.date ?? 'Loading local index…'}</span>
        </div>
      </div>
      <div
        className="topbar-context"
        role="group"
        aria-label="View context"
        data-tone={context.tone}
      >
        {props.activeView === 'settings' && props.settingsDirty ? (
          <span role="status">{context.primary}</span>
        ) : (
          <span>{context.primary}</span>
        )}
        <span className="topbar-context__secondary">{context.secondary}</span>
      </div>
    </header>
  )
}

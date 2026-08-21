import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import { BarChart3, Bot, Compass, Library, PanelLeftClose, PanelLeftOpen, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DashboardSnapshot, TheRSSApi, TriageState } from '../../shared/api'
import { DISCOVER_PERSONALIZATION_PROMPT_MAX_LENGTH } from '../../shared/personalization'
import type {
  AnalysisArtifact,
  AnalysisRunner,
  LocalAgentStatus,
  ModelProtocol,
  ModelProviderInput,
  ModelProviderSummary
} from '../../shared/models'
import { DiscoverView } from './DiscoverView'
import { DataAnalyticsView } from './DataAnalyticsView'
import { SignalWorkspace } from './SignalWorkspace'
import { SourceCatalogView } from './SourceCatalogView'
import type { DiscoverySource } from '../../shared/discovery'
import { ACTIVE_TODAY_SOURCE_IDS, sourceDisplayName } from '../../shared/sourceIdentity'

interface AppProps {
  readonly api: TheRSSApi
}

type AppView = 'discover' | 'saved' | 'models' | 'analytics' | 'sources'

interface NavigationItem {
  readonly view: AppView
  readonly index: string
  readonly label: string
  readonly icon: LucideIcon
}

const navigationItems: readonly NavigationItem[] = [
  { view: 'discover', index: '01', label: 'Discover', icon: Compass },
  { view: 'saved', index: '02', label: 'Saved', icon: Star },
  { view: 'models', index: '03', label: 'Models & Agents', icon: Bot },
  { view: 'analytics', index: '04', label: 'Data Analytics', icon: BarChart3 },
  { view: 'sources', index: '05', label: 'Sources', icon: Library }
]

const SIDEBAR_WIDTH_STORAGE_KEY = 'therss.sidebar-width'
const SIDEBAR_MIN_WIDTH = 184
const SIDEBAR_MAX_WIDTH = 360
const SIDEBAR_KEYBOARD_STEP = 8
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

interface ModelDraft {
  readonly name: string
  readonly protocol: ModelProtocol
  readonly baseUrl: string
  readonly model: string
  readonly apiKey: string
}

const emptyModelDraft: ModelDraft = {
  name: '',
  protocol: 'openai-compatible',
  baseUrl: '',
  model: '',
  apiKey: ''
}

function draftFromProvider(provider: ModelProviderSummary): ModelDraft {
  return {
    name: provider.name,
    protocol: provider.protocol,
    baseUrl: provider.baseUrl,
    model: provider.model,
    apiKey: ''
  }
}

function ModelEditor({
  api,
  localAgents
}: {
  readonly api: TheRSSApi
  readonly localAgents: readonly LocalAgentStatus[]
}) {
  const [draft, setDraft] = useState<ModelDraft>(emptyModelDraft)
  const [provider, setProvider] = useState<ModelProviderSummary | null>(null)
  const [personalPrompt, setPersonalPrompt] = useState('')
  const [savedPersonalPrompt, setSavedPersonalPrompt] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingPersonalPrompt, setIsSavingPersonalPrompt] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [personalPromptError, setPersonalPromptError] = useState<string | null>(null)
  const [personalPromptStatus, setPersonalPromptStatus] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    api.getModelProvider().then((current) => {
      if (isActive && current) {
        setProvider(current)
        setDraft(draftFromProvider(current))
      }
    })
    return () => {
      isActive = false
    }
  }, [api])

  useEffect(() => {
    let isActive = true
    api
      .getDiscoverPersonalizationSettings()
      .then((settings) => {
        if (!isActive || !settings) return
        setPersonalPrompt(settings.prompt)
        setSavedPersonalPrompt(settings.prompt)
      })
      .catch(() => {
        if (isActive) setPersonalPromptError('The local personal prompt could not be opened.')
      })
    return () => {
      isActive = false
    }
  }, [api])

  const setField = <Key extends keyof ModelDraft>(field: Key, value: ModelDraft[Key]) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    const input: ModelProviderInput = {
      name: draft.name,
      protocol: draft.protocol,
      baseUrl: draft.baseUrl,
      model: draft.model,
      ...(draft.apiKey.trim() ? { apiKey: draft.apiKey } : {})
    }
    try {
      const saved = await api.saveModelProvider(input)
      setProvider(saved)
      setDraft(draftFromProvider(saved))
    } catch {
      setError('Provider settings were rejected. Use remote HTTPS or local loopback HTTP.')
    } finally {
      setIsSaving(false)
    }
  }

  const savePersonalPrompt = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSavingPersonalPrompt(true)
    setPersonalPromptError(null)
    setPersonalPromptStatus(null)
    try {
      const saved = await api.saveDiscoverPersonalizationPrompt(personalPrompt)
      setPersonalPrompt(saved.prompt)
      setSavedPersonalPrompt(saved.prompt)
      setPersonalPromptStatus(
        saved.prompt
          ? 'Personal context saved. Future Discover searches will use it.'
          : 'Personal context cleared. Future Discover searches will stay generic.'
      )
    } catch {
      setPersonalPromptError(
        'The personal Discover prompt must stay within the local safety limit.'
      )
    } finally {
      setIsSavingPersonalPrompt(false)
    }
  }

  return (
    <section className="model-editor">
      <div className="model-editor__heading">
        <p className="eyebrow">AGENT SETTINGS</p>
        <h1>Personalize your research agents.</h1>
        <p>
          Give Discover stable research context, then choose the model or local agent that expands
          each question into an inspectable search plan.
        </p>
      </div>
      <form className="personalization-form" onSubmit={(event) => void savePersonalPrompt(event)}>
        <div className="personalization-form__heading">
          <div>
            <p className="eyebrow">01 · PERSONAL PROMPT</p>
            <h2>Give search the context you repeat every time.</h2>
          </div>
          <p>
            Describe your fields, active questions, preferred evidence, methods, and exclusions.
            Your current Discover question remains the primary instruction.
          </p>
        </div>
        <label className="field field--wide">
          <span>Personal Discover prompt</span>
          <textarea
            aria-label="Personal Discover prompt"
            aria-describedby="personal-prompt-guidance personal-prompt-privacy"
            value={personalPrompt}
            onChange={(event) => {
              setPersonalPrompt(event.target.value)
              setPersonalPromptStatus(null)
            }}
            maxLength={DISCOVER_PERSONALIZATION_PROMPT_MAX_LENGTH}
            placeholder="Example: I research edge intelligence and energy systems. Prioritize reproducible evaluations, explicit resource budgets, and reviewer-safe claim boundaries."
            rows={6}
          />
        </label>
        <div className="personalization-form__guidance">
          <p id="personal-prompt-guidance" className="field-hint">
            A short profile is usually enough. Clear the field and save to disable personalization.
          </p>
          <p id="personal-prompt-privacy" className="personalization-form__privacy">
            Stored only in local SQLite. Your full text is sent to the selected model, Codex, or
            Claude only when you run Discover. Source sites receive the generated search terms,
            which can reflect this context. Do not include passwords, API keys, or confidential
            unpublished details.
          </p>
        </div>
        <div className="personalization-form__footer">
          <p className="field-hint">
            {personalPrompt.length}/{DISCOVER_PERSONALIZATION_PROMPT_MAX_LENGTH} characters
            {savedPersonalPrompt.trim()
              ? ' · active for future Discover runs'
              : ' · Discover remains generic until saved'}
          </p>
          <button
            type="submit"
            className="primary-button"
            disabled={isSavingPersonalPrompt || personalPrompt === savedPersonalPrompt}
          >
            {isSavingPersonalPrompt ? 'Saving personal prompt…' : 'Save personal Discover prompt'}
          </button>
        </div>
        {personalPromptError && (
          <div className="form-error" role="alert">
            {personalPromptError}
          </div>
        )}
        {personalPromptStatus && (
          <div className="personalization-form__status" role="status">
            {personalPromptStatus}
          </div>
        )}
      </form>
      <form onSubmit={(event) => void save(event)}>
        <div className="model-provider-form__heading field--wide">
          <p className="eyebrow">02 · MODEL PROVIDER</p>
          <h2>Bring your own analysis model.</h2>
          <p>
            OpenAI-compatible covers DeepSeek and local servers; Anthropic-compatible covers Claude
            APIs. API keys are encrypted by the operating system and never returned here.
          </p>
        </div>
        <label className="field">
          <span>Provider name</span>
          <input
            aria-label="Provider name"
            value={draft.name}
            onChange={(event) => setField('name', event.target.value)}
            placeholder="DeepSeek, Anthropic, or Local"
            required
          />
        </label>
        <label className="field">
          <span>Protocol</span>
          <select
            aria-label="Provider protocol"
            value={draft.protocol}
            onChange={(event) => setField('protocol', event.target.value as ModelProtocol)}
          >
            <option value="openai-compatible">OpenAI-compatible</option>
            <option value="anthropic-compatible">Anthropic-compatible</option>
          </select>
        </label>
        <label className="field field--wide">
          <span>Base URL</span>
          <input
            aria-label="Provider base URL"
            value={draft.baseUrl}
            onChange={(event) => setField('baseUrl', event.target.value)}
            placeholder="https://api.deepseek.com or http://127.0.0.1:11434/v1"
            required
          />
        </label>
        <label className="field">
          <span>Model</span>
          <input
            aria-label="Model name"
            value={draft.model}
            onChange={(event) => setField('model', event.target.value)}
            placeholder="deepseek-chat"
            required
          />
        </label>
        <label className="field">
          <span>
            API key {provider?.hasCredential ? '(leave blank to keep)' : '(optional locally)'}
          </span>
          <input
            aria-label="API key"
            type="password"
            value={draft.apiKey}
            onChange={(event) => setField('apiKey', event.target.value)}
            autoComplete="off"
          />
        </label>
        {provider?.hasCredential && (
          <div className="credential-status">Credential protected by macOS</div>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button type="submit" className="primary-button" disabled={isSaving}>
          {isSaving ? 'Protecting settings…' : 'Save model provider'}
        </button>
      </form>
      <aside className="agent-note">
        <span>AGENT BRIDGE</span>
        <strong>Codex · Claude Code · DeepSeek harness</strong>
        <p>
          The Analyze action can launch either detected CLI in a bounded, non-interactive session.
          The read-only MCP interface remains available for agent-led exploration.
        </p>
        <div className="agent-status-list" aria-label="Local agent status">
          {localAgents.map((agent) => (
            <span
              key={agent.runner}
              className={`agent-status agent-status--${agent.available ? 'ready' : 'missing'}`}
            >
              {agent.label}: {agent.available ? 'detected' : 'not detected'}
            </span>
          ))}
        </div>
      </aside>
    </section>
  )
}

export function App({ api }: AppProps) {
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<AppView>('discover')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [preferredSidebarWidth, setPreferredSidebarWidth] = useState(readSidebarWidth)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const [isSidebarResizing, setIsSidebarResizing] = useState(false)
  const preferredSidebarWidthRef = useRef(preferredSidebarWidth)
  const sidebarResizeDragRef = useRef<SidebarResizeDrag | null>(null)
  const [sourceFilter, setSourceFilter] = useState<'all' | DiscoverySource>('all')
  const [analysisRunner, setAnalysisRunner] = useState<AnalysisRunner>('model-provider')
  const [localAgents, setLocalAgents] = useState<readonly LocalAgentStatus[]>([])
  const [analysis, setAnalysis] = useState<AnalysisArtifact | null>(null)
  const [analyzingItemId, setAnalyzingItemId] = useState<string | null>(null)
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null)
  const [lastTriageAction, setLastTriageAction] = useState<LastTriageAction | null>(null)
  const [isTriageToastVisible, setIsTriageToastVisible] = useState(false)

  const navigate = useCallback((view: AppView) => {
    setActiveView(view)
    setIsTriageToastVisible(false)
  }, [])

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
  const sidebarMaximumWidth = maximumSidebarWidth(viewportWidth)
  const sidebarWidth = Math.min(preferredSidebarWidth, sidebarMaximumWidth)

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
    if (isSidebarCollapsed || event.button !== 0) return
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

  useEffect(
    () =>
      api.onAppCommand((command) => {
        switch (command) {
          case 'open-settings':
            navigate('models')
            return
          case 'show-saved':
            navigate('saved')
            return
          case 'show-discover':
            navigate('discover')
            return
          case 'toggle-sidebar':
            setIsSidebarCollapsed((current) => !current)
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
      undoLastTriage,
      updateTriage
    ]
  )

  return (
    <div
      className={`app-shell ${isSidebarCollapsed ? 'app-shell--sidebar-collapsed' : ''} ${isSidebarResizing ? 'app-shell--sidebar-resizing' : ''}`}
      data-view={activeView}
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
          {navigationItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.view}
                type="button"
                className={`nav-item ${activeView === item.view ? 'nav-item--active' : ''}`}
                aria-current={activeView === item.view ? 'page' : undefined}
                aria-label={`${item.index} ${item.label}`}
                title={isSidebarCollapsed ? item.label : undefined}
                onClick={() => navigate(item.view)}
              >
                <Icon className="nav-item__icon" aria-hidden="true" size={17} strokeWidth={1.8} />
                <span className="nav-item__label">{item.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="sidebar__footer" title={sourceHealthSummary.label}>
          <span className={`status-dot status-dot--${sourceHealthSummary.tone}`} />
          <span>{sourceHealthSummary.label}</span>
        </div>
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
        hidden={isSidebarCollapsed}
        tabIndex={isSidebarCollapsed ? -1 : 0}
        title="Drag to resize sidebar"
        onPointerDown={startSidebarResize}
        onPointerMove={moveSidebarResize}
        onPointerUp={finishSidebarResize}
        onPointerCancel={cancelSidebarResize}
        onLostPointerCapture={cancelSidebarResize}
        onKeyDown={resizeSidebarWithKeyboard}
      />

      <main>
        <header className="topbar">
          <div className="topbar__leading">
            <button
              type="button"
              className="toolbar-button"
              aria-label={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              aria-pressed={isSidebarCollapsed}
              onClick={() => setIsSidebarCollapsed((current) => !current)}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen aria-hidden="true" size={17} strokeWidth={1.8} />
              ) : (
                <PanelLeftClose aria-hidden="true" size={17} strokeWidth={1.8} />
              )}
            </button>
            <div className="topbar__identity">
              <span className="profile-name">
                {navigationItems.find((item) => item.view === activeView)?.label}
              </span>
              <span className="dateline">{dashboard?.date ?? 'Loading local index…'}</span>
            </div>
          </div>
        </header>

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
        {activeView === 'models' && <ModelEditor api={api} localAgents={localAgents} />}
        {activeView === 'discover' && (
          <DiscoverView api={api} localAgents={localAgents} onDashboardChange={setDashboard} />
        )}
        {activeView === 'analytics' && <DataAnalyticsView api={api} />}
        {activeView === 'sources' && <SourceCatalogView api={api} />}
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
    </div>
  )
}

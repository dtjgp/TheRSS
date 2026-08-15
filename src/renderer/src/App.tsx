import { useCallback, useEffect, useState } from 'react'
import type { InterestProfile } from '../../core/interests/interestProfile'
import type { DashboardItem, DashboardSnapshot, TheRSSApi } from '../../shared/api'

interface AppProps {
  readonly api: TheRSSApi
}

function SourceMark({ source }: { readonly source: DashboardItem['source'] }) {
  return (
    <span className={`source-mark source-mark--${source}`}>
      {source === 'arxiv' ? 'ARXIV' : 'GITHUB'}
    </span>
  )
}

function SignalCard({
  item,
  index,
  onTriage
}: {
  readonly item: DashboardItem
  readonly index: number
  readonly onTriage: (id: string, state: 'saved' | 'dismissed') => Promise<void>
}) {
  const [isUpdating, setIsUpdating] = useState(false)

  const updateTriage = async (state: 'saved' | 'dismissed') => {
    setIsUpdating(true)
    try {
      await onTriage(item.id, state)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <article className="signal-card" style={{ '--card-index': index } as React.CSSProperties}>
      <div className="signal-card__meta">
        <SourceMark source={item.source} />
        <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
        <span className="signal-card__score">signal {item.score}</span>
      </div>
      <h2>
        <a href={item.url} target="_blank" rel="noreferrer">
          {item.title}
        </a>
      </h2>
      <p>{item.summary}</p>
      <div className="reason-list" aria-label="Match reasons">
        {item.reasons.map((reason) => (
          <span key={reason}>{reason}</span>
        ))}
      </div>
      <div className="signal-card__actions">
        <button
          type="button"
          className="text-button"
          aria-label={item.triageState === 'saved' ? 'Saved' : 'Save signal'}
          disabled={isUpdating || item.triageState === 'saved'}
          onClick={() => void updateTriage('saved')}
        >
          {item.triageState === 'saved' ? 'Saved' : 'Save'}
        </button>
        <button type="button" className="text-button">
          Analyze
        </button>
        <button
          type="button"
          className="text-button text-button--muted"
          aria-label="Dismiss signal"
          disabled={isUpdating}
          onClick={() => void updateTriage('dismissed')}
        >
          Dismiss
        </button>
      </div>
    </article>
  )
}

function Onboarding({ onConfigure }: { readonly onConfigure: () => void }) {
  return (
    <section className="onboarding">
      <p className="eyebrow">FIRST SIGNAL</p>
      <h1>Build your research radar</h1>
      <p>
        Choose the arXiv fields, research phrases, GitHub topics, and languages that deserve your
        attention. TheRSS will keep the ranking explainable.
      </p>
      <button type="button" className="primary-button" onClick={onConfigure}>
        Set research interests
      </button>
      <div className="onboarding__sources" aria-label="Supported sources">
        <span>arXiv Atom</span>
        <span>GitHub Interest Radar</span>
        <span>Local-first</span>
      </div>
    </section>
  )
}

function splitRules(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((rule) => rule.trim())
    .filter(Boolean)
}

function joinRules(values: readonly string[]): string {
  return values.join(', ')
}

interface InterestDraft {
  readonly name: string
  readonly arxivCategories: string
  readonly arxivKeywords: string
  readonly arxivExclusions: string
  readonly githubKeywords: string
  readonly githubTopics: string
  readonly githubLanguages: string
}

const emptyInterestDraft: InterestDraft = {
  name: '',
  arxivCategories: '',
  arxivKeywords: '',
  arxivExclusions: '',
  githubKeywords: '',
  githubTopics: '',
  githubLanguages: ''
}

function draftFromProfile(profile: InterestProfile): InterestDraft {
  return {
    name: profile.name,
    arxivCategories: joinRules(profile.arxiv.categories),
    arxivKeywords: joinRules(profile.arxiv.keywords),
    arxivExclusions: joinRules(profile.arxiv.excludeKeywords),
    githubKeywords: joinRules(profile.github.keywords),
    githubTopics: joinRules(profile.github.topics),
    githubLanguages: joinRules(profile.github.languages)
  }
}

function profileFromDraft(draft: InterestDraft): InterestProfile {
  return {
    name: draft.name.trim(),
    arxiv: {
      categories: splitRules(draft.arxivCategories),
      keywords: splitRules(draft.arxivKeywords),
      excludeKeywords: splitRules(draft.arxivExclusions)
    },
    github: {
      keywords: splitRules(draft.githubKeywords),
      topics: splitRules(draft.githubTopics),
      languages: splitRules(draft.githubLanguages)
    }
  }
}

function InterestEditor({
  api,
  onSaved
}: {
  readonly api: TheRSSApi
  readonly onSaved: (snapshot: DashboardSnapshot) => void
}) {
  const [draft, setDraft] = useState<InterestDraft>(emptyInterestDraft)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    api.getInterestProfile().then((profile) => {
      if (isActive && profile) setDraft(draftFromProfile(profile))
    })
    return () => {
      isActive = false
    }
  }, [api])

  const setField = (field: keyof InterestDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      onSaved(await api.saveInterestProfile(profileFromDraft(draft)))
    } catch {
      setError('The research radar needs a name and at least one discovery rule.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="interest-editor">
      <div className="interest-editor__heading">
        <p className="eyebrow">RESEARCH PROFILE</p>
        <h1>Teach TheRSS what deserves attention.</h1>
        <p>
          Use comma-separated phrases. Rules stay on this Mac and every recommendation keeps its
          match reasons.
        </p>
      </div>
      <form onSubmit={(event) => void save(event)}>
        <label className="field field--wide">
          <span>Profile name</span>
          <input
            aria-label="Profile name"
            value={draft.name}
            onChange={(event) => setField('name', event.target.value)}
            placeholder="My research radar"
            required
          />
        </label>
        <fieldset>
          <legend>arXiv signal</legend>
          <label className="field">
            <span>Categories</span>
            <input
              aria-label="arXiv categories"
              value={draft.arxivCategories}
              onChange={(event) => setField('arxivCategories', event.target.value)}
              placeholder="cs.LG, cs.NI, eess.SP"
            />
          </label>
          <label className="field">
            <span>Keywords</span>
            <input
              aria-label="arXiv keywords"
              value={draft.arxivKeywords}
              onChange={(event) => setField('arxivKeywords', event.target.value)}
              placeholder="structured pruning, edge intelligence"
            />
          </label>
          <label className="field field--wide">
            <span>Exclude phrases</span>
            <input
              aria-label="arXiv exclude keywords"
              value={draft.arxivExclusions}
              onChange={(event) => setField('arxivExclusions', event.target.value)}
              placeholder="medical imaging"
            />
          </label>
        </fieldset>
        <fieldset>
          <legend>GitHub Interest Radar</legend>
          <label className="field">
            <span>Keywords</span>
            <input
              aria-label="GitHub keywords"
              value={draft.githubKeywords}
              onChange={(event) => setField('githubKeywords', event.target.value)}
              placeholder="model compression"
            />
          </label>
          <label className="field">
            <span>Topics</span>
            <input
              aria-label="GitHub topics"
              value={draft.githubTopics}
              onChange={(event) => setField('githubTopics', event.target.value)}
              placeholder="model-compression, edge-ai"
            />
          </label>
          <label className="field field--wide">
            <span>Languages</span>
            <input
              aria-label="GitHub languages"
              value={draft.githubLanguages}
              onChange={(event) => setField('githubLanguages', event.target.value)}
              placeholder="Python, TypeScript"
            />
          </label>
        </fieldset>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="primary-button" disabled={isSaving}>
          {isSaving ? 'Saving radar…' : 'Save research radar'}
        </button>
      </form>
    </section>
  )
}

export function App({ api }: AppProps) {
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeView, setActiveView] = useState<'today' | 'interests'>('today')

  useEffect(() => {
    let isActive = true
    api
      .getDashboard()
      .then((snapshot) => {
        if (isActive) setDashboard(snapshot)
      })
      .catch(() => {
        if (isActive) setError('The local research index could not be opened.')
      })
    return () => {
      isActive = false
    }
  }, [api])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)
    try {
      setDashboard(await api.refresh())
    } catch {
      setError('Refresh failed. Your previous inbox is still available.')
    } finally {
      setIsRefreshing(false)
    }
  }, [api])

  const updateTriage = useCallback(
    async (id: string, state: 'saved' | 'dismissed') => {
      try {
        setDashboard(await api.setTriageState(id, state))
      } catch {
        setError('The item state could not be saved. The local index was not changed.')
      }
    },
    [api]
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-lockup__index">TR</span>
          <div>
            <strong>TheRSS</strong>
            <span>research signal desk</span>
          </div>
        </div>
        <nav aria-label="Primary navigation">
          <button
            type="button"
            className={`nav-item ${activeView === 'today' ? 'nav-item--active' : ''}`}
            onClick={() => setActiveView('today')}
          >
            <span>01</span> Today
          </button>
          <button type="button" className="nav-item" disabled>
            <span>02</span> Discover
          </button>
          <button
            type="button"
            className={`nav-item ${activeView === 'interests' ? 'nav-item--active' : ''}`}
            onClick={() => setActiveView('interests')}
          >
            <span>03</span> Interests
          </button>
          <button type="button" className="nav-item">
            <span>04</span> Models &amp; Agents
          </button>
          <button type="button" className="nav-item">
            <span>05</span> Diagnostics
          </button>
        </nav>
        <div className="sidebar__footer">
          <span className="status-dot" />
          local index
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <span className="dateline">{dashboard?.date ?? 'Loading local index…'}</span>
            <span className="profile-name">{dashboard?.profileName ?? 'No profile'}</span>
          </div>
          {dashboard?.profileName && (
            <button
              type="button"
              className="refresh-button"
              onClick={refresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh sources'}
            </button>
          )}
        </header>

        {error && <div className="error-banner">{error}</div>}
        {!dashboard && !error && <div className="loading-state">Compiling today’s signal…</div>}
        {activeView === 'interests' && (
          <InterestEditor
            api={api}
            onSaved={(snapshot) => {
              setDashboard(snapshot)
              setActiveView('today')
            }}
          />
        )}
        {activeView === 'today' && dashboard && !dashboard.profileName && (
          <Onboarding onConfigure={() => setActiveView('interests')} />
        )}
        {activeView === 'today' && dashboard?.profileName && (
          <section className="today-view">
            <div className="today-view__heading">
              <div>
                <p className="eyebrow">DAILY EDITION</p>
                <h1>Today's research signal</h1>
              </div>
              <div className="signal-counts" aria-label="Inbox counts">
                <span>
                  <strong>{dashboard.counts.arxiv}</strong> papers
                </span>
                <span>
                  <strong>{dashboard.counts.github}</strong> repos
                </span>
                <span>
                  <strong>{dashboard.counts.unread}</strong> unread
                </span>
              </div>
            </div>

            {dashboard.items.length === 0 ? (
              <div className="quiet-state">
                <span>0 SIGNALS</span>
                <h2>Your radar is configured.</h2>
                <p>Refresh the sources to assemble today’s paper and repository shortlist.</p>
              </div>
            ) : (
              <div className="signal-grid">
                {dashboard.items.map((item, index) => (
                  <SignalCard key={item.id} item={item} index={index} onTriage={updateTriage} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

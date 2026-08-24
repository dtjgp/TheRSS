import { Bot, KeyRound, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { TheRSSApi } from '../../shared/api'
import { DISCOVER_PERSONALIZATION_PROMPT_MAX_LENGTH } from '../../shared/personalization'
import type {
  LocalAgentStatus,
  ModelProtocol,
  ModelProviderInput,
  ModelProviderSummary,
  ProviderConnectionResult
} from '../../shared/models'

type SettingsSection = 'personal' | 'provider'
type SettingsApi = Pick<
  TheRSSApi,
  | 'getModelProvider'
  | 'saveModelProvider'
  | 'testModelProvider'
  | 'clearModelProviderCredential'
  | 'getDiscoverPersonalizationSettings'
  | 'saveDiscoverPersonalizationPrompt'
>

interface SettingsViewProps {
  readonly api: SettingsApi
  readonly localAgents: readonly LocalAgentStatus[]
  readonly onDirtyChange: (isDirty: boolean) => void
}

interface ModelDraft {
  readonly name: string
  readonly protocol: ModelProtocol
  readonly baseUrl: string
  readonly model: string
  readonly apiKey: string
}

type ModelDraftErrors = Partial<Record<'name' | 'baseUrl' | 'model', string>>

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

function isSafeProviderUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    if (url.username || url.password) return false
    return (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    )
  } catch {
    return false
  }
}

function validateModelDraft(draft: ModelDraft): ModelDraftErrors {
  const errors: ModelDraftErrors = {}
  if (!draft.name.trim()) errors.name = 'Enter a provider name.'
  if (!isSafeProviderUrl(draft.baseUrl)) {
    errors.baseUrl = 'Enter an HTTPS or loopback HTTP base URL.'
  }
  if (!draft.model.trim()) errors.model = 'Enter the exact model name.'
  return errors
}

function providerInputFromDraft(draft: ModelDraft): ModelProviderInput {
  return {
    name: draft.name,
    protocol: draft.protocol,
    baseUrl: draft.baseUrl,
    model: draft.model,
    ...(draft.apiKey.trim() ? { apiKey: draft.apiKey } : {})
  }
}

export function SettingsView({ api, localAgents, onDirtyChange }: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('personal')
  const [draft, setDraft] = useState<ModelDraft>(emptyModelDraft)
  const [provider, setProvider] = useState<ModelProviderSummary | null>(null)
  const [personalPrompt, setPersonalPrompt] = useState('')
  const [savedPersonalPrompt, setSavedPersonalPrompt] = useState('')
  const [providerErrors, setProviderErrors] = useState<ModelDraftErrors>({})
  const [providerError, setProviderError] = useState<string | null>(null)
  const [providerStatus, setProviderStatus] = useState<string | null>(null)
  const [connectionResult, setConnectionResult] = useState<ProviderConnectionResult | null>(null)
  const [personalPromptError, setPersonalPromptError] = useState<string | null>(null)
  const [personalPromptStatus, setPersonalPromptStatus] = useState<string | null>(null)
  const [isSavingProvider, setIsSavingProvider] = useState(false)
  const [isTestingProvider, setIsTestingProvider] = useState(false)
  const [isClearingCredential, setIsClearingCredential] = useState(false)
  const [isSavingPersonalPrompt, setIsSavingPersonalPrompt] = useState(false)
  const providerDirtyRef = useRef(false)
  const personalDirtyRef = useRef(false)

  const reportDirtyPart = (part: 'provider' | 'personal', isDirty: boolean) => {
    if (part === 'provider') providerDirtyRef.current = isDirty
    else personalDirtyRef.current = isDirty
    onDirtyChange(providerDirtyRef.current || personalDirtyRef.current)
  }

  useEffect(() => {
    let isActive = true
    api
      .getModelProvider()
      .then((current) => {
        if (!isActive || !current) return
        setProvider(current)
        setDraft(draftFromProvider(current))
      })
      .catch(() => {
        if (isActive) setProviderError('The local provider settings could not be opened.')
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
    setProviderErrors((current) => ({ ...current, [field]: undefined }))
    setProviderError(null)
    setProviderStatus(null)
    setConnectionResult(null)
    reportDirtyPart('provider', true)
  }

  const validateProvider = (): ModelProviderInput | null => {
    const nextErrors = validateModelDraft(draft)
    setProviderErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setProviderError('Review the highlighted provider fields.')
      return null
    }
    return providerInputFromDraft(draft)
  }

  const saveProvider = async (event: React.FormEvent) => {
    event.preventDefault()
    const input = validateProvider()
    if (!input) return
    const changesCredentialScope =
      provider?.hasCredential &&
      (provider.protocol !== input.protocol || provider.baseUrl !== input.baseUrl.trim())
    if (changesCredentialScope && !input.apiKey) {
      setProviderError(
        'Enter a replacement credential or clear the protected credential before saving another protocol or endpoint.'
      )
      return
    }
    setIsSavingProvider(true)
    setProviderError(null)
    setProviderStatus(null)
    try {
      const saved = await api.saveModelProvider(input)
      setProvider(saved)
      setDraft(draftFromProvider(saved))
      setProviderStatus('Provider settings saved. The credential remains protected by macOS.')
      reportDirtyPart('provider', false)
    } catch {
      setProviderError(
        'Provider settings were rejected. Check the highlighted fields and local security rules.'
      )
    } finally {
      setIsSavingProvider(false)
    }
  }

  const testProvider = async () => {
    const input = validateProvider()
    if (!input) return
    setIsTestingProvider(true)
    setProviderError(null)
    setProviderStatus(null)
    setConnectionResult(null)
    try {
      setConnectionResult(await api.testModelProvider(input))
    } catch {
      setProviderError('The bounded connection test could not be started.')
    } finally {
      setIsTestingProvider(false)
    }
  }

  const clearCredential = async () => {
    setIsClearingCredential(true)
    setProviderError(null)
    setProviderStatus(null)
    setConnectionResult(null)
    try {
      const saved = await api.clearModelProviderCredential()
      setProvider(saved)
      setProviderStatus('Credential cleared. Add and save a replacement before authenticated use.')
    } catch {
      setProviderError('The protected credential could not be cleared.')
    } finally {
      setIsClearingCredential(false)
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
      reportDirtyPart('personal', false)
    } catch {
      setPersonalPromptError(
        'The personal Discover prompt must stay within the local safety limit.'
      )
    } finally {
      setIsSavingPersonalPrompt(false)
    }
  }

  return (
    <section className="settings-view">
      <header className="settings-heading">
        <p className="eyebrow">APPLICATION SETTINGS</p>
        <h1>Settings</h1>
        <p>Configure local research context, model access, and bounded agent availability.</p>
      </header>

      <div className="settings-layout">
        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'personal'}
            aria-controls="settings-personal-panel"
            onClick={() => setActiveSection('personal')}
          >
            <UserRound aria-hidden="true" size={16} />
            <span>Personal context</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'provider'}
            aria-controls="settings-provider-panel"
            onClick={() => setActiveSection('provider')}
          >
            <KeyRound aria-hidden="true" size={16} />
            <span>Model provider</span>
          </button>
        </div>

        {activeSection === 'personal' ? (
          <section
            className="settings-panel"
            id="settings-personal-panel"
            role="tabpanel"
            aria-label="Personal context"
          >
            <form
              className="personalization-form"
              onSubmit={(event) => void savePersonalPrompt(event)}
            >
              <div className="settings-panel__heading">
                <p className="eyebrow">PERSONAL CONTEXT</p>
                <h2>Personal Discover prompt</h2>
                <p>
                  Describe stable fields, questions, evidence preferences, methods, and exclusions.
                  The current Discover question remains the primary instruction.
                </p>
              </div>
              <label className="field field--wide">
                <span>Personal Discover prompt</span>
                <textarea
                  aria-label="Personal Discover prompt"
                  aria-describedby="personal-prompt-guidance personal-prompt-privacy"
                  aria-invalid={personalPromptError ? 'true' : undefined}
                  value={personalPrompt}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    setPersonalPrompt(nextValue)
                    setPersonalPromptStatus(null)
                    setPersonalPromptError(null)
                    reportDirtyPart('personal', nextValue !== savedPersonalPrompt)
                  }}
                  maxLength={DISCOVER_PERSONALIZATION_PROMPT_MAX_LENGTH}
                  placeholder="Example: I research edge intelligence and energy systems. Prioritize reproducible evaluations, explicit resource budgets, and reviewer-safe claim boundaries."
                  rows={7}
                />
              </label>
              <div className="personalization-form__guidance">
                <p id="personal-prompt-guidance" className="field-hint">
                  A short profile is usually enough. Clear the field and save to disable
                  personalization.
                </p>
                <p id="personal-prompt-privacy" className="personalization-form__privacy">
                  Stored only in local SQLite. Your full text is sent to the selected model, Codex,
                  or Claude only when you run Discover. Source sites receive generated search terms,
                  which can reflect this context. Never include secrets or confidential drafts.
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
                  {isSavingPersonalPrompt ? 'Saving…' : 'Save personal Discover prompt'}
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
          </section>
        ) : (
          <section
            className="settings-panel"
            id="settings-provider-panel"
            role="tabpanel"
            aria-label="Model provider"
          >
            <form
              className="model-provider-form"
              noValidate
              onSubmit={(event) => void saveProvider(event)}
            >
              <div className="settings-panel__heading field--wide">
                <p className="eyebrow">MODEL PROVIDER</p>
                <h2>Model provider</h2>
                <p>
                  Test the unsaved draft before saving. API keys stay in Electron main, are
                  encrypted by macOS when saved, and are never returned to this form.
                </p>
              </div>
              <label className="field">
                <span>Provider name</span>
                <input
                  aria-label="Provider name"
                  aria-invalid={providerErrors.name ? 'true' : undefined}
                  aria-describedby={providerErrors.name ? 'provider-name-error' : undefined}
                  value={draft.name}
                  onChange={(event) => setField('name', event.target.value)}
                  placeholder="DeepSeek, Anthropic, or Local"
                />
                {providerErrors.name && (
                  <span id="provider-name-error" className="field-error">
                    {providerErrors.name}
                  </span>
                )}
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
                  aria-invalid={providerErrors.baseUrl ? 'true' : undefined}
                  aria-describedby={
                    providerErrors.baseUrl ? 'provider-url-error' : 'provider-url-hint'
                  }
                  value={draft.baseUrl}
                  onChange={(event) => setField('baseUrl', event.target.value)}
                  placeholder="https://api.deepseek.com or http://127.0.0.1:11434/v1"
                />
                <span id="provider-url-hint" className="field-hint">
                  Remote endpoints require HTTPS; loopback HTTP is allowed for local services.
                </span>
                {providerErrors.baseUrl && (
                  <span id="provider-url-error" className="field-error">
                    {providerErrors.baseUrl}
                  </span>
                )}
              </label>
              <label className="field">
                <span>Model</span>
                <input
                  aria-label="Model name"
                  aria-invalid={providerErrors.model ? 'true' : undefined}
                  aria-describedby={providerErrors.model ? 'provider-model-error' : undefined}
                  value={draft.model}
                  onChange={(event) => setField('model', event.target.value)}
                  placeholder="deepseek-chat"
                />
                {providerErrors.model && (
                  <span id="provider-model-error" className="field-error">
                    {providerErrors.model}
                  </span>
                )}
              </label>
              <label className="field">
                <span>
                  API key{' '}
                  {provider?.hasCredential
                    ? provider.protocol === draft.protocol &&
                      provider.baseUrl === draft.baseUrl.trim()
                      ? '(blank keeps current for this endpoint)'
                      : '(replacement required for changed endpoint)'
                    : '(optional locally)'}
                </span>
                <input
                  aria-label="API key"
                  type="password"
                  value={draft.apiKey}
                  onChange={(event) => setField('apiKey', event.target.value)}
                  autoComplete="off"
                />
              </label>

              <div className="provider-credential-row field--wide">
                <div>
                  <strong>
                    {provider?.hasCredential
                      ? 'Credential protected by macOS'
                      : 'No saved credential'}
                  </strong>
                  <span>
                    {provider?.hasCredential
                      ? 'Enter a new key to replace it, or clear it explicitly.'
                      : 'Public or local providers may not require a credential.'}
                  </span>
                </div>
                {provider?.hasCredential && (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={isClearingCredential}
                    onClick={() => void clearCredential()}
                  >
                    {isClearingCredential ? 'Clearing…' : 'Clear protected credential'}
                  </button>
                )}
              </div>

              {providerError && (
                <div className="form-error field--wide" role="alert">
                  {providerError}
                </div>
              )}
              {connectionResult && (
                <div
                  className={`provider-connection-result provider-connection-result--${connectionResult.status}`}
                  role="status"
                  aria-label="Provider connection result"
                >
                  <strong>
                    {connectionResult.status === 'connected'
                      ? 'Connected'
                      : 'Connection needs attention'}
                  </strong>
                  <span>{connectionResult.message}</span>
                </div>
              )}
              {providerStatus && (
                <div className="provider-save-status field--wide" role="status">
                  {providerStatus}
                </div>
              )}

              <div className="provider-form-actions field--wide">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={isTestingProvider || isSavingProvider}
                  onClick={() => void testProvider()}
                >
                  {isTestingProvider ? 'Testing connection…' : 'Test connection'}
                </button>
                <button type="submit" className="primary-button" disabled={isSavingProvider}>
                  {isSavingProvider ? 'Protecting settings…' : 'Save model provider'}
                </button>
              </div>
            </form>

            <aside className="agent-note">
              <Bot aria-hidden="true" size={17} />
              <div>
                <strong>Local agent bridge</strong>
                <p>
                  Analyze can launch a detected CLI in a bounded non-interactive session. The
                  read-only MCP interface remains separate from provider credentials.
                </p>
              </div>
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
        )}
      </div>
    </section>
  )
}

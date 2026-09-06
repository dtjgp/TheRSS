import { validateProviderBaseUrl } from '../../core/security/providerUrl'
import { discoverPersonalizationPromptSchema } from '../../shared/personalization'
import type { ModelProtocol, ModelProviderInput, ModelProviderSummary } from '../../shared/models'
import {
  Controls,
  column,
  heading,
  label,
  row,
  scroll,
  type NativeContext,
  type NativeScreen
} from './common'
import type { NativeNode } from './presentation'

type Draft = { name: string; protocol: ModelProtocol; baseUrl: string; model: string }
const fromProvider = (provider: ModelProviderSummary | null): Draft => ({
  name: provider?.name ?? '',
  protocol: provider?.protocol ?? 'openai-compatible',
  baseUrl: provider?.baseUrl ?? '',
  model: provider?.model ?? ''
})

export class SettingsScreen implements NativeScreen {
  private readonly controls: Controls
  private section: 'personal' | 'provider' = 'personal'
  private provider: ModelProviderSummary | null = null
  private draft: Draft = fromProvider(null)
  private prompt = ''
  private savedPrompt = ''
  #secret = ''
  private clearRevision = 0
  private promptRevision = 0
  private loaded = false
  private busy = false
  private disposed = false
  private message = ''

  constructor(private readonly context: NativeContext) {
    this.controls = new Controls(context)
  }

  async load(): Promise<void> {
    if (this.loaded || this.busy) return
    this.busy = true
    try {
      const [provider, personal] = await Promise.all([
        this.context.api.getModelProvider(),
        this.context.api.getDiscoverPersonalizationSettings()
      ])
      if (this.disposed) return
      this.provider = provider
      this.draft = fromProvider(provider)
      this.savedPrompt = personal?.prompt ?? ''
      this.prompt = this.savedPrompt
      this.context.data.provider = provider
      this.context.data.personalPrompt = this.savedPrompt
      this.loaded = true
      this.message = ''
    } catch {
      this.message = 'Local settings could not be opened. Retry to load them.'
    } finally {
      this.busy = false
      this.context.redraw()
    }
  }

  discard(): void {
    this.draft = fromProvider(this.provider)
    this.prompt = this.savedPrompt
    this.#secret = ''
    this.context.presentation.clearSecure('provider-key')
    this.clearRevision++
    this.promptRevision++
    this.message = ''
    this.reportDirty()
    this.context.redraw()
  }
  dispose(): void {
    this.disposed = true
    this.#secret = ''
  }

  render(): NativeNode {
    const b = this.controls
    const content = this.section === 'personal' ? this.personal() : this.model()
    return column(
      'settings-page',
      [
        heading('settings-title', 'Settings'),
        label(
          'settings-description',
          'Local research context, model access, and bounded agent availability.',
          { weight: 'secondary' }
        ),
        b.select(
          'settings-tab',
          'Settings section',
          this.section,
          [
            { id: 'personal', title: 'Personal context' },
            { id: 'provider', title: 'Model provider' }
          ],
          (value) => {
            this.section = value as typeof this.section
            this.context.redraw()
          },
          { width: 250 }
        ),
        ...(this.message ? [label('settings-status', this.message)] : []),
        ...(!this.loaded
          ? [
              b.button(
                'settings-retry',
                this.busy ? 'Loading settings…' : 'Retry loading',
                () => this.load(),
                !this.busy
              )
            ]
          : []),
        scroll('settings-scroll', content)
      ],
      { flex: 1 }
    )
  }

  private personal(): NativeNode {
    const b = this.controls,
      enabled = this.loaded && !this.busy
    return column(
      'personal-form',
      [
        heading('personal-title', 'Personal context'),
        label(
          'personal-description',
          'Describe your research interests and constraints. This saved context informs future Discover search plans.'
        ),
        b.input(
          'personal-prompt',
          'Personal research context',
          this.prompt,
          (value) => {
            if (this.busy || !this.loaded) return
            this.prompt = value
            this.edited()
          },
          4000,
          { multiline: true, height: 240, enabled, clearRevision: this.promptRevision }
        ),
        label(
          'personal-count',
          `${this.prompt.length} / 4000 characters · ${this.savedPrompt ? 'Saved context active' : 'No saved context'}`,
          { weight: 'secondary' }
        ),
        row('personal-actions', [
          b.button(
            'personal-save',
            'Save context',
            () => this.savePrompt(this.prompt),
            enabled && !!this.prompt.trim()
          ),
          b.button(
            'personal-clear',
            'Clear saved context',
            () => this.savePrompt(''),
            enabled && !!(this.savedPrompt || this.prompt)
          )
        ])
      ],
      { padding: 4 }
    )
  }

  private model(): NativeNode {
    const b = this.controls,
      enabled = this.loaded && !this.busy
    const field = (key: 'name' | 'baseUrl' | 'model', id: string, title: string, max: number) =>
      column(`${id}-field`, [
        label(`${id}-label`, title),
        b.input(
          id,
          title,
          this.draft[key],
          (value) => {
            if (this.busy || !this.loaded) return
            this.draft = { ...this.draft, [key]: value }
            this.edited()
          },
          max,
          { enabled, clearRevision: this.clearRevision }
        )
      ])
    const secretAction = this.context.presentation.action(
      'provider-key',
      (value) => {
        if (enabled && !this.busy && this.loaded) {
          this.#secret = value as string
          this.edited()
        }
      },
      { type: 'secret', max: 20000 }
    )
    return column(
      'provider-form',
      [
        heading('provider-title', 'Model provider'),
        field('name', 'provider-name', 'Provider name', 80),
        label('provider-protocol-label', 'Protocol'),
        b.select(
          'provider-protocol',
          'Protocol',
          this.draft.protocol,
          [
            { id: 'openai-compatible', title: 'OpenAI compatible' },
            { id: 'anthropic-compatible', title: 'Anthropic compatible' }
          ],
          (value) => {
            if (this.busy || !this.loaded) return
            this.draft = { ...this.draft, protocol: value as ModelProtocol }
            this.edited()
          },
          { enabled }
        ),
        field('baseUrl', 'provider-url', 'Base URL · HTTPS or loopback HTTP', 2000),
        field('model', 'provider-model', 'Exact model name', 200),
        label('provider-key-label', 'API key'),
        {
          id: 'provider-key',
          kind: 'secure',
          title: 'API key',
          placeholder: this.provider?.hasCredential
            ? 'Protected credential stored; leave blank to keep it'
            : 'Optional credential',
          action: secretAction,
          enabled,
          maxLength: 20000,
          clearRevision: this.clearRevision
        },
        label(
          'provider-key-state',
          this.#secret
            ? 'A replacement credential is entered and awaits Save.'
            : this.provider?.hasCredential
              ? 'A credential is stored with OS protection. It is never displayed here.'
              : 'No protected credential is stored.',
          { weight: 'secondary' }
        ),
        row('provider-actions', [
          b.button('provider-save', 'Save provider', () => this.saveProvider(), enabled),
          b.button('provider-test', 'Test connection', () => this.testProvider(), enabled),
          b.button(
            'provider-clear-key',
            'Clear credential',
            () => this.clearCredential(),
            enabled && !!this.provider?.hasCredential
          )
        ]),
        label('provider-test-note', 'Test uses the current draft without saving it.', {
          weight: 'secondary'
        }),
        heading('agents-heading', 'Local agents'),
        ...this.context.data.agents.map((agent) =>
          label(
            `agent-status-${agent.runner}`,
            `${agent.label}: ${agent.available ? 'Available' : 'Not found'}`
          )
        )
      ],
      { padding: 4 }
    )
  }

  private edited(): void {
    if (!this.loaded || this.busy) return
    this.message = ''
    this.reportDirty()
    this.context.redraw()
  }
  private reportDirty(): void {
    this.context.api.setSettingsDirty(
      this.prompt !== this.savedPrompt ||
        this.#secret.length > 0 ||
        JSON.stringify(this.draft) !== JSON.stringify(fromProvider(this.provider))
    )
  }
  private input(): ModelProviderInput | null {
    if (!this.draft.name.trim() || !this.draft.model.trim()) {
      this.message = 'Enter a provider name and exact model name.'
      this.context.redraw()
      return null
    }
    try {
      validateProviderBaseUrl(this.draft.baseUrl.trim())
    } catch {
      this.message = 'Enter an HTTPS or loopback HTTP base URL without embedded credentials.'
      this.context.redraw()
      return null
    }
    return { ...this.draft, ...(this.#secret.trim() ? { apiKey: this.#secret } : {}) }
  }

  private async savePrompt(prompt: string): Promise<void> {
    if (this.busy || !this.loaded) return
    if (!discoverPersonalizationPromptSchema.safeParse(prompt).success) {
      this.message = 'Personal context contains unsupported characters or exceeds 4000 characters.'
      this.context.redraw()
      return
    }
    this.busy = true
    this.context.redraw()
    try {
      const saved = await this.context.api.saveDiscoverPersonalizationPrompt(prompt)
      if (this.disposed) return
      this.prompt = saved.prompt
      this.savedPrompt = saved.prompt
      this.context.data.personalPrompt = saved.prompt
      this.promptRevision++
      this.message = saved.prompt
        ? 'Personal context saved for future Discover searches.'
        : 'Personal context cleared.'
      this.reportDirty()
    } catch {
      this.message = 'Personal context could not be saved.'
    } finally {
      this.busy = false
      this.context.redraw()
    }
  }
  private async saveProvider(): Promise<void> {
    if (this.busy || !this.loaded) return
    const input = this.input()
    if (!input) return
    if (
      this.provider?.hasCredential &&
      (this.provider.protocol !== input.protocol ||
        this.provider.baseUrl !== input.baseUrl.trim()) &&
      !input.apiKey
    ) {
      this.message =
        'Enter a replacement credential or clear the protected credential before saving another protocol or endpoint.'
      this.context.redraw()
      return
    }
    this.busy = true
    this.context.redraw()
    try {
      const saved = await this.context.api.saveModelProvider(input)
      if (this.disposed) return
      this.provider = saved
      this.context.data.provider = saved
      this.draft = fromProvider(saved)
      this.#secret = ''
      this.context.presentation.clearSecure('provider-key')
      this.clearRevision++
      this.message = 'Provider saved. Any credential remains protected by the operating system.'
      this.reportDirty()
    } catch {
      this.message = 'Provider settings were rejected. Check the fields and credential rules.'
    } finally {
      this.busy = false
      this.context.redraw()
    }
  }
  private async testProvider(): Promise<void> {
    if (this.busy || !this.loaded) return
    const input = this.input()
    if (!input) return
    this.busy = true
    this.context.redraw()
    try {
      const result = await this.context.api.testModelProvider(input)
      if (!this.disposed)
        this.message = `${result.status}: ${result.message}\nTested: ${result.testedAt}`
    } catch {
      this.message = 'The bounded connection test could not be started.'
    } finally {
      this.busy = false
      this.context.redraw()
    }
  }
  private async clearCredential(): Promise<void> {
    if (this.busy || !this.provider) return
    this.busy = true
    this.context.redraw()
    try {
      const saved = await this.context.api.clearModelProviderCredential()
      if (this.disposed) return
      this.provider = saved
      this.context.data.provider = saved
      this.#secret = ''
      this.context.presentation.clearSecure('provider-key')
      this.clearRevision++
      this.message = 'Protected credential cleared. Other unsaved fields are retained.'
      this.reportDirty()
    } catch {
      this.message = 'The protected credential could not be cleared.'
    } finally {
      this.busy = false
      this.context.redraw()
    }
  }
}

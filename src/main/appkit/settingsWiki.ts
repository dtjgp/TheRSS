import {
  llmWikiFolderChoiceSchema,
  llmWikiVaultDiagnosticsSchema,
  type LlmWikiDiagnosticCheck,
  type LlmWikiVaultDiagnostics,
  type LlmWikiVaultOrigin
} from '../../shared/llmWikiSettings'
import { column, Controls, heading, label, readableError, row, type NativeContext } from './common'
import type { NativeNode } from './presentation'

const ORIGIN_LABELS: Record<LlmWikiVaultOrigin, string> = {
  env: 'Environment override',
  custom: 'Custom folder',
  default: 'Default folder'
}

const STATUS_LABELS: Record<LlmWikiVaultDiagnostics['status'], string> = {
  ready: 'Ready',
  incomplete: 'Incomplete',
  unavailable: 'Unavailable'
}

const CHECK_STATUS_LABELS: Record<LlmWikiDiagnosticCheck['status'], string> = {
  ok: 'OK',
  warning: 'Warning',
  error: 'Error'
}

function formatCheckedAt(value: string, locale: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

/**
 * Knowledge Base (`llm-wiki`) Settings pane: displays resolved vault path, origin,
 * read-only local diagnostics with remediation hints, and explicit folder controls.
 */
export class SettingsWikiPane {
  private readonly controls: Controls
  private diagnostics: LlmWikiVaultDiagnostics | null = null
  private loaded = false
  private attempted = false
  private busy = false
  private disposed = false
  private version = 0
  private message = ''

  constructor(
    private readonly context: NativeContext,
    private readonly options: { readonly changed?: () => void } = {}
  ) {
    this.controls = new Controls(context)
  }

  async ensureLoaded(): Promise<void> {
    if (!this.attempted && !this.busy) await this.load(false)
  }

  async load(force = false): Promise<void> {
    if (this.disposed || this.busy || (!force && this.loaded)) return
    this.attempted = true
    const getSettings = this.context.api.getLlmWikiSettings
    if (!getSettings) {
      this.loaded = true
      return
    }
    const version = ++this.version
    this.busy = true
    this.message = ''
    this.context.redraw()
    try {
      const previous = this.diagnostics
      const diagnostics = llmWikiVaultDiagnosticsSchema.parse(await getSettings())
      if (!this.disposed && version === this.version) {
        this.diagnostics = diagnostics
        this.loaded = true
        if (
          force &&
          (!previous ||
            previous.status !== diagnostics.status ||
            previous.resolvedPath !== diagnostics.resolvedPath)
        ) {
          this.options.changed?.()
        }
      }
    } catch (error) {
      if (!this.disposed && version === this.version) {
        this.message = readableError(error, 'The local llm-wiki vault could not be checked.')
      }
    } finally {
      if (!this.disposed && version === this.version) {
        this.busy = false
        this.context.redraw()
      }
    }
  }

  dispose(): void {
    this.disposed = true
    this.version++
  }

  render(): NativeNode {
    const b = this.controls
    const d = this.diagnostics
    const hasApi = !!this.context.api.getLlmWikiSettings
    const canChoose =
      !this.busy &&
      !!this.context.api.chooseLlmWikiVaultFolder &&
      !!this.context.api.saveLlmWikiVaultPath
    const canReset =
      !this.busy && !!this.context.api.saveLlmWikiVaultPath && d !== null && d.customPath !== null

    const summaryChildren: NativeNode[] =
      this.busy && !d
        ? [label('wiki-status', 'Checking local llm-wiki vault…', { weight: 'bold' })]
        : d
          ? [
              label(
                'wiki-status',
                `Status: ${STATUS_LABELS[d.status]} · ${ORIGIN_LABELS[d.origin]}`,
                { weight: 'bold' }
              ),
              label('wiki-resolved-path', `Vault folder: ${d.resolvedPath}`),
              label(
                'wiki-checked-at',
                `Checked ${formatCheckedAt(d.checkedAt, this.context.locale)} · Read-only vault check`,
                { weight: 'secondary', textStyle: 'footnote' }
              ),
              ...(d.origin === 'env'
                ? [
                    label(
                      'wiki-env-note',
                      `THERSS_LLM_WIKI_PATH overrides saved folder selection (${d.envOverridePath ?? d.resolvedPath}).${d.customPath ? ` Saved custom folder: ${d.customPath}` : ''}`,
                      { weight: 'secondary' }
                    )
                  ]
                : [])
            ]
          : !hasApi
            ? [
                label(
                  'wiki-status',
                  'Knowledge Base diagnostics are not available in this session.',
                  { weight: 'secondary' }
                )
              ]
            : [label('wiki-status', 'Status: Unavailable', { weight: 'bold' })]

    return column(
      'wiki-form',
      [
        label(
          'wiki-description',
          'Configure the local llm-wiki vault folder used for read-only list badges, Daily Papers, and reviewed promotions.'
        ),
        column('wiki-summary', summaryChildren, { surface: 'inset', padding: 12, gap: 6 }),
        row('wiki-actions', [
          {
            ...b.button(
              'wiki-choose-folder',
              'Choose folder…',
              () => this.chooseFolder(),
              canChoose
            ),
            emphasis: 'primary' as const
          },
          b.button('wiki-use-default', 'Use default folder', () => this.useDefault(), canReset),
          b.button(
            'wiki-recheck',
            this.busy ? 'Rechecking…' : 'Recheck vault',
            () => this.load(true),
            !this.busy && hasApi
          )
        ]),
        ...(this.message ? [label('wiki-message', this.message, { weight: 'secondary' })] : []),
        ...(d?.checks.length
          ? [
              heading('wiki-checks-heading', 'Vault diagnostics'),
              ...d.checks.map((check) =>
                column(
                  `wiki-check-${check.id}`,
                  [
                    label(
                      `wiki-check-${check.id}-title`,
                      `${CHECK_STATUS_LABELS[check.status]} · ${check.label}`,
                      { weight: check.status === 'ok' ? 'regular' : 'bold' }
                    ),
                    label(`wiki-check-${check.id}-detail`, check.detail, { weight: 'secondary' }),
                    ...(check.status !== 'ok' && check.remediation
                      ? [
                          label(`wiki-check-${check.id}-remediation`, `Fix: ${check.remediation}`, {
                            weight: 'secondary',
                            textStyle: 'footnote'
                          })
                        ]
                      : [])
                  ],
                  { surface: 'inset', padding: 10, gap: 4 }
                )
              )
            ]
          : [])
      ],
      { padding: 20, gap: 12, surface: 'panel', maxWidth: 800 }
    )
  }

  private async chooseFolder(): Promise<void> {
    const choose = this.context.api.chooseLlmWikiVaultFolder
    const save = this.context.api.saveLlmWikiVaultPath
    if (this.disposed || this.busy || !choose || !save) return
    const version = ++this.version
    this.busy = true
    this.message = ''
    this.context.redraw()
    try {
      const choice = llmWikiFolderChoiceSchema.parse(await choose())
      if (this.disposed || version !== this.version || choice.canceled || !choice.path) return
      const next = llmWikiVaultDiagnosticsSchema.parse(await save(choice.path))
      if (this.disposed || version !== this.version) return
      this.diagnostics = next
      this.loaded = true
      this.message = 'Vault folder saved.'
      this.options.changed?.()
    } catch (error) {
      if (!this.disposed && version === this.version) {
        this.message = readableError(error, 'The selected vault folder could not be saved.')
      }
    } finally {
      if (!this.disposed && version === this.version) {
        this.busy = false
        this.context.redraw()
      }
    }
  }

  private async useDefault(): Promise<void> {
    const save = this.context.api.saveLlmWikiVaultPath
    if (
      this.disposed ||
      this.busy ||
      !save ||
      !this.diagnostics ||
      this.diagnostics.customPath === null
    )
      return
    const version = ++this.version
    this.busy = true
    this.message = ''
    this.context.redraw()
    try {
      const next = llmWikiVaultDiagnosticsSchema.parse(await save(null))
      if (this.disposed || version !== this.version) return
      this.diagnostics = next
      this.loaded = true
      this.message = 'Using default vault folder.'
      this.options.changed?.()
    } catch (error) {
      if (!this.disposed && version === this.version) {
        this.message = readableError(error, 'The default vault folder could not be restored.')
      }
    } finally {
      if (!this.disposed && version === this.version) {
        this.busy = false
        this.context.redraw()
      }
    }
  }
}

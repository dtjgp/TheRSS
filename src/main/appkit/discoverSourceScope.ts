import {
  DISCOVER_SOURCE_IDS,
  type DiscoverSnapshot,
  type DiscoverSource
} from '../../shared/discover'
import { sameDiscoverSources } from '../../shared/discoverSourcePreference'
import { column, Controls, label, row, type NativeContext } from './common'
import type { NativeNode } from './presentation'
import { SourceDraft, sourceChooser } from './sourceChooser'
import { sourcePreferences, type SourcePreferences } from './sourcePreferences'

const CHANGED_DEFAULT =
  'Default sources saved. This search keeps its current sources; choose Use defaults to switch.'

/**
 * The sources of the next Discover search. They start from the stored default and change only
 * by Apply, Use defaults or a default saved while they still equal the old default and no run is
 * active. Loading or opening a stored session never changes them.
 */
export class DiscoverSourceScope {
  sources = new Set<DiscoverSource>()
  private draft: SourceDraft | null = null
  private initialized = false
  private note = ''
  private readonly preferences: SourcePreferences
  private readonly unsubscribe: () => void

  constructor(
    private readonly context: NativeContext,
    private readonly busy: () => boolean
  ) {
    this.preferences = sourcePreferences(context)
    this.unsubscribe = this.preferences.subscribe((previous, next) => {
      if (!this.initialized) this.adopt(next.sources)
      else if (!this.busy() && sameDiscoverSources(this.sources, previous.sources)) {
        this.sources = new Set(next.sources)
        this.note = ''
      } else this.note = CHANGED_DEFAULT
    })
  }
  async load(force = false): Promise<void> {
    await this.preferences.load(force)
    if (!this.initialized && this.preferences.value) this.adopt(this.preferences.value.sources)
  }
  dispose(): void {
    this.unsubscribe()
  }
  /** The stored default could not be read; nothing is selected until the user chooses. */
  get failed(): boolean {
    return !this.initialized && this.preferences.failed
  }
  get isOpen(): boolean {
    return this.draft !== null
  }
  toggle(): void {
    this.draft = this.draft ? null : new SourceDraft(this.sources)
    // Keyboard users land in the source finder, as in a Safari or Mail popover.
    if (this.draft) this.context.focus('discover-source-query')
    this.context.redraw()
  }
  /** Closes the popover without applying its draft. */
  close(): void {
    this.draft = null
  }
  ordered(): DiscoverSource[] {
    return DISCOVER_SOURCE_IDS.filter((source) => this.sources.has(source))
  }
  buttonTitle(): string {
    return `Sources for this search · ${this.sources.size}/22`
  }

  /** The mode line and notes shown in the composer. */
  status(snapshot: DiscoverSnapshot | null): NativeNode[] {
    const defaults = this.preferences.value?.sources
    const mode = !defaults
      ? 'Default sources are not loaded'
      : sameDiscoverSources(this.sources, defaults)
        ? 'Using your default sources'
        : `Custom for this search · default ${defaults.length}/22`
    const unavailable = this.preferences.value?.unavailable.length ?? 0
    const note =
      this.note ||
      (unavailable
        ? `${unavailable} saved default ${unavailable === 1 ? 'source is' : 'sources are'} no longer available. Review My sources in Sources.`
        : '')
    const searched = snapshot
      ? DISCOVER_SOURCE_IDS.filter(
          (source) => snapshot.sourceOutcomes[source]?.status !== 'not_searched'
        )
      : []
    return [
      label('discover-source-mode', mode, { weight: 'secondary', textStyle: 'subheadline' }),
      ...(note ? [label('discover-source-note', note, { textStyle: 'subheadline' })] : []),
      ...(snapshot && !sameDiscoverSources(searched, this.sources)
        ? [
            label(
              'discover-source-scope-note',
              `These results searched ${searched.length} of 22 sources. The next search uses ${this.sources.size} of 22 sources.`,
              { weight: 'secondary', textStyle: 'subheadline' }
            )
          ]
        : [])
    ]
  }

  popoverRoot(busy: boolean): NativeNode | undefined {
    const draft = this.draft
    if (!draft) return undefined
    const b = new Controls(this.context),
      defaults = this.preferences.value?.sources
    return column(
      'discover-source-popover',
      [
        label('discover-source-sheet-title', 'Sources for this search', { weight: 'bold' }),
        label(
          'discover-source-hint',
          'Changes apply to the next search only. Your default sources stay the same.',
          { weight: 'secondary', textStyle: 'subheadline' }
        ),
        sourceChooser(this.context, draft, 'discover-source', !busy, 280),
        row('discover-source-footer', [
          draft.selection.size
            ? label('discover-source-footer-spacer', '', { flex: 1 })
            : label('discover-source-zero', 'Select at least one source to apply.', {
                weight: 'secondary',
                flex: 1
              }),
          b.button(
            'discover-source-use-defaults',
            'Use defaults',
            () => {
              if (defaults) draft.reset(defaults)
              this.context.redraw()
            },
            !!defaults && !busy
          ),
          b.button('discover-source-cancel', 'Cancel', () => {
            this.close()
            this.context.focus('discover-source-picker')
          }),
          {
            ...b.button(
              'discover-source-apply',
              'Apply to this search',
              () => {
                if (!draft.selection.size || busy) return
                this.sources = new Set(draft.selection)
                this.initialized = true
                this.note = ''
                this.close()
                this.context.focus('discover-source-picker')
              },
              draft.selection.size > 0 && !busy
            ),
            emphasis: 'primary' as const
          }
        ])
      ],
      { padding: 14, gap: 8 }
    )
  }

  private adopt(sources: readonly DiscoverSource[]): void {
    this.sources = new Set(sources)
    this.initialized = true
  }
}

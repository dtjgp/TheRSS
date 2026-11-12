import { orderedDiscoverSources } from '../../shared/discoverSourcePreference'
import { DISCOVER_SOURCE_IDS } from '../../shared/discover'
import { Controls, label, row, type NativeContext, type NativeSheet } from './common'
import type { NativeNode } from './presentation'
import { SourceDraft, sourceChooser } from './sourceChooser'
import type { SourcePreferences } from './sourcePreferences'

/**
 * The My sources sheet: edits a draft of the default Discover sources. Only Save writes the
 * default (through the main process); it never starts a search.
 */
export class MySourcesSheet implements NativeSheet {
  readonly title = 'Default search sources'
  readonly initialFocus = 'my-sources-query'
  readonly returnFocus = 'sources-my-sources'
  private readonly draft: SourceDraft
  private readonly controls: Controls
  private saving = false
  private closed = false
  private error = ''

  constructor(
    private readonly context: NativeContext,
    private readonly preferences: SourcePreferences
  ) {
    this.controls = new Controls(context)
    this.draft = new SourceDraft(preferences.value?.sources ?? [])
  }

  dismissed(): void {
    this.closed = true
  }
  /** A save in progress keeps the sheet open, so its result is always shown. */
  get busy(): boolean {
    return this.saving
  }

  render(): NativeNode[] {
    const b = this.controls,
      size = this.draft.selection.size,
      unavailable = this.preferences.value?.unavailable.length ?? 0
    return [
      label(
        'my-sources-description',
        'New Discover searches start with these sources. Saving does not start a search; you can still change the sources of one search in Discover.',
        { weight: 'secondary' }
      ),
      ...(unavailable
        ? [
            label(
              'my-sources-unavailable',
              `${unavailable} saved ${unavailable === 1 ? 'source is' : 'sources are'} no longer available and ${unavailable === 1 ? 'is' : 'are'} not used.`
            )
          ]
        : []),
      sourceChooser(this.context, this.draft, 'my-sources', !this.saving, 'fill'),
      ...(this.error ? [label('my-sources-error', this.error)] : []),
      row('my-sources-footer', [
        label('my-sources-count', `${size} of 22 selected`, { weight: 'bold' }),
        size
          ? label('my-sources-footer-spacer', '', { flex: 1 })
          : label('my-sources-zero', 'Select at least one source to save.', {
              weight: 'secondary',
              flex: 1
            }),
        b.button(
          'my-sources-restore',
          'Restore all',
          () => {
            this.draft.reset(DISCOVER_SOURCE_IDS)
            this.context.redraw()
          },
          !this.saving
        ),
        b.button('my-sources-cancel', 'Cancel', () => this.context.closeSheet?.(), !this.saving),
        {
          ...b.button(
            'my-sources-save',
            this.saving ? 'Saving…' : 'Save default sources',
            () => this.save(),
            size > 0 && !this.saving
          ),
          emphasis: 'primary' as const
        }
      ])
    ]
  }

  private async save(): Promise<void> {
    if (this.saving || !this.draft.selection.size) return
    this.saving = true
    this.error = ''
    this.context.redraw()
    try {
      await this.preferences.save(orderedDiscoverSources(this.draft.selection))
      // The sheet can close only after the save has ended.
      this.saving = false
      if (this.closed) return
      this.context.closeSheet?.()
      this.context.notify('Default sources saved. New Discover searches start with them.')
    } catch {
      this.saving = false
      if (!this.closed)
        this.error = 'The default sources could not be saved. Your choice is kept; try again.'
    } finally {
      this.context.redraw()
    }
  }
}

import { useEffect, useRef, useState } from 'react'
import type { TheRSSApi } from '../../shared/api'
import { DISCOVER_SOURCE_IDS, type DiscoverSource } from '../../shared/discover'
import {
  orderedDiscoverSources,
  type DiscoverSourcePreference
} from '../../shared/discoverSourcePreference'
import { cycleFocus } from './focusTrap'
import { SourceChooser } from './SourceChooser'
import { useDiscoverSources } from './useDiscoverSources'

interface MySourcesDialogProps {
  /** Saves the default through the window session; it throws on failure. */
  readonly save: (sources: readonly DiscoverSource[]) => Promise<DiscoverSourcePreference>
  readonly preference: Pick<DiscoverSourcePreference, 'sources' | 'unavailable'>
  readonly onClose: (saved: DiscoverSourcePreference | null) => void
}

/** Edits a draft of the default Discover sources; only Save writes it, and it starts no search. */
export function MySourcesDialog({ save: saveDefault, preference, onClose }: MySourcesDialogProps) {
  const [draft, setDraft] = useState<Set<DiscoverSource>>(() => new Set(preference.sources))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLInputElement>('#my-sources-query')?.focus()
  }, [])
  // The dialog is modal: Tab cycles inside it, and Escape cancels unless a save is running.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current
      if (!dialog) return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!saving) onClose(null)
        return
      }
      if (event.key !== 'Tab') return
      event.preventDefault()
      cycleFocus(dialog, event.shiftKey)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, saving])
  const save = async () => {
    if (!draft.size || saving) return
    setSaving(true)
    setError(null)
    // Every control is disabled while saving; the dialog itself keeps focus.
    dialogRef.current?.focus()
    try {
      onClose(await saveDefault(orderedDiscoverSources(draft)))
    } catch {
      setError('The default sources could not be saved. Your choice is kept; try again.')
      setSaving(false)
    }
  }
  return (
    <div className="my-sources-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="my-sources-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-sources-title"
        aria-describedby="my-sources-description"
        tabIndex={-1}
      >
        <h2 id="my-sources-title">Default search sources</h2>
        <p id="my-sources-description">
          New Discover searches start with these sources. Saving does not start a search.
        </p>
        {preference.unavailable.length > 0 && (
          <p role="note">
            {preference.unavailable.length} saved{' '}
            {preference.unavailable.length === 1 ? 'source is' : 'sources are'} no longer available
            and not used.
          </p>
        )}
        <SourceChooser
          idPrefix="my-sources"
          selection={draft}
          onChange={setDraft}
          checkboxLabel={(name) => `Use ${name} by default`}
          disabled={saving}
        />
        {error && <p role="alert">{error}</p>}
        <footer className="my-sources-dialog__footer">
          <strong>{draft.size} of 22 selected</strong>
          {draft.size === 0 && <span role="status">Select at least one source to save.</span>}
          <button
            type="button"
            disabled={saving}
            onClick={() => setDraft(new Set(DISCOVER_SOURCE_IDS))}
          >
            Restore all
          </button>
          <button type="button" disabled={saving} onClick={() => onClose(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={saving || draft.size === 0}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save default sources'}
          </button>
        </footer>
      </section>
    </div>
  )
}

/** The Sources header entry: shows the default count and opens the My sources dialog. */
export function MySourcesEntry({
  api
}: {
  readonly api: Pick<TheRSSApi, 'getDiscoverSourcePreference' | 'saveDiscoverSourcePreference'>
}) {
  // The same window session as Discover, so a saved default reaches this search's sources.
  const sources = useDiscoverSources(api)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const entryRef = useRef<HTMLButtonElement>(null)
  return (
    <div className="my-sources-entry">
      <button
        ref={entryRef}
        type="button"
        className="secondary-button"
        onClick={() => {
          setMessage('')
          if (sources.defaults) setOpen(true)
          else sources.retry()
        }}
      >
        {sources.defaults
          ? `My sources · ${sources.defaults.length}/22`
          : 'My sources · not loaded'}
      </button>
      <p role="status" aria-label="My sources status">
        {sources.failed
          ? 'Your default sources could not be read. Choose My sources to try again.'
          : message}
      </p>
      {open && sources.defaults && (
        <MySourcesDialog
          save={(next) => sources.session.saveDefault(next)}
          preference={{ sources: sources.defaults, unavailable: sources.unavailable }}
          onClose={(saved) => {
            setOpen(false)
            if (saved) setMessage('Default sources saved. New Discover searches start with them.')
            entryRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}

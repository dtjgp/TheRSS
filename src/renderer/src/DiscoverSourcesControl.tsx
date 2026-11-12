import { useRef, useState } from 'react'
import {
  DISCOVER_SOURCE_IDS,
  type DiscoverSnapshot,
  type DiscoverSource
} from '../../shared/discover'
import { sameDiscoverSources } from '../../shared/discoverSourcePreference'
import { SourceChooser } from './SourceChooser'
import type { DiscoverSourcesState } from './useDiscoverSources'

interface DiscoverSourcesControlProps {
  readonly state: DiscoverSourcesState
  readonly disabled: boolean
}

/** The Sources for this search trigger and its inline chooser with a separate draft. */
export function DiscoverSourcesControl({ state, disabled }: DiscoverSourcesControlProps) {
  const [draft, setDraft] = useState<Set<DiscoverSource> | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const close = () => {
    setDraft(null)
    triggerRef.current?.focus()
  }
  return (
    <div className="discover-source-picker">
      <button
        ref={triggerRef}
        type="button"
        className="discover-source-trigger"
        aria-label={`Choose sources, ${state.sources.length} of ${DISCOVER_SOURCE_IDS.length} selected`}
        aria-expanded={draft !== null}
        aria-controls="discover-source-options"
        disabled={disabled}
        onClick={() => setDraft((current) => (current ? null : new Set(state.sources)))}
      >
        <span>Sources for this search</span>
        <strong>
          {state.sources.length} of {DISCOVER_SOURCE_IDS.length} selected
        </strong>
        <span className="discover-source-trigger__chevron" aria-hidden="true">
          ›
        </span>
      </button>
      {draft && !disabled && (
        <fieldset
          id="discover-source-options"
          className="discover-source-control"
          aria-label="Search sources"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              close()
            }
          }}
        >
          <legend>Sources for this search</legend>
          <p className="discover-source-control__hint">
            Changes apply to the next search only. Your default sources stay the same.
          </p>
          <SourceChooser
            idPrefix="discover-source"
            selection={draft}
            onChange={setDraft}
            checkboxLabel={(name) => `Search ${name}`}
          />
          <div className="discover-source-control__footer">
            {draft.size === 0 && <span role="status">Select at least one source to apply.</span>}
            <button
              type="button"
              disabled={!state.defaults}
              onClick={() => state.defaults && setDraft(new Set(state.defaults))}
            >
              Use defaults
            </button>
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={draft.size === 0}
              onClick={() => {
                state.apply(draft)
                close()
              }}
            >
              Apply to this search
            </button>
          </div>
        </fieldset>
      )}
    </div>
  )
}

/** Mode, unavailable or failed default, and the stored session's scope next to the composer. */
export function DiscoverSourceStatus({
  state,
  snapshot
}: {
  readonly state: DiscoverSourcesState
  readonly snapshot: DiscoverSnapshot | null
}) {
  const searched = snapshot
    ? DISCOVER_SOURCE_IDS.filter(
        (source) => snapshot.sourceOutcomes[source]?.status !== 'not_searched'
      )
    : []
  return (
    <div className="discover-source-status">
      {state.failed ? (
        <p role="alert">
          <span>
            Your default sources could not be read. Retry, or choose sources for this search.
          </span>{' '}
          <button type="button" className="text-button" onClick={state.retry}>
            Retry reading default sources
          </button>
        </p>
      ) : (
        <p>
          {!state.defaults
            ? 'Reading your default sources…'
            : sameDiscoverSources(state.sources, state.defaults)
              ? 'Using your default sources'
              : `Custom for this search · default ${state.defaults.length}/22`}
        </p>
      )}
      {state.note && <p role="status">{state.note}</p>}
      {state.unavailable.length > 0 && (
        <p>
          {state.unavailable.length} saved default{' '}
          {state.unavailable.length === 1 ? 'source is' : 'sources are'} no longer available. Review
          My sources in Sources.
        </p>
      )}
      {snapshot && !sameDiscoverSources(searched, state.sources) && (
        <p>
          These results searched {searched.length} of 22 sources. The next search uses{' '}
          {state.sources.length} of 22 sources.
        </p>
      )}
    </div>
  )
}

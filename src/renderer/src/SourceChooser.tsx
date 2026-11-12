import { useState } from 'react'
import type { DiscoverSource } from '../../shared/discover'
import { SOURCE_GROUPS } from '../../shared/sourceGroups'
import { changeShownSources, visibleSourceChoices } from '../../shared/sourceChoice'

interface SourceChooserProps {
  readonly idPrefix: string
  readonly selection: ReadonlySet<DiscoverSource>
  readonly onChange: (next: Set<DiscoverSource>) => void
  /** Accessible checkbox name for a source. */
  readonly checkboxLabel: (name: string) => string
  readonly disabled?: boolean
}

/**
 * The Web source chooser shared by Discover and My sources: a local finder over name, research
 * role and group, Only selected, Select/Clear shown and grouped checkboxes with roles.
 */
export function SourceChooser({
  idPrefix,
  selection,
  onChange,
  checkboxLabel,
  disabled = false
}: SourceChooserProps) {
  const [query, setQuery] = useState('')
  const [onlySelected, setOnlySelected] = useState(false)
  const shown = visibleSourceChoices(selection, query, onlySelected)
  return (
    <div className="source-chooser">
      <div className="source-chooser__finder">
        <input
          id={`${idPrefix}-query`}
          type="search"
          aria-label="Find sources"
          placeholder="Find by name, research role or group"
          value={query}
          maxLength={100}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={onlySelected}
            disabled={disabled}
            onChange={(event) => setOnlySelected(event.target.checked)}
          />
          Only selected
        </label>
      </div>
      <div className="source-chooser__bulk">
        <span role="status">
          {shown.length} of 22 shown · {selection.size} selected
        </span>
        <button
          type="button"
          disabled={disabled || !shown.length}
          onClick={() => onChange(changeShownSources(selection, shown, true))}
        >
          Select shown
        </button>
        <button
          type="button"
          disabled={disabled || !shown.length}
          onClick={() => onChange(changeShownSources(selection, shown, false))}
        >
          Clear shown
        </button>
      </div>
      <div className="source-chooser__groups">
        {shown.length === 0 && (
          <p>
            No source matches this search.{' '}
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setQuery('')
                setOnlySelected(false)
              }}
            >
              Show all sources
            </button>
          </p>
        )}
        {SOURCE_GROUPS.map((group) => {
          const visible = shown.filter((choice) => choice.groupId === group.id)
          if (!visible.length) return null
          const selected = group.sources.filter((source) =>
            selection.has(source as DiscoverSource)
          ).length
          return (
            <section key={group.id} aria-label={group.title}>
              <h3>
                {group.title} · {selected}/{group.sources.length} selected
              </h3>
              {visible.map((choice) => (
                <label key={choice.source} className="source-chooser__choice">
                  <input
                    type="checkbox"
                    aria-label={checkboxLabel(choice.name)}
                    checked={selection.has(choice.source)}
                    disabled={disabled}
                    onChange={(event) => {
                      const next = new Set(selection)
                      if (event.target.checked) next.add(choice.source)
                      else next.delete(choice.source)
                      onChange(next)
                    }}
                  />
                  <span>
                    <strong>{choice.name}</strong>
                    {choice.role && <small>{choice.role}</small>}
                  </span>
                </label>
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}

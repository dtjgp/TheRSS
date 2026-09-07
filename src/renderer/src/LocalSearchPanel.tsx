import { useCallback, useEffect, useRef, useState } from 'react'
import type { TheRSSApi } from '../../shared/api'
import type { LocalSearchResult } from '../../shared/localSearch'
import { sourceDisplayName } from '../../shared/sourceIdentity'

interface LocalSearchPanelProps {
  readonly api: Pick<TheRSSApi, 'searchLocal'>
  readonly onClose: () => void
}

function kindLabel(kind: LocalSearchResult['kind']): string {
  if (kind === 'saved') return 'Saved'
  if (kind === 'analysis') return 'Analysis'
  return 'Discover'
}

function isTabbable(element: HTMLElement): boolean {
  if (element.tabIndex < 0 || element.matches(':disabled')) return false
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false
  if (getComputedStyle(element).visibility !== 'visible') return false
  for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
    if (getComputedStyle(ancestor).display === 'none') return false
  }
  return true
}

export function LocalSearchPanel({ api, onClose }: LocalSearchPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<readonly LocalSearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestVersion = useRef(0)
  const pendingQuery = useRef<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const invalidateRequests = useCallback(() => {
    requestVersion.current++
    pendingQuery.current = null
  }, [])

  const search = useCallback(
    async (value: string) => {
      if (searchTimer.current !== undefined) clearTimeout(searchTimer.current)
      const trimmed = value.trim()
      if (trimmed.length < 2 || trimmed.length > 200 || pendingQuery.current === trimmed) return
      const version = ++requestVersion.current
      pendingQuery.current = trimmed
      setIsSearching(true)
      setError(null)
      try {
        const response = await api.searchLocal(trimmed)
        if (version !== requestVersion.current) return
        setResults(response.results)
        setHasSearched(true)
      } catch {
        if (version !== requestVersion.current) return
        setResults([])
        setHasSearched(false)
        setError('The local research index could not be searched.')
      } finally {
        if (version === requestVersion.current) {
          pendingQuery.current = null
          setIsSearching(false)
        }
      }
    },
    [api]
  )

  useEffect(() => {
    if (query.trim().length >= 2) searchTimer.current = setTimeout(() => void search(query), 250)
    return () => {
      if (searchTimer.current !== undefined) clearTimeout(searchTimer.current)
      invalidateRequests()
    }
  }, [query, search, invalidateRequests])

  useEffect(() => {
    const previousFocus = document.activeElement
    inputRef.current?.focus()
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      const panel = panelRef.current
      if (event.key !== 'Tab' || !panel) return
      event.preventDefault()
      const controls = Array.from(
        panel.querySelectorAll<HTMLElement>('a[href], button, input, [tabindex]')
      ).filter(isTabbable)
      const currentIndex = controls.findIndex((control) => control === document.activeElement)
      const nextIndex = event.shiftKey
        ? currentIndex <= 0
          ? controls.length - 1
          : currentIndex - 1
        : (currentIndex + 1) % controls.length
      const nextControl = controls[nextIndex] ?? panel
      nextControl.focus()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const changeQuery = (value: string) => {
    invalidateRequests()
    setQuery(value)
    setResults([])
    setHasSearched(false)
    setIsSearching(false)
    setError(null)
  }

  return (
    <div
      className="local-search-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <section
        ref={panelRef}
        className="local-search-panel"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="local-search-heading"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">LOCAL ONLY</p>
            <h2 id="local-search-heading">Find research</h2>
          </div>
          <button
            type="button"
            className="text-button"
            aria-label="Close local search"
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            void search(query)
          }}
        >
          <input
            ref={inputRef}
            type="search"
            aria-label="Search local research"
            value={query}
            minLength={2}
            maxLength={200}
            placeholder="Saved items, Discover sessions, analysis content"
            onChange={(event) => changeQuery(event.target.value)}
          />
        </form>
        <p className="local-search-boundary">
          Searches bounded fields in the local SQLite index. No model or network request is used.
        </p>
        {isSearching && <p role="status">Searching local records…</p>}
        {error && <p role="alert">{error}</p>}
        {hasSearched && results.length === 0 && (
          <p role="status">No local records matched this query.</p>
        )}
        {results.length > 0 && (
          <ol className="local-search-results" aria-label="Local search results">
            {results.map((result) => (
              <li key={`${result.kind}:${result.id}`}>
                <div>
                  <span>{kindLabel(result.kind)}</span>
                  <span>{sourceDisplayName(result.source)}</span>
                </div>
                <a href={result.url} target="_blank" rel="noreferrer">
                  {result.title}
                </a>
                <p>{result.detail}</p>
                <time dateTime={result.createdAt}>
                  {new Date(result.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

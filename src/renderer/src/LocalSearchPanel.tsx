import { useEffect, useState, type FormEvent } from 'react'
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

export function LocalSearchPanel({ api, onClose }: LocalSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<readonly LocalSearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const search = async (event: FormEvent) => {
    event.preventDefault()
    if (query.trim().length < 2) return
    setIsSearching(true)
    setError(null)
    try {
      const response = await api.searchLocal(query)
      setResults(response.results)
      setHasSearched(true)
    } catch {
      setResults([])
      setHasSearched(false)
      setError('The local research index could not be searched.')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="local-search-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="local-search-panel"
        role="dialog"
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
        <form role="search" onSubmit={(event) => void search(event)}>
          <input
            autoFocus
            type="search"
            aria-label="Search local research"
            value={query}
            minLength={2}
            maxLength={200}
            placeholder="Saved items, Discover sessions, analysis content"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="submit"
            className="primary-button"
            disabled={query.trim().length < 2 || isSearching}
          >
            {isSearching ? 'Searching…' : 'Search'}
          </button>
        </form>
        <p className="local-search-boundary">
          Searches bounded fields in the local SQLite index. No model or network request is used.
        </p>
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

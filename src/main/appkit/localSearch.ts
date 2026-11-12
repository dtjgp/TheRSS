import {
  localSearchQuerySchema,
  localSearchTruncationText,
  localSearchScopeSchema,
  type LocalSearchResponse,
  type LocalSearchResult,
  type LocalSearchScope
} from '../../shared/localSearch'
import { sourceDisplayName } from '../../shared/sourceIdentity'
import { formatDisplayDate } from '../../shared/sourceDate'
import {
  column,
  Controls,
  emptyState,
  label,
  readableError,
  row,
  type NativeContext
} from './common'
import type { NativeNode, NativeToolbarItem } from './presentation'

const resultKey = (item: LocalSearchResult): string => `${item.kind}:${item.id}`
export const LOCAL_SEARCH_FIELD = 'local-search-query'

const SCOPES: Record<LocalSearchScope, { title: string; empty: string; area: string }> = {
  all: { title: 'All', empty: 'results', area: '' },
  saved: { title: 'Saved', empty: 'Saved items', area: 'Saved research' },
  discover: {
    title: 'Search sessions',
    empty: 'search-session results',
    area: 'Discover sessions'
  },
  analysis: { title: 'Analyses', empty: 'analyses', area: 'stored analyses' }
}

/**
 * Local research search driven by the window toolbar field (Notes/Mail pattern). A non-empty
 * query shows results in the content area; the search keeps its query and results after a
 * result is opened so "Back to search results" can restore it.
 */
export class LocalSearchScreen {
  private readonly controls: Controls
  private version = 0
  private query = ''
  private scope: LocalSearchScope = 'all'
  private response: LocalSearchResponse | null = null
  private selectedResult = ''
  private busy = false
  private opening = false
  private message = ''
  private disposed = false
  private searchTimer: ReturnType<typeof setTimeout> | undefined
  /** True while the content area shows the search results instead of a workspace. */
  showing = false

  constructor(private readonly context: NativeContext) {
    this.controls = new Controls(context)
  }
  get hasResults(): boolean {
    return !!this.response?.results.length
  }
  dispose(): void {
    this.clearSearchTimer()
    this.disposed = true
    this.version++
  }
  /** Leave the results (a result was opened) while keeping them for "Back to search results". */
  suspend(): void {
    this.showing = false
  }
  resume(): void {
    this.showing = this.query.trim().length > 0
  }
  clear(): void {
    this.clearSearchTimer()
    this.version++
    this.query = ''
    this.scope = 'all'
    this.response = null
    this.selectedResult = ''
    this.message = ''
    this.busy = false
    this.opening = false
    this.showing = false
  }
  toolbarItem(enabled: boolean): NativeToolbarItem {
    const presentation = this.context.presentation
    return {
      id: LOCAL_SEARCH_FIELD,
      kind: 'search',
      title: 'Search local research',
      placeholder: 'Search saved items, sessions and analyses',
      help: 'Search local research (Command-F)',
      symbol: 'magnifyingglass',
      value: this.query,
      enabled,
      action: presentation.action(
        'toolbar:search-text',
        (value) => {
          if (enabled) this.changeQuery(value as string)
        },
        { type: 'text', max: 200 }
      ),
      // Return in the field searches immediately; Return in the result list opens a record.
      activate: presentation.action('toolbar:search-enter', () =>
        enabled ? this.search() : undefined
      )
    }
  }

  render(): NativeNode {
    const b = this.controls,
      response = this.response
    const selected =
      response?.results.find((item) => resultKey(item) === this.selectedResult) ??
      response?.results[0]
    return column(
      'local-search-page',
      [
        label(
          'local-search-instructions',
          this.opening
            ? 'Opening local record…'
            : this.busy
              ? 'Searching local records…'
              : 'Type 2–200 characters. Click a result or press Return to open it in TheRSS. Open original opens the selected result’s original link.',
          { weight: 'secondary' }
        ),
        // In a row the control keeps its natural width, as the Discover result-kind control does.
        row('local-search-scope-row', [
          b.segmented(
            'local-search-scope',
            'Search scope',
            this.scope,
            localSearchScopeSchema.options.map((id) => ({ id, title: SCOPES[id].title })),
            (value) => this.changeScope(localSearchScopeSchema.parse(value))
          )
        ]),
        ...(this.message ? [label('local-search-message', this.message)] : []),
        ...(response
          ? [
              label(
                'local-search-result-count',
                `${response.results.length} ${response.results.length === 1 ? 'result' : 'results'} for “${response.query}”`,
                { weight: 'bold' }
              ),
              ...(response.truncated
                ? [
                    label(
                      'local-search-truncated',
                      localSearchTruncationText(response.scope, true),
                      {
                        weight: 'secondary'
                      }
                    )
                  ]
                : [])
            ]
          : []),
        ...(response?.results.length
          ? [
              b.table(
                'local-search-results',
                'Local research results',
                response.results.map((item) => ({
                  id: resultKey(item),
                  title: item.title,
                  subtitle: `${{ saved: 'Saved item', discover: 'Search session', analysis: 'Stored analysis' }[item.kind]} · ${sourceDisplayName(item.source)} · ${formatDisplayDate(item.createdAt, this.context.locale)}`
                })),
                selected ? resultKey(selected) : '',
                (id) => {
                  this.selectedResult = id
                  this.context.redraw()
                },
                {
                  activate: (id) => {
                    this.selectedResult = id
                    return this.openLocalResult()
                  }
                }
              ),
              ...(selected
                ? [
                    label('local-search-selected-detail', selected.detail),
                    row('local-search-result-actions', [
                      b.button(
                        'local-search-open',
                        'Open original',
                        () => this.context.openExternal(selected.url),
                        true,
                        `local-result:${selected.id}:open`
                      )
                    ])
                  ]
                : [])
            ]
          : [
              response
                ? emptyState(
                    'local-search-empty',
                    'magnifyingglass',
                    `No ${SCOPES[response.scope].empty} ${response.scope === 'all' ? 'for' : 'match'} “${response.query}”`,
                    response.scope === 'all'
                      ? 'No matching local records. Search looks in Saved research, Discover sessions and stored analyses on this Mac.'
                      : `This scope searches only ${SCOPES[response.scope].area} on this Mac. Choose All to search every kind of local record.`
                  )
                : emptyState(
                    'local-search-empty',
                    'magnifyingglass',
                    'Search local research',
                    'Search Saved research, Discover sessions and stored analyses.'
                  )
            ])
      ],
      { flex: 1, gap: 10 }
    )
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== undefined) clearTimeout(this.searchTimer)
    this.searchTimer = undefined
  }
  private changeQuery(query: string): void {
    // Clearing (clear button, Escape) always ends the search, even while a result is opening:
    // it is the toolbar equivalent of closing the old sheet and cancels a pending navigation.
    if (!query.trim()) {
      this.clear()
      this.context.redraw()
      return
    }
    if (this.opening) return
    this.clearSearchTimer()
    this.version++
    this.query = query
    this.response = null
    this.selectedResult = ''
    this.message = ''
    this.busy = false
    this.showing = true
    if (localSearchQuerySchema.safeParse(query).success)
      this.searchTimer = setTimeout(() => {
        this.searchTimer = undefined
        void this.search()
      }, 250)
    this.context.redraw()
  }
  /** A new scope keeps the query and searches again; a late response for the old scope is dropped. */
  private changeScope(scope: LocalSearchScope): void {
    // While a result opens, the redraw restores the control to the unchanged scope.
    if (!this.opening && scope !== this.scope) {
      this.clearSearchTimer()
      this.version++
      this.scope = scope
      this.response = null
      this.selectedResult = ''
      this.message = ''
      this.busy = false
      void this.search()
    }
    this.context.redraw()
  }
  private async openLocalResult(): Promise<void> {
    const selected =
      this.response?.results.find((item) => resultKey(item) === this.selectedResult) ??
      this.response?.results[0]
    if (!selected || this.busy || !this.showing) return
    const version = this.version
    const isCurrent = () => !this.disposed && version === this.version && this.showing
    this.busy = true
    this.opening = true
    this.message = ''
    this.context.redraw()
    try {
      const message = await this.context.openLocal(selected.target, isCurrent)
      if (isCurrent() && message) this.message = message
    } catch (error) {
      if (isCurrent()) this.message = readableError(error)
    } finally {
      if (version === this.version && !this.disposed) {
        this.busy = false
        this.opening = false
        this.context.redraw()
      }
    }
  }
  private async search(): Promise<void> {
    this.clearSearchTimer()
    const parsed = localSearchQuerySchema.safeParse(this.query)
    if (!parsed.success || this.busy || this.disposed) return
    const version = this.version
    this.busy = true
    this.message = ''
    this.context.redraw()
    try {
      // The default scope keeps the original one-argument call for compatibility.
      const response = await (this.scope === 'all'
        ? this.context.api.searchLocal(parsed.data)
        : this.context.api.searchLocal(parsed.data, this.scope))
      if (!this.disposed && version === this.version) {
        this.response = response
        this.selectedResult = response.results[0] ? resultKey(response.results[0]) : ''
      }
    } catch (error) {
      if (!this.disposed && version === this.version) this.message = readableError(error)
    } finally {
      if (version === this.version) {
        this.busy = false
        this.context.redraw()
      }
    }
  }
}

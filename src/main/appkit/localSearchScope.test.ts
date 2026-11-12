import { describe, expect, it, vi } from 'vitest'
import type {
  LocalSearchResponse,
  LocalSearchResult,
  LocalSearchScope
} from '../../shared/localSearch'
import { localSearchHarness, nativeHarness } from './testSupport'

const result = (kind: LocalSearchResult['kind'], id: string): LocalSearchResult => ({
  id,
  kind,
  itemId: `arxiv:${id}`,
  title: `${kind} ${id}`,
  detail: 'Detail',
  url: `https://arxiv.org/abs/${id}`,
  source: 'arxiv',
  createdAt: '2026-10-01T00:00:00.000Z',
  target:
    kind === 'discover'
      ? { kind, sessionId: 'session', itemId: `arxiv:${id}` }
      : kind === 'saved'
        ? { kind, itemId: `arxiv:${id}` }
        : { kind, analysisId: id }
})

function setup(respond: (query: string, scope?: LocalSearchScope) => Promise<LocalSearchResponse>) {
  const searchLocal = vi.fn(respond)
  const h = nativeHarness({ searchLocal })
  const screen = localSearchHarness(h.context)
  const view = () => h.render(screen)
  const submit = () =>
    h.context.presentation.dispatch(
      JSON.stringify({ action: h.find(view(), 'local-search-query')!.activate })
    )
  return { h, screen, view, submit, searchLocal }
}

const response = (
  query: string,
  scope: LocalSearchScope,
  results: LocalSearchResult[],
  truncated = false
): LocalSearchResponse => ({ query, scope, results, truncated })

describe('native local search scope', () => {
  it('searches all records by default and searches again in a chosen scope with the same query', async () => {
    const f = setup(async (query, scope = 'all') =>
      response(query, scope, [result(scope === 'saved' ? 'saved' : 'discover', scope)])
    )
    await f.h.act(f.screen, 'local-search-query', 'edge')
    await f.submit()
    const control = f.h.find(f.view(), 'local-search-scope')
    expect(control?.kind).toBe('segmented')
    expect(control?.selected).toBe('all')
    expect(control?.options?.map(({ id, title }) => [id, title])).toEqual([
      ['all', 'All'],
      ['saved', 'Saved'],
      ['discover', 'Search sessions'],
      ['analysis', 'Analyses']
    ])
    // The default search keeps the existing one-argument call.
    expect(f.searchLocal).toHaveBeenLastCalledWith('edge')

    await f.h.act(f.screen, 'local-search-scope', 'saved')
    expect(f.searchLocal).toHaveBeenLastCalledWith('edge', 'saved')
    expect(f.h.find(f.view(), 'local-search-query')?.value).toBe('edge')
    expect(f.h.find(f.view(), 'local-search-scope')?.selected).toBe('saved')
    expect(f.h.find(f.view(), 'local-search-results')?.rows?.map(({ id }) => id)).toEqual([
      'saved:saved'
    ])
  })

  it('ignores a late response from the previous scope', async () => {
    const pending = new Map<string, (value: LocalSearchResponse) => void>()
    const f = setup(
      (query, scope = 'all') =>
        new Promise((resolve) => {
          pending.set(scope, resolve)
        })
    )
    await f.h.act(f.screen, 'local-search-query', 'edge')
    const first = f.submit()
    await f.h.act(f.screen, 'local-search-scope', 'analysis')
    pending.get('analysis')!(response('edge', 'analysis', [result('analysis', 'new')]))
    await Promise.resolve()
    pending.get('all')!(response('edge', 'all', [result('discover', 'old')]))
    await first
    expect(f.h.find(f.view(), 'local-search-results')?.rows?.map(({ id }) => id)).toEqual([
      'analysis:new'
    ])
    expect(f.h.find(f.view(), 'local-search-scope')?.selected).toBe('analysis')
  })

  it('states a real truncation only when the response reports one', async () => {
    let truncated = false
    const f = setup(async (query, scope = 'all') =>
      response(query, scope, [result('saved', '1')], truncated)
    )
    await f.h.act(f.screen, 'local-search-query', 'edge')
    await f.submit()
    expect(f.h.find(f.view(), 'local-search-truncated')).toBeUndefined()

    truncated = true
    await f.h.act(f.screen, 'local-search-query', 'edges')
    await f.submit()
    expect(f.h.find(f.view(), 'local-search-truncated')?.text).toBe(
      'Not every match is shown. All lists up to 25 newest matches of each kind and 50 in total. Choose a scope or refine the search to see older matches.'
    )
    await f.h.act(f.screen, 'local-search-scope', 'saved')
    expect(f.h.find(f.view(), 'local-search-truncated')?.text).toBe(
      'Not every match is shown. This scope lists the 50 newest matches. Refine the search to see older matches.'
    )
  })

  it('names the scope when it has no matches and resets to all when the search is cleared', async () => {
    const f = setup(async (query, scope = 'all') => response(query, scope, []))
    await f.h.act(f.screen, 'local-search-query', 'edge')
    await f.submit()
    await f.h.act(f.screen, 'local-search-scope', 'analysis')
    const empty = f.h.find(f.view(), 'local-search-empty')
    expect(f.h.find(empty!, 'local-search-empty-title')?.text).toBe('No analyses match “edge”')
    expect(f.h.find(empty!, 'local-search-empty-message')?.text).toBe(
      'This scope searches only stored analyses on this Mac. Choose All to search every kind of local record.'
    )
    expect(f.h.find(f.view(), 'local-search-scope')).toBeDefined()

    await f.h.act(f.screen, 'local-search-query', '')
    await f.h.act(f.screen, 'local-search-query', 'edge')
    await f.submit()
    expect(f.h.find(f.view(), 'local-search-scope')?.selected).toBe('all')
    expect(f.searchLocal).toHaveBeenLastCalledWith('edge')
  })

  it('redraws a scope change without searching when the query is too short', async () => {
    const f = setup(async (query, scope = 'all') => response(query, scope, []))
    await f.h.act(f.screen, 'local-search-query', 'x')
    vi.mocked(f.h.context.redraw).mockClear()
    await f.h.act(f.screen, 'local-search-scope', 'saved')
    expect(f.searchLocal).not.toHaveBeenCalled()
    expect(f.h.context.redraw).toHaveBeenCalled()
    expect(f.h.find(f.view(), 'local-search-scope')?.selected).toBe('saved')
  })

  it('keeps the scope when the screen is suspended for an opened result and resumed', async () => {
    const f = setup(async (query, scope = 'all') => response(query, scope, [result('saved', '1')]))
    await f.h.act(f.screen, 'local-search-query', 'edge')
    await f.submit()
    await f.h.act(f.screen, 'local-search-scope', 'saved')
    f.screen.search.suspend()
    expect(f.h.find(f.view(), 'local-search-scope')).toBeUndefined()
    f.screen.search.resume()
    expect(f.h.find(f.view(), 'local-search-scope')?.selected).toBe('saved')
    expect(f.h.find(f.view(), 'local-search-results')?.selected).toBe('saved:1')
  })
})

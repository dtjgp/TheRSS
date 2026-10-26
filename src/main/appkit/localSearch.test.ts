import { describe, expect, it, vi } from 'vitest'
import { localSearchHarness, nativeHarness } from './testSupport'

describe('toolbar local research search', () => {
  it('keeps Saved and analysis records with the same identifier distinct when opening locally', async () => {
    const results = (['saved', 'analysis'] as const).map((kind) => ({
      id: 'same-id',
      kind,
      itemId: 'arxiv:1',
      title: 'Same paper',
      detail: kind,
      source: 'arxiv' as const,
      url: 'https://arxiv.org/abs/1',
      createdAt: 'now',
      target: kind === 'saved' ? { kind, itemId: 'arxiv:1' } : { kind, analysisId: 'same-id' }
    }))
    const h = nativeHarness({ searchLocal: vi.fn(async () => ({ query: 'paper', results })) })
    const screen = localSearchHarness(h.context)
    await h.act(screen, 'local-search-query', 'paper')
    await h.context.presentation.dispatch(
      JSON.stringify({ action: h.find(h.render(screen), 'local-search-query')!.activate })
    )
    const rows = h.find(h.render(screen), 'local-search-results')!.rows!
    expect(new Set(rows.map((row) => row.id)).size).toBe(2)
    await h.act(screen, 'local-search-results', 'analysis:same-id')
    await h.context.presentation.dispatch(
      JSON.stringify({
        action: h.find(h.render(screen), 'local-search-results')!.activate,
        value: 'analysis:same-id'
      })
    )
    expect(h.context.openLocal).toHaveBeenCalledWith(
      { kind: 'analysis', analysisId: 'same-id' },
      expect.any(Function)
    )
    expect(h.context.openExternal).not.toHaveBeenCalled()
  })
  it('supports immediate Return, validates length, and hides late results after the field is cleared', async () => {
    let finish!: (value: { query: string; results: [] }) => void
    const search = vi.fn(
      () =>
        new Promise<{ query: string; results: [] }>((resolve) => {
          finish = resolve
        })
    )
    const h = nativeHarness({ searchLocal: search })
    const screen = localSearchHarness(h.context)
    await h.act(screen, 'local-search-query', 'x')
    expect(h.find(h.render(screen), 'local-search-submit')).toBeUndefined()
    await h.act(screen, 'local-search-query', 'edge')
    expect(search).not.toHaveBeenCalled()
    const running = h.context.presentation.dispatch(
      JSON.stringify({ action: h.find(h.render(screen), 'local-search-query')!.activate })
    )
    screen.search.clear()
    finish({ query: 'edge', results: [] })
    await running
    expect(screen.search.showing).toBe(false)
    expect(h.find(h.render(screen), 'local-search-result-count')).toBeUndefined()
  })
})

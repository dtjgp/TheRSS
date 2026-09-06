import { describe, expect, it, vi } from 'vitest'
import type { SourceContentSnapshot } from '../../shared/api'
import { SourcesScreen } from './sources'
import { nativeHarness } from './testSupport'

const cached = (source: 'arxiv' | 'github'): SourceContentSnapshot => ({
  source,
  status: 'cached',
  windowDays: source === 'arxiv' ? 1 : 30,
  windowStart: '2026-09-01',
  windowEnd: '2026-09-06',
  lastIndexedAt: null,
  returnedCount: 0,
  rejectedCount: 0,
  items: []
})

describe('AppKit Sources', () => {
  it('filters the directory using the same presentation groups without fetching', async () => {
    const h = nativeHarness()
    const screen = new SourcesScreen(h.context)
    await h.act(screen, 'sources-group', 'code')
    expect(
      h
        .find(h.render(screen), 'sources-list')
        ?.rows?.map((row) => row.id)
        .sort()
    ).toEqual(['folo:10', 'folo:64'])
    await h.act(screen, 'sources-group', 'papers')
    expect(h.find(h.render(screen), 'sources-list')?.rows).toHaveLength(4)
    await h.act(screen, 'sources-group', 'all')
    expect(h.find(h.render(screen), 'sources-list')?.rows).toHaveLength(22)
    screen.dispose()
  })
  it('preserves readable content when refreshing the same source fails', async () => {
    const content = {
      ...cached('arxiv'),
      items: [
        {
          id: 'arxiv:cached',
          source: 'arxiv' as const,
          title: 'Readable cached paper',
          summary: 'Cached summary',
          url: 'https://arxiv.org',
          publishedAt: 'now',
          updatedAt: 'now',
          triageState: 'new' as const,
          score: 1,
          reasons: []
        }
      ]
    }
    const h = nativeHarness({
      getSourceContent: vi.fn(async () => content),
      refreshSourceContent: vi.fn(async () => {
        throw new Error('Refresh failed')
      })
    })
    const screen = new SourcesScreen(h.context)
    await screen.activate('official:arxiv')
    await screen.activate('official:arxiv', true)
    expect(h.find(h.render(screen), 'source-content-title')?.text).toBe('Readable cached paper')
    expect(h.find(h.render(screen), 'source-content-error')?.text).toContain('Refresh failed')
  })
  it('shows an empty state and removes old source actions when filters match nothing', async () => {
    const h = nativeHarness(),
      screen = new SourcesScreen(h.context)
    await h.act(screen, 'sources-query', 'no-such-source-unique-fixture')
    expect(h.find(h.render(screen), 'sources-empty-message')?.text).toContain('No sources')
    expect(h.find(h.render(screen), 'sources-refresh')).toBeUndefined()
  })
  it('does not fetch initial previews or keyboard focus; activation loads source content', async () => {
    const get = vi.fn(async () => cached('arxiv'))
    const refresh = vi.fn(async () => ({ ...cached('arxiv'), status: 'no_results' as const }))
    const h = nativeHarness({ getSourceContent: get, refreshSourceContent: refresh })
    const screen = new SourcesScreen(h.context)
    const root = h.render(screen)
    expect(get).not.toHaveBeenCalled()
    await h.act(screen, 'sources-list', 'official:arxiv')
    expect(get).not.toHaveBeenCalled()
    const table = h.find(root, 'sources-list')!
    await h.context.presentation.dispatch(
      JSON.stringify({ action: table.activate, value: 'official:arxiv' })
    )
    expect(get).toHaveBeenCalledWith('arxiv')
    expect(refresh).toHaveBeenCalledWith('arxiv')
    expect(JSON.stringify(h.render(screen))).toContain('Fetched · no results')
  })

  it('keeps GitHub content read-only and routes retrieval to Discover', async () => {
    const get = vi.fn(async () => cached('github'))
    const refresh = vi.fn()
    const h = nativeHarness({ getSourceContent: get, refreshSourceContent: refresh })
    const screen = new SourcesScreen(h.context)
    await screen.activate('folo:10')
    expect(get).toHaveBeenCalledWith('github')
    expect(refresh).not.toHaveBeenCalled()
    expect(h.find(h.render(screen), 'sources-refresh')?.enabled).toBe(false)
    expect(JSON.stringify(h.render(screen))).toContain('Use Discover')
    expect(h.find(h.render(screen), 'saved-save')).toBeUndefined()
  })

  it('rejects late content from a source that is no longer selected', async () => {
    let finish!: (snapshot: SourceContentSnapshot) => void
    const get = vi.fn((source: string) =>
      source === 'arxiv'
        ? new Promise<SourceContentSnapshot>((resolve) => {
            finish = resolve
          })
        : Promise.resolve(cached('github'))
    )
    const h = nativeHarness({ getSourceContent: get })
    const screen = new SourcesScreen(h.context)
    const old = screen.activate('official:arxiv')
    await screen.activate('folo:10')
    finish({
      ...cached('arxiv'),
      items: [
        {
          id: 'arxiv:late',
          source: 'arxiv',
          title: 'Wrong late item',
          summary: '',
          url: 'https://arxiv.org',
          publishedAt: 'now',
          updatedAt: 'now',
          triageState: 'new',
          score: 1,
          reasons: []
        }
      ]
    })
    await old
    expect(JSON.stringify(h.render(screen))).not.toContain('Wrong late item')
  })
})

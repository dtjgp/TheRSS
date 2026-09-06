import { describe, expect, it, vi } from 'vitest'
import type { AnalysisArtifact } from '../../shared/models'
import { nativeHarness, nativeDiscoverFixture } from './testSupport'
import { DiscoverScreen } from './discover'
import { SavedScreen } from './saved'
import { SourcesScreen } from './sources'
import { SettingsScreen } from './settings'
import { ResearchReader, TriageHistory } from './reading'
import { NativeModals } from './modals'

const item = { ...nativeDiscoverFixture.items[0]!, triageState: 'saved' as const }
const analysis: AnalysisArtifact = {
  id: 'analysis-1',
  itemId: item.id,
  content: 'Stored result',
  providerId: 'fixture',
  providerName: 'Fixture',
  model: 'fixture',
  promptVersion: 'v1',
  sourceHash: 'hash',
  createdAt: 'now'
}

describe('native workflow branches', () => {
  it('filters Saved across all sources, opens context actions and keeps its own runner', async () => {
    const repository = {
      ...item,
      id: 'github:1',
      source: 'github' as const,
      kind: 'repository' as const,
      title: 'Repository'
    }
    const contextMenu = vi.fn(async () => ({ action: 'analyze' as const, itemId: repository.id }))
    const h = nativeHarness({
      analyzeItem: vi.fn(async () => analysis),
      showContextMenu: contextMenu
    })
    h.context.data.dashboard = { ...h.dashboard, savedItems: [item, repository] }
    const screen = new SavedScreen(h.context, new TriageHistory(h.context))
    await h.act(screen, 'saved-runner', 'codex')
    await h.act(screen, 'saved-source-filter', 'github')
    expect(h.find(h.render(screen), 'saved-items')?.rows?.map((row) => row.id)).toEqual([
      repository.id
    ])
    await h.act(screen, 'saved-items', repository.id)
    const table = h.find(h.render(screen), 'saved-items')!
    await h.context.presentation.dispatch(
      JSON.stringify({ action: table.context, value: repository.id })
    )
    expect(contextMenu).toHaveBeenCalledWith(
      expect.objectContaining({ canAnalyze: true, kind: 'saved-item' })
    )
    expect(h.api.analyzeItem).toHaveBeenCalledWith(repository.id, 'codex')
    await h.act(screen, 'saved-open')
    expect(h.context.openExternal).toHaveBeenCalledWith(repository.url)
    await h.act(screen, 'saved-source-filter', 'folo:302')
    expect(h.find(h.render(screen), 'saved-empty-message')?.text).toContain('No saved items')
    await h.act(screen, 'saved-source-filter', 'all')
    expect(h.find(h.render(screen), 'saved-items')?.rows).toHaveLength(2)
    screen.dispose()
  })

  it('preserves exact Discover-only transitions through save, unsave, save and Undo', async () => {
    const h = nativeHarness({
      saveDiscoverResult: vi.fn(async () => ({ ...h.dashboard, savedItems: [item] })),
      setTriageState: vi.fn(async () => h.dashboard)
    })
    const triage = new TriageHistory(h.context),
      original = { ...item, triageState: 'new' as const }
    await triage.change(original, 'saved', 'session-1')
    await triage.change(original, 'viewed', 'session-1')
    await triage.change(original, 'saved', 'session-1')
    await triage.undo()
    expect(h.api.setTriageState).toHaveBeenLastCalledWith(original.id, 'viewed')
    await triage.undo()
    expect(vi.mocked(h.api.setTriageState)).toHaveBeenCalledTimes(2)
  })

  it('retries stored analysis without a runner and retains failed Undo for retry', async () => {
    const get = vi.fn().mockRejectedValueOnce(new Error('read failure')).mockResolvedValue(analysis)
    const h = nativeHarness({
      getLatestAnalysis: get,
      setTriageState: vi.fn(async () => h.dashboard)
    })
    const triage = new TriageHistory(h.context),
      reader = new ResearchReader(h.context, 'saved', triage)
    reader.select(item)
    await Promise.resolve()
    await Promise.resolve()
    await h.act(reader, 'saved-retry-stored-analysis')
    expect(get).toHaveBeenCalledTimes(2)
    expect(h.find(h.render(reader), 'saved-analysis')?.text).toContain('Stored result')
    await h.act(reader, 'saved-promote')
    expect(h.context.promote).toHaveBeenCalledWith(item.id, undefined)
    await reader.dismiss()
    vi.mocked(h.api.setTriageState).mockRejectedValueOnce(new Error('undo failed'))
    await triage.undo()
    expect(triage.canUndo).toBe(true)
    await triage.undo()
    expect(triage.canUndo).toBe(false)
    reader.select(null)
    expect(JSON.stringify(h.render(reader))).toContain('Select an item')
    reader.dispose()
  })

  it('requires a query and selected sources and supports all source/filter controls', async () => {
    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => nativeDiscoverFixture) })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    await screen.load()
    await h.act(screen, 'discover-source-picker')
    await h.act(screen, 'discover-clear-sources')
    expect(h.find(h.render(screen), 'discover-search')?.enabled).toBe(false)
    await h.act(screen, 'discover-source-arxiv', true)
    expect(h.find(h.render(screen), 'discover-search')?.enabled).toBe(true)
    await h.act(screen, 'discover-source-arxiv', false)
    await h.act(screen, 'discover-all-sources')
    expect(h.find(h.render(screen), 'discover-source-picker')?.title).toBe('Sources (22/22)')
    await h.act(screen, 'discover-runner', 'codex')
    await h.act(screen, 'discover-kind', 'repository')
    expect(h.find(h.render(screen), 'discover-empty-message')?.text).toContain('No results')
    await h.act(screen, 'discover-kind', 'other')
    await h.act(screen, 'discover-kind', 'paper')
    await h.act(screen, 'discover-results', nativeDiscoverFixture.items[1]!.id)
    expect(h.find(h.render(screen), 'discover-reading-title')?.text).toBe('Paper 1')
    screen.dispose()
  })

  it('filters source priority, axis, attention and search text without fetching', async () => {
    const h = nativeHarness()
    h.context.data.dashboard = {
      ...h.dashboard,
      sourceHealth: { arxiv: 'failed', github: 'healthy' }
    }
    const screen = new SourcesScreen(h.context)
    await h.act(screen, 'sources-attention', true)
    expect(h.find(h.render(screen), 'sources-list')?.rows?.map((row) => row.id)).toEqual([
      'official:arxiv'
    ])
    await h.act(screen, 'sources-attention', false)
    await h.act(screen, 'sources-priority', 'A')
    await h.act(screen, 'sources-axis', 'MC')
    expect(h.find(h.render(screen), 'sources-list')?.rows?.length).toBeGreaterThan(0)
    await h.act(screen, 'sources-query', 'arxiv')
    expect(h.find(h.render(screen), 'sources-list')?.rows?.map((row) => row.id)).toEqual([
      'official:arxiv'
    ])
    await h.act(screen, 'sources-open-site')
    expect(h.context.openExternal).toHaveBeenCalledWith(expect.stringContaining('arxiv'))
    screen.dispose()
  })

  it('validates provider fields locally and supports failed loading and persistence retries', async () => {
    const get = vi.fn().mockRejectedValueOnce(new Error('database')).mockResolvedValue(null)
    const save = vi.fn().mockRejectedValueOnce(new Error('provider failure'))
    const h = nativeHarness({
      getModelProvider: get,
      saveModelProvider: save,
      testModelProvider: vi.fn().mockRejectedValue(new Error('test failed'))
    })
    const screen = new SettingsScreen(h.context)
    await screen.load()
    expect(JSON.stringify(h.render(screen))).toContain('Retry')
    await h.act(screen, 'settings-retry')
    await h.act(screen, 'settings-tab', 'provider')
    await h.act(screen, 'provider-save')
    expect(save).not.toHaveBeenCalled()
    await h.act(screen, 'provider-name', 'Fixture')
    await h.act(screen, 'provider-model', 'model')
    await h.act(screen, 'provider-url', 'file:///private/tmp/key')
    await h.act(screen, 'provider-test')
    expect(h.api.testModelProvider).not.toHaveBeenCalled()
    await h.act(screen, 'provider-url', 'https://fixture.invalid')
    await h.act(screen, 'provider-protocol', 'anthropic-compatible')
    await h.act(screen, 'provider-save')
    expect(JSON.stringify(h.render(screen))).toContain('rejected')
    await h.act(screen, 'provider-test')
    expect(JSON.stringify(h.render(screen))).toContain('could not be started')
    screen.dispose()
  })

  it('opens only a selected local result and retries local search errors', async () => {
    const search = vi
      .fn()
      .mockRejectedValueOnce(new Error('Index unavailable'))
      .mockResolvedValue({
        query: 'edge',
        results: [
          {
            id: 'result-1',
            itemId: item.id,
            kind: 'analysis',
            title: 'Stored analysis',
            detail: 'Longer local context',
            url: item.url,
            source: 'arxiv',
            createdAt: 'now'
          }
        ]
      })
    const h = nativeHarness({ searchLocal: search }),
      modal = new NativeModals(h.context)
    modal.openDocument('Help', 'Local help content')
    const screen = { render: () => modal.render()! }
    expect(h.find(h.render(screen), 'document-modal-content')?.text).toBe('Local help content')
    await h.act(screen, 'modal-close')
    modal.openSearch()
    await h.act(screen, 'local-search-query', 'edge')
    await h.act(screen, 'local-search-submit')
    expect(h.find(h.render(screen), 'modal-message')?.text).toContain('Index unavailable')
    await h.act(screen, 'local-search-submit')
    await h.act(screen, 'local-search-results', 'result-1')
    await h.act(screen, 'local-search-open')
    expect(h.context.openExternal).toHaveBeenCalledWith(item.url)
    await h.act(screen, 'modal-close')
    modal.dispose()
  })
})

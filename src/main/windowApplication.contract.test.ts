import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  WindowApplication,
  type ApplicationServices,
  type WindowContext
} from './windowApplication'

function fixture() {
  const dashboard = { marker: 'dashboard' }
  const item = 'arxiv:2609.00001',
    session = 'session-1',
    preview = 'a0000000-0000-4000-8000-000000000001'
  const snapshot = { id: session }
  const repository = {
    getDashboardSnapshot: vi.fn(() => dashboard),
    getSourceContentSnapshot: vi.fn(() => ({ source: 'arxiv' })),
    getInterestProfile: vi.fn(() => null),
    saveInterestProfile: vi.fn(),
    searchLocal: vi.fn(() => ({ results: [] })),
    getDiscoveryItem: vi.fn(),
    getDiscoverSnapshot: vi.fn(),
    getLatestDiscoverSnapshot: vi.fn(() => snapshot),
    getAnalyticsSnapshot: vi.fn(() => ({ totals: {} })),
    saveDiscoverResult: vi.fn(),
    setTriageState: vi.fn(),
    getDiscoverPersonalizationSettings: vi.fn(() => null),
    saveDiscoverPersonalizationPrompt: vi.fn((prompt) => ({ prompt })),
    materializeDiscoverResultForAnalysis: vi.fn(),
    getLatestAnalysis: vi.fn(() => null),
    materializeDiscoverResultForLlmWikiPromotion: vi.fn()
  }
  const provider = {
    getSummary: vi.fn(() => ({ name: 'Provider', hasCredential: true })),
    save: vi.fn((input) => ({ ...input, apiKey: undefined })),
    getConnectionTestProfile: vi.fn((input) => input),
    clearCredential: vi.fn(() => ({ hasCredential: false }))
  }
  const discovery = {
    refreshSourceContent: vi.fn(async () => ({ source: 'arxiv' })),
    refresh: vi.fn(async () => dashboard)
  }
  const discover = { search: vi.fn(async () => snapshot), retry: vi.fn(async () => snapshot) }
  const analysis = {
    analyzeItem: vi.fn(async (itemId) => ({ itemId, content: 'Analysis' })),
    getAnalysisArtifact: vi.fn(() => ({ freshness: 'current' }))
  }
  const agents = { getStatuses: vi.fn(async () => [{ runner: 'codex', available: true }]) }
  const promotion = {
    preview: vi.fn(async () => ({ previewId: preview })),
    confirm: vi.fn(async () => ({ status: 'completed' })),
    cancel: vi.fn(async () => ({ status: 'skipped' })),
    getLatest: vi.fn(() => null),
    disposeOwner: vi.fn(async () => undefined)
  }
  const context: WindowContext = {
    ownerId: 'window-owner',
    isAvailable: vi.fn(() => true),
    setDirty: vi.fn(),
    confirmDiscard: vi.fn(async () => true),
    confirmPromotion: vi.fn(async () => true),
    accent: () => 'blue',
    contextMenu: vi.fn(async () => ({ action: 'none' as const }))
  }
  const services = {
    repository,
    provider,
    discovery,
    discover,
    analysis,
    agents,
    promotion,
    credentials: vi.fn(() => ({ githubToken: 'fixture-token', huggingFaceToken: 'fixture-hf' })),
    testProvider: vi.fn(async () => ({ status: 'connected' }))
  } as unknown as ApplicationServices
  const app = new WindowApplication(services, context)
  return {
    app,
    api: app.api,
    services,
    context,
    repository,
    provider,
    discovery,
    discover,
    analysis,
    agents,
    promotion,
    item,
    session,
    preview
  }
}

describe('shared application contract parity', () => {
  it('resolves exact local targets read-only, rejects foreign fields and preserves missing outcomes', async () => {
    const f = fixture()
    f.repository.getDiscoveryItem.mockReturnValue({ id: f.item, triageState: 'saved' })
    expect(await f.api.getLocalResearch({ kind: 'saved', itemId: f.item })).toEqual({
      kind: 'saved',
      item: { id: f.item, triageState: 'saved' }
    })
    f.repository.getDiscoveryItem.mockReturnValue({ id: f.item, triageState: 'viewed' })
    expect(await f.api.getLocalResearch({ kind: 'saved', itemId: f.item })).toBeNull()
    const historical = { id: 'older-session', items: [{ id: f.item }] }
    f.repository.getDiscoverSnapshot.mockReturnValue(historical)
    expect(
      await f.api.getLocalResearch({ kind: 'discover', sessionId: 'older-session', itemId: f.item })
    ).toEqual({ kind: 'discover', snapshot: historical, itemId: f.item })
    expect(f.repository.getDiscoverSnapshot).toHaveBeenCalledWith('older-session')
    expect(
      await f.api.getLocalResearch({
        kind: 'discover',
        sessionId: 'older-session',
        itemId: 'missing'
      })
    ).toBeNull()
    await expect(
      f.api.getLocalResearch({
        kind: 'saved',
        itemId: '',
        url: 'https://untrusted.invalid'
      } as never)
    ).rejects.toThrow()
    expect(f.repository.setTriageState).not.toHaveBeenCalled()
    expect(f.discover.search).not.toHaveBeenCalled()
    await f.app.shutdown()
  })
  it('uses the same repository and credentials for source reads, refresh, interests and local search', async () => {
    const f = fixture(),
      api = f.api
    expect(await api.getSystemAccent()).toBe('blue')
    expect(await api.getDashboard()).toEqual({ marker: 'dashboard' })
    await api.getSourceContent('arxiv')
    await api.refreshSourceContent('arxiv')
    await api.refresh()
    expect(f.discovery.refreshSourceContent).toHaveBeenCalledWith('arxiv', {
      githubToken: 'fixture-token',
      huggingFaceToken: 'fixture-hf'
    })
    expect(f.discovery.refresh).toHaveBeenCalledWith({
      githubToken: 'fixture-token',
      huggingFaceToken: 'fixture-hf'
    })
    expect(await api.getInterestProfile()).toBeNull()
    const profile = {
      name: 'Research',
      arxiv: { categories: ['cs.LG'], keywords: [' Edge '], excludeKeywords: [] },
      github: { keywords: [], topics: [], languages: [] }
    }
    await api.saveInterestProfile(profile)
    expect(f.repository.saveInterestProfile).toHaveBeenCalledWith(
      expect.objectContaining({ arxiv: expect.objectContaining({ keywords: ['edge'] }) })
    )
    await api.searchLocal('  edge  ')
    expect(f.repository.searchLocal).toHaveBeenCalledWith('edge')
    await expect(api.searchLocal('a')).rejects.toThrow()
    await expect(api.refreshSourceContent('unknown' as 'arxiv')).rejects.toThrow()
    await f.app.shutdown()
  })

  it('shares provider validation, protects summaries and tests unsaved drafts without storing them', async () => {
    const f = fixture(),
      api = f.api
    const draft = {
      name: 'Provider',
      protocol: 'openai-compatible' as const,
      baseUrl: 'https://fixture.invalid',
      model: 'fixture',
      apiKey: randomUUID()
    }
    expect(await api.getModelProvider()).not.toHaveProperty('apiKey')
    await api.testModelProvider(draft)
    expect(f.provider.getConnectionTestProfile).toHaveBeenCalledWith(draft)
    expect(f.provider.save).not.toHaveBeenCalled()
    await api.saveModelProvider(draft)
    await api.clearModelProviderCredential()
    expect(f.provider.save).toHaveBeenCalledWith(draft)
    expect(f.provider.clearCredential).toHaveBeenCalledOnce()
    expect(await api.getDiscoverPersonalizationSettings()).toBeNull()
    await api.saveDiscoverPersonalizationPrompt('  Focus on edge AI  ')
    expect(f.repository.saveDiscoverPersonalizationPrompt).toHaveBeenCalledWith('Focus on edge AI')
    await expect(api.saveDiscoverPersonalizationPrompt('bad\u0000')).rejects.toThrow()
    expect(await api.getLocalAgentStatuses()).toEqual([{ runner: 'codex', available: true }])
    await f.app.shutdown()
  })

  it('materializes Discover records with the correct purpose and owner before analysis or promotion', async () => {
    const f = fixture(),
      api = f.api
    await api.getLatestDiscover()
    await api.getAnalytics()
    await api.saveDiscoverResult(f.session, f.item)
    expect(f.repository.saveDiscoverResult).toHaveBeenCalledWith(f.session, f.item)
    await api.analyzeItem(f.item, 'claude')
    expect(f.analysis.analyzeItem).toHaveBeenLastCalledWith(f.item, { runner: 'claude' })
    await api.analyzeDiscoverResult(f.session, f.item, 'codex')
    expect(f.repository.materializeDiscoverResultForAnalysis).toHaveBeenCalledWith(
      f.session,
      f.item
    )
    expect(f.analysis.analyzeItem).toHaveBeenLastCalledWith(f.item, { runner: 'codex' })
    await api.getLatestAnalysis(f.item)
    await api.getAnalysisArtifact('analysis-1')
    expect(f.analysis.getAnalysisArtifact).toHaveBeenCalledWith('analysis-1')
    await api.previewLlmWikiPromotion(f.item, f.session)
    expect(f.repository.materializeDiscoverResultForLlmWikiPromotion).toHaveBeenCalledWith(
      f.session,
      f.item
    )
    expect(f.promotion.preview).toHaveBeenCalledWith(f.item, 'window-owner')
    await api.confirmLlmWikiPromotion(f.preview)
    expect(f.context.confirmPromotion).toHaveBeenCalledOnce()
    expect(f.promotion.confirm).toHaveBeenCalledWith(f.preview, 'window-owner')
    await api.cancelLlmWikiPromotion(f.preview)
    await api.getLatestLlmWikiPromotion(f.item)
    expect(f.promotion.cancel).toHaveBeenCalledWith(f.preview, 'window-owner')
    await expect(api.analyzeDiscoverResult(f.session, '', 'codex')).rejects.toThrow()
    await f.app.shutdown()
    expect(f.promotion.disposeOwner).toHaveBeenCalledWith('window-owner')
  })

  it('allows retry only for the current persisted session and scopes subscriptions to a live window', async () => {
    const f = fixture(),
      api = f.api
    await expect(api.retryDiscover('old', ['arxiv'], 'run-1')).rejects.toThrow('latest')
    await api.retryDiscover(f.session, ['arxiv'], 'run-1')
    expect(f.discover.retry).toHaveBeenCalledWith(
      { id: f.session },
      ['arxiv'],
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    const commands = vi.fn(),
      accents = vi.fn()
    const offCommand = api.onAppCommand(commands),
      offAccent = api.onSystemAccentChange(accents)
    f.app.command('show-saved')
    f.app.accentChanged('red')
    expect(commands).toHaveBeenCalledWith('show-saved')
    expect(accents).toHaveBeenCalledWith('red')
    offCommand()
    offAccent()
    f.app.command('show-discover')
    f.app.accentChanged(null)
    expect(commands).toHaveBeenCalledOnce()
    expect(accents).toHaveBeenCalledOnce()
    expect(await api.confirmDiscardSettings()).toBe(true)
    expect(f.context.confirmDiscard).not.toHaveBeenCalled()
    api.setSettingsDirty('bad' as unknown as boolean)
    expect(f.context.setDirty).not.toHaveBeenCalled()
    await api.showContextMenu({
      kind: 'saved-item',
      itemId: f.item,
      title: 'Paper',
      url: 'https://arxiv.org',
      sourceLabel: 'arXiv',
      publishedAt: 'now',
      isSaved: true,
      canAnalyze: true,
      canPromote: true
    })
    expect(f.context.contextMenu).toHaveBeenCalledOnce()
    await f.app.shutdown()
    api.onAppCommand(commands)
    f.app.command('show-saved')
    api.setSettingsDirty(true)
    expect(commands).toHaveBeenCalledOnce()
    expect(f.context.setDirty).not.toHaveBeenCalled()
  })
})

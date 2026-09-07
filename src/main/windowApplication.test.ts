import { describe, expect, it, vi } from 'vitest'
import {
  WindowApplication,
  type ApplicationServices,
  type WindowContext
} from './windowApplication'

function harness() {
  const context: WindowContext = {
    ownerId: 'window-7',
    isAvailable: () => true,
    setDirty: vi.fn(),
    confirmDiscard: vi.fn(async () => true),
    confirmPromotion: vi.fn(async () => true),
    contextMenu: vi.fn(async () => ({ action: 'none' as const })),
    accent: () => null
  }
  const services = {
    repository: {
      getDashboardSnapshot: vi.fn(() => ({ date: 'fixture' })),
      setTriageState: vi.fn(),
      getLatestDiscoverSnapshot: vi.fn(() => null),
      getSavedSourceUpdate: vi.fn(() => null),
      applySavedSourceUpdate: vi.fn(() => 'unchanged'),
      getDiscoveryItem: vi.fn(() => null)
    },
    discover: { search: vi.fn(), retry: vi.fn() },
    promotion: {
      preview: vi.fn(),
      confirm: vi.fn(),
      cancel: vi.fn(),
      getLatest: vi.fn(),
      disposeOwner: vi.fn(async () => undefined)
    }
  } as unknown as ApplicationServices
  return { context, services, application: new WindowApplication(services, context) }
}

describe('window-bound application service', () => {
  it('validates native and compatibility requests at the same boundary', async () => {
    const { application, services } = harness()
    await expect(application.api.setTriageState('', 'saved')).rejects.toThrow()
    expect(services.repository.setTriageState).not.toHaveBeenCalled()
    await application.api.setTriageState('paper-1', 'saved')
    expect(services.repository.setTriageState).toHaveBeenCalledWith('paper-1', 'saved')
    await expect(application.api.getSourceContent('unknown' as 'arxiv')).rejects.toThrow()
  })

  it('validates Saved snapshot update identities and hashes before any mutation', async () => {
    const { application, services } = harness()
    await expect(application.api.getSavedSourceUpdate('')).rejects.toThrow()
    await expect(
      application.api.applySavedSourceUpdate({
        itemId: 'item-1',
        sessionId: 'new',
        expectedSourceHash: 'invalid',
        sourceHash: 'b'.repeat(64)
      })
    ).rejects.toThrow()
    expect(services.repository.applySavedSourceUpdate).not.toHaveBeenCalled()
    const request = {
      itemId: 'item-1',
      sessionId: 'new',
      expectedSourceHash: 'a'.repeat(64),
      sourceHash: 'b'.repeat(64)
    }
    expect(await application.api.applySavedSourceUpdate(request)).toEqual({
      status: 'unchanged',
      item: null,
      dashboard: { date: 'fixture' }
    })
    expect(services.repository.applySavedSourceUpdate).toHaveBeenCalledWith(request)
  })

  it('binds promotions to the calling window and respects final cancellation', async () => {
    const { application, services, context } = harness()
    await application.api.previewLlmWikiPromotion('paper-1')
    expect(services.promotion.preview).toHaveBeenCalledWith('paper-1', 'window-7')
    vi.mocked(context.confirmPromotion).mockResolvedValue(false)
    await application.api.confirmLlmWikiPromotion('a0000000-0000-4000-8000-000000000001')
    expect(services.promotion.cancel).toHaveBeenCalledWith(
      'a0000000-0000-4000-8000-000000000001',
      'window-7'
    )
    expect(services.promotion.confirm).not.toHaveBeenCalled()
  })

  it('owns cancellation, progress and one active Discover run per window', async () => {
    const { application, services } = harness()
    let complete!: (value: never) => void
    vi.mocked(services.discover.search).mockImplementation((_request, options) => {
      options?.onProgress?.({ stage: 'planning', message: 'Planning' } as never)
      return new Promise((resolve) => {
        complete = resolve
      })
    })
    const progress = vi.fn()
    const unsubscribe = application.api.onDiscoverProgress(progress)
    const running = application.api.searchDiscover(
      { intent: 'edge intelligence', sources: ['arxiv'], runner: 'model-provider' },
      'run-1'
    )
    await expect(
      application.api.searchDiscover(
        { intent: 'edge intelligence', sources: ['arxiv'], runner: 'model-provider' },
        'run-2'
      )
    ).rejects.toThrow('already active')
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ runId: 'run-1' }))
    expect(await application.api.cancelDiscover('different')).toEqual({
      runId: 'different',
      canceled: false
    })
    expect(await application.api.cancelDiscover('run-1')).toEqual({
      runId: 'run-1',
      canceled: true
    })
    expect(vi.mocked(services.discover.search).mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    complete(null as never)
    await running
    unsubscribe()
  })

  it('drains already accepted work before shutdown and rejects new work', async () => {
    const { application, services } = harness()
    let finish!: () => void
    vi.mocked(services.promotion.preview).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(null as never)
        })
    )
    const work = application.api.previewLlmWikiPromotion('paper-1')
    const drained = vi.fn()
    const shutdown = application.shutdown().then(drained)
    await expect(application.api.getDashboard()).rejects.toThrow('closed')
    expect(drained).not.toHaveBeenCalled()
    finish()
    await work
    await shutdown
    expect(drained).toHaveBeenCalledOnce()
  })

  it('tracks the last native keystroke synchronously and preserves canceled drafts', async () => {
    const { application, context } = harness()
    application.api.setSettingsDirty(true)
    expect(context.setDirty).toHaveBeenLastCalledWith(true)
    vi.mocked(context.confirmDiscard).mockResolvedValue(false)
    expect(await application.api.confirmDiscardSettings()).toBe(false)
    expect(context.setDirty).toHaveBeenLastCalledWith(true)
    vi.mocked(context.confirmDiscard).mockResolvedValue(true)
    expect(await application.api.confirmDiscardSettings()).toBe(true)
    expect(context.setDirty).toHaveBeenLastCalledWith(false)
  })
})

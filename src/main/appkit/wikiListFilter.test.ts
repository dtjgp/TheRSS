import { describe, expect, it, vi } from 'vitest'
import type { DiscoverResultItem, DiscoverSnapshot } from '../../shared/discover'
import type {
  LlmWikiBatchStatusRequest,
  LlmWikiBatchStatusResponse,
  LlmWikiLibraryStatus
} from '../../shared/llmWikiLibrary'
import { DiscoverScreen } from './discover'
import { SavedScreen } from './saved'
import { NativePresenter } from './presenter'
import { defaultNativePreferences } from './preferences'
import { TriageHistory } from './reading'
import { nativeDiscoverFixture, nativeHarness } from './testSupport'

function wikiStatus(
  arxivId: string,
  overrides: Partial<LlmWikiLibraryStatus> = {}
): LlmWikiLibraryStatus {
  return {
    arxivId,
    status: 'not-found',
    checkedAt: '2026-11-21T10:00:00.000Z',
    recordPath: null,
    notePath: null,
    level: null,
    readStatus: null,
    reason: null,
    ...overrides
  }
}

function makePaper(
  id: string,
  arxivId: string,
  title: string,
  overrides: Partial<DiscoverResultItem> = {}
): DiscoverResultItem {
  return {
    ...nativeDiscoverFixture.items[0]!,
    id,
    source: 'arxiv',
    kind: 'paper',
    externalId: arxivId,
    title,
    url: `https://arxiv.org/abs/${arxivId}`,
    publishedAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
    ...overrides
  }
}

function makeRepo(id: string, title: string): DiscoverResultItem {
  return {
    ...nativeDiscoverFixture.items[0]!,
    id,
    source: 'github',
    kind: 'repository',
    externalId: id,
    title,
    url: `https://github.com/example/${id}`,
    publishedAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z'
  }
}

function discoverSnapshotWithPapers(): DiscoverSnapshot {
  const items: DiscoverResultItem[] = [
    makePaper('arxiv:l1', '2611.00001v1', 'Deep L1 Paper', { saved: true }),
    makePaper('arxiv:rec', '2611.00002', 'Record Only Paper'),
    makePaper('arxiv:new', '2611.00003', 'Uncollected Paper'),
    makePaper('arxiv:missing', '2611.00004', 'Missing Note Paper'),
    makeRepo('gh:1', 'Compression Toolkit')
  ]
  return {
    ...nativeDiscoverFixture,
    items,
    counts: {
      ...nativeDiscoverFixture.counts,
      total: items.length,
      arxiv: 4,
      github: 1,
      byKind: { paper: 4, repository: 1, article: 0, model: 0, dataset: 0, post: 0 }
    }
  }
}

function batchResponse(statuses: readonly LlmWikiLibraryStatus[]): LlmWikiBatchStatusResponse {
  return {
    checkedAt: '2026-11-21T10:00:00.000Z',
    statuses: Object.fromEntries(statuses.map((entry) => [entry.arxivId, entry]))
  }
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('AppKit I5 list-level llm-wiki badges and filters', () => {
  it('fetches batch statuses once per Discover list, appends truthful badges, and preserves row glyphs/drag', async () => {
    let resolveBatch!: (value: LlmWikiBatchStatusResponse) => void
    const getLlmWikiStatuses = vi.fn(
      (_request: LlmWikiBatchStatusRequest) =>
        new Promise<LlmWikiBatchStatusResponse>((resolve) => {
          resolveBatch = resolve
        })
    )
    const searchDiscover = vi.fn()
    const h = nativeHarness({
      getLatestDiscover: vi.fn(async () => discoverSnapshotWithPapers()),
      getLlmWikiStatuses,
      searchDiscover
    })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()

    // First render kicks off ONE batch request for the 4 unique arXiv papers (ignoring GitHub repo).
    const pendingScene = h.render(screen)
    const pendingRows = h.find(pendingScene, 'discover-results')?.rows ?? []
    expect(getLlmWikiStatuses).toHaveBeenCalledTimes(1)
    expect(getLlmWikiStatuses).toHaveBeenCalledWith({
      arxivIds: ['2611.00001', '2611.00002', '2611.00003', '2611.00004'],
      refresh: false
    })
    expect(pendingRows[0]?.subtitle).toContain('llm-wiki: Pending')
    expect(pendingRows[4]?.subtitle).not.toContain('llm-wiki')

    // Re-rendering while in flight does not fire duplicate batch calls.
    h.render(screen)
    expect(getLlmWikiStatuses).toHaveBeenCalledTimes(1)

    resolveBatch(
      batchResponse([
        wikiStatus('2611.00001', {
          status: 'recorded',
          recordPath: 'raw/paper_records/2611.00001.md',
          notePath: 'Literature/Paper_Notes/L1_Deep_Read/2611.00001.md',
          level: 'L1'
        }),
        wikiStatus('2611.00002', {
          status: 'recorded',
          recordPath: 'raw/paper_records/2611.00002.md'
        }),
        wikiStatus('2611.00003', { status: 'not-found' }),
        wikiStatus('2611.00004', { status: 'note-missing', reason: 'Missing linked note' })
      ])
    )
    await flushMicrotasks()

    const loadedScene = h.render(screen)
    const rows = h.find(loadedScene, 'discover-results')?.rows ?? []
    expect(rows[0]).toMatchObject({
      id: 'arxiv:l1',
      saved: true,
      symbol: 'doc.text',
      symbolLabel: 'Paper',
      drag: expect.objectContaining({ url: 'https://arxiv.org/abs/2611.00001v1' })
    })
    expect(rows[0]?.subtitle).toContain('In llm-wiki · L1')
    expect(rows[1]?.subtitle).toContain('In llm-wiki · Record only')
    expect(rows[2]?.subtitle).not.toContain('llm-wiki')
    expect(rows[3]?.subtitle).toContain('llm-wiki · Note missing')
    expect(rows[4]?.subtitle).not.toContain('llm-wiki')

    // Filter locally with discover-wiki-filter without triggering extra API calls.
    const wikiFilter = h.find(loadedScene, 'discover-wiki-filter')
    expect(wikiFilter).toMatchObject({ kind: 'select', selected: 'all' })
    expect(wikiFilter?.options).toEqual([
      { id: 'all', title: 'All llm-wiki' },
      { id: 'collected', title: 'In llm-wiki' },
      { id: 'uncollected', title: 'Not in llm-wiki' }
    ])

    await h.act(screen, 'discover-wiki-filter', 'collected')
    expect(h.find(h.render(screen), 'discover-results')?.rows?.map((r) => r.id)).toEqual([
      'arxiv:l1',
      'arxiv:rec'
    ])

    await h.act(screen, 'discover-wiki-filter', 'uncollected')
    expect(h.find(h.render(screen), 'discover-results')?.rows?.map((r) => r.id)).toEqual([
      'arxiv:new',
      'arxiv:missing',
      'gh:1'
    ])

    expect(getLlmWikiStatuses).toHaveBeenCalledTimes(1)
    expect(searchDiscover).not.toHaveBeenCalled()
    screen.dispose()
  })

  it('recovers empty wiki filter with Show all results, checkpoints openLocal, and refreshes single paper on llmWikiChanged', async () => {
    const getLlmWikiStatuses = vi
      .fn<(request: LlmWikiBatchStatusRequest) => Promise<LlmWikiBatchStatusResponse>>()
      .mockResolvedValueOnce(
        batchResponse([
          wikiStatus('2611.00001', { status: 'not-found' }),
          wikiStatus('2611.00002', { status: 'not-found' }),
          wikiStatus('2611.00003', { status: 'not-found' }),
          wikiStatus('2611.00004', { status: 'not-found' })
        ])
      )
      .mockResolvedValueOnce(
        batchResponse([
          wikiStatus('2611.00003', {
            status: 'recorded',
            recordPath: 'raw/paper_records/2611.00003.md',
            notePath: 'Literature/Paper_Notes/L2_Structured/2611.00003.md',
            level: 'L2'
          })
        ])
      )

    const snapshot = discoverSnapshotWithPapers()
    const h = nativeHarness({
      getLatestDiscover: vi.fn(async () => snapshot),
      getLlmWikiStatuses
    })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    h.render(screen)
    await flushMicrotasks()

    const initialStatus = h.find(h.render(screen), 'discover-result-status')?.text

    // All papers are uncollected -> filtering to In llm-wiki yields recoverable empty state.
    await h.act(screen, 'discover-wiki-filter', 'collected')
    const empty = h.render(screen)
    expect(h.find(empty, 'discover-results')).toBeUndefined()
    expect(h.find(empty, 'discover-empty-title')?.text).toContain('llm-wiki')
    expect(h.find(empty, 'discover-show-all')?.title).toBe('Show all results')
    expect(h.find(empty, 'discover-result-status')?.text).toBe(initialStatus)

    // openLocal resets wikiFilter so historical target is visible, and restore brings it back.
    const historical: DiscoverSnapshot = {
      ...snapshot,
      id: 'historical',
      items: [makePaper('arxiv:hist', '2611.00003', 'Historical Paper')]
    }
    const restore = screen.openLocal(historical, 'arxiv:hist')
    const opened = h.render(screen)
    expect(h.find(opened, 'discover-results')?.selected).toBe('arxiv:hist')
    expect(h.find(opened, 'discover-wiki-filter')?.selected).toBe('all')
    restore()
    expect(h.find(h.render(screen), 'discover-wiki-filter')?.selected).toBe('collected')

    // Show all results resets wikiFilter to 'all'.
    await h.act(screen, 'discover-show-all')
    expect(h.find(h.render(screen), 'discover-wiki-filter')?.selected).toBe('all')
    expect(h.find(h.render(screen), 'discover-results')?.rows).toHaveLength(5)

    // Promoting a paper triggers llmWikiChanged -> single refreshOne with refresh: true.
    screen.llmWikiChanged('2611.00003')
    await flushMicrotasks()
    expect(getLlmWikiStatuses).toHaveBeenLastCalledWith({
      arxivIds: ['2611.00003'],
      refresh: true
    })
    const updatedRow = h
      .find(h.render(screen), 'discover-results')
      ?.rows?.find((row) => row.id === 'arxiv:new')
    expect(updatedRow?.subtitle).toContain('In llm-wiki · L2')
    screen.dispose()
  })

  it('shows unavailable badges on batch error without looping on redraw', async () => {
    const getLlmWikiStatuses = vi.fn(async () => {
      throw new Error('Vault unreadable')
    })
    const h = nativeHarness({
      getLatestDiscover: vi.fn(async () => discoverSnapshotWithPapers()),
      getLlmWikiStatuses
    })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    h.render(screen)
    await flushMicrotasks()

    const failedScene = h.render(screen)
    expect(h.find(failedScene, 'discover-results')?.rows?.[0]?.subtitle).toContain(
      'llm-wiki · Unavailable'
    )
    // Additional redraws do not keep retrying the failed batch.
    h.render(screen)
    expect(getLlmWikiStatuses).toHaveBeenCalledTimes(1)
    screen.dispose()
  })

  it('supports badges, saved-wiki-filter, empty reset, openLocal checkpoint, and refresh in SavedScreen', async () => {
    const getLlmWikiStatuses = vi
      .fn<(request: LlmWikiBatchStatusRequest) => Promise<LlmWikiBatchStatusResponse>>()
      .mockResolvedValueOnce(
        batchResponse([
          wikiStatus('2611.00010', {
            status: 'recorded',
            recordPath: 'raw/paper_records/2611.00010.md',
            notePath: 'Literature/Paper_Notes/L2_Structured/2611.00010.md',
            level: 'L2'
          }),
          wikiStatus('2611.00011', { status: 'not-found' })
        ])
      )
      .mockResolvedValueOnce(
        batchResponse([
          wikiStatus('2611.00011', {
            status: 'recorded',
            recordPath: 'raw/paper_records/2611.00011.md'
          })
        ])
      )

    const h = nativeHarness({ getLlmWikiStatuses })
    const savedPaperInWiki = {
      ...makePaper('saved:1', '2611.00010', 'Saved L2 Paper'),
      triageState: 'saved' as const
    }
    const savedPaperNotInWiki = {
      ...makePaper('saved:2', '2611.00011', 'Saved Uncollected Paper'),
      triageState: 'saved' as const
    }
    h.context.data.dashboard = {
      ...h.dashboard,
      savedItems: [savedPaperInWiki, savedPaperNotInWiki]
    }

    const screen = new SavedScreen(h.context, new TriageHistory(h.context))
    h.render(screen)
    await flushMicrotasks()

    const scene = h.render(screen)
    expect(h.find(scene, 'saved-wiki-filter')).toMatchObject({ kind: 'select', selected: 'all' })
    expect(h.find(scene, 'saved-items')?.rows?.[0]?.subtitle).toContain('In llm-wiki · L2')
    expect(h.find(scene, 'saved-items')?.rows?.[1]?.subtitle).not.toContain('llm-wiki')

    await h.act(screen, 'saved-wiki-filter', 'collected')
    expect(h.find(h.render(screen), 'saved-items')?.rows?.map((r) => r.id)).toEqual(['saved:1'])

    // openLocal resets wikiFilter so an uncollected saved item opens cleanly, then restores it.
    const restore = screen.openLocal(savedPaperNotInWiki)
    expect(h.find(h.render(screen), 'saved-items')?.selected).toBe('saved:2')
    restore()
    expect(h.find(h.render(screen), 'saved-wiki-filter')?.selected).toBe('collected')

    // Combining source + wiki filter to empty state recovers both via saved-reset-filter.
    await h.act(screen, 'saved-source-filter', 'github')
    expect(h.find(h.render(screen), 'saved-items')).toBeUndefined()
    await h.act(screen, 'saved-reset-filter')
    const reset = h.render(screen)
    expect(h.find(reset, 'saved-source-filter')?.selected).toBe('all')
    expect(h.find(reset, 'saved-wiki-filter')?.selected).toBe('all')
    expect(h.find(reset, 'saved-items')?.rows).toHaveLength(2)

    // llmWikiChanged refreshes single saved paper.
    screen.llmWikiChanged('2611.00011')
    await flushMicrotasks()
    expect(h.find(h.render(screen), 'saved-items')?.rows?.[1]?.subtitle).toContain(
      'In llm-wiki · Record only'
    )
    screen.dispose()
  })

  it('invalidates Discover list llm-wiki cache when NativePresenter.settingsChanged() runs', async () => {
    const getLlmWikiStatuses = vi
      .fn<(request: LlmWikiBatchStatusRequest) => Promise<LlmWikiBatchStatusResponse>>()
      .mockResolvedValueOnce(
        batchResponse([
          wikiStatus('2611.00001', { status: 'not-found' }),
          wikiStatus('2611.00002', { status: 'not-found' }),
          wikiStatus('2611.00003', { status: 'not-found' }),
          wikiStatus('2611.00004', { status: 'not-found' })
        ])
      )
      .mockResolvedValueOnce(
        batchResponse([
          wikiStatus('2611.00001', {
            status: 'recorded',
            recordPath: 'raw/paper_records/2611.00001.md',
            notePath: 'Literature/Paper_Notes/L1_Deep_Read/2611.00001.md',
            level: 'L1'
          }),
          wikiStatus('2611.00002', { status: 'not-found' }),
          wikiStatus('2611.00003', { status: 'not-found' }),
          wikiStatus('2611.00004', { status: 'not-found' })
        ])
      )
    const h = nativeHarness({
      getLocalAgentStatuses: vi.fn(async () => h.context.data.agents),
      getLatestDiscover: vi.fn(async () => discoverSnapshotWithPapers()),
      getLlmWikiStatuses
    })
    let json = ''
    const presenter = new NativePresenter(h.api, {
      preferences: { ...defaultNativePreferences },
      present: (scene) => {
        json = scene
      },
      persist: vi.fn(async () => undefined),
      openExternal: vi.fn()
    })
    try {
      await presenter.start()
      await flushMicrotasks()
      expect(h.find(JSON.parse(json).root, 'discover-results')?.rows?.[0]?.subtitle).not.toContain(
        'In llm-wiki'
      )

      await presenter.settingsChanged()
      await flushMicrotasks()

      expect(getLlmWikiStatuses).toHaveBeenCalledTimes(2)
      expect(getLlmWikiStatuses).toHaveBeenLastCalledWith({
        arxivIds: ['2611.00001', '2611.00002', '2611.00003', '2611.00004'],
        refresh: true
      })
      expect(h.find(JSON.parse(json).root, 'discover-results')?.rows?.[0]?.subtitle).toContain(
        'In llm-wiki · L1'
      )

      // General Settings saves (personal/provider) do not force unnecessary vault rescans.
      await presenter.settingsChanged('general')
      await flushMicrotasks()
      expect(getLlmWikiStatuses).toHaveBeenCalledTimes(2)

      // Wiki Settings changes invalidate the list cache even if provider/agent reloads would fail.
      await presenter.settingsChanged('wiki')
      await flushMicrotasks()
      expect(getLlmWikiStatuses).toHaveBeenCalledTimes(3)
    } finally {
      presenter.dispose()
    }
  })

  it('distinguishes pending and unavailable empty states under In llm-wiki filter in Discover and Saved', async () => {
    let releaseDiscover = () => {}
    const pendingBatch = new Promise<LlmWikiBatchStatusResponse>((resolve) => {
      releaseDiscover = () =>
        resolve(batchResponse([wikiStatus('2611.00001', { status: 'not-found' })]))
    })
    const discoverHarness = nativeHarness({
      getLatestDiscover: vi.fn(async () => discoverSnapshotWithPapers()),
      getLlmWikiStatuses: vi.fn(() => pendingBatch)
    })
    const discover = new DiscoverScreen(
      discoverHarness.context,
      new TriageHistory(discoverHarness.context)
    )
    await discover.load()
    discoverHarness.render(discover)
    await discoverHarness.act(discover, 'discover-wiki-filter', 'collected')
    const discoverPending = discoverHarness.render(discover)
    expect(discoverHarness.find(discoverPending, 'discover-empty-title')?.text).toBe(
      'Checking llm-wiki…'
    )
    expect(discoverHarness.find(discoverPending, 'discover-show-all')).toBeDefined()
    releaseDiscover()
    discover.dispose()

    const unavailableDiscoverHarness = nativeHarness({
      getLatestDiscover: vi.fn(async () => discoverSnapshotWithPapers()),
      getLlmWikiStatuses: vi.fn(async () => {
        throw new Error('vault unreadable')
      })
    })
    const unavailableDiscover = new DiscoverScreen(
      unavailableDiscoverHarness.context,
      new TriageHistory(unavailableDiscoverHarness.context)
    )
    await unavailableDiscover.load()
    unavailableDiscoverHarness.render(unavailableDiscover)
    await flushMicrotasks()
    await unavailableDiscoverHarness.act(unavailableDiscover, 'discover-wiki-filter', 'collected')
    const discoverUnavailable = unavailableDiscoverHarness.render(unavailableDiscover)
    expect(unavailableDiscoverHarness.find(discoverUnavailable, 'discover-empty-title')?.text).toBe(
      'llm-wiki is unavailable'
    )
    expect(unavailableDiscoverHarness.find(discoverUnavailable, 'discover-show-all')).toBeDefined()
    unavailableDiscover.dispose()

    const savedPaper = {
      id: 'saved:1',
      source: 'arxiv' as const,
      kind: 'paper' as const,
      title: 'Saved Paper',
      summary: 'Summary.',
      url: 'https://arxiv.org/abs/2611.00010',
      publishedAt: '2026-11-18T10:00:00.000Z',
      score: 90,
      triageState: 'saved' as const,
      reasons: ['match']
    }
    let releaseSaved = () => {}
    const pendingSavedBatch = new Promise<LlmWikiBatchStatusResponse>((resolve) => {
      releaseSaved = () =>
        resolve(batchResponse([wikiStatus('2611.00010', { status: 'not-found' })]))
    })
    const savedPendingHarness = nativeHarness({
      getLlmWikiStatuses: vi.fn(() => pendingSavedBatch)
    })
    savedPendingHarness.context.data.dashboard = {
      ...savedPendingHarness.context.data.dashboard!,
      savedItems: [savedPaper]
    }
    const savedPending = new SavedScreen(
      savedPendingHarness.context,
      new TriageHistory(savedPendingHarness.context)
    )
    savedPendingHarness.render(savedPending)
    await savedPendingHarness.act(savedPending, 'saved-wiki-filter', 'collected')
    expect(
      savedPendingHarness.find(savedPendingHarness.render(savedPending), 'saved-empty-title')?.text
    ).toBe('Checking llm-wiki…')
    releaseSaved()
    savedPending.dispose()

    const savedUnavailableHarness = nativeHarness({
      getLlmWikiStatuses: vi.fn(async () => {
        throw new Error('vault missing')
      })
    })
    savedUnavailableHarness.context.data.dashboard = {
      ...savedUnavailableHarness.context.data.dashboard!,
      savedItems: [savedPaper]
    }
    const savedUnavailable = new SavedScreen(
      savedUnavailableHarness.context,
      new TriageHistory(savedUnavailableHarness.context)
    )
    savedUnavailableHarness.render(savedUnavailable)
    await flushMicrotasks()
    await savedUnavailableHarness.act(savedUnavailable, 'saved-wiki-filter', 'collected')
    expect(
      savedUnavailableHarness.find(
        savedUnavailableHarness.render(savedUnavailable),
        'saved-empty-title'
      )?.text
    ).toBe('llm-wiki is unavailable')
    savedUnavailable.dispose()
  })

  it('prevents an older slow batch response from overwriting a newer refreshOne status', async () => {
    let releaseSlowBatch = () => {}
    const slowBatch = new Promise<LlmWikiBatchStatusResponse>((resolve) => {
      releaseSlowBatch = () =>
        resolve(
          batchResponse([
            wikiStatus('2611.00001', { status: 'not-found' }),
            wikiStatus('2611.00002', { status: 'not-found' }),
            wikiStatus('2611.00003', { status: 'not-found' }),
            wikiStatus('2611.00004', { status: 'not-found' })
          ])
        )
    })
    const getLlmWikiStatuses = vi
      .fn<(request: LlmWikiBatchStatusRequest) => Promise<LlmWikiBatchStatusResponse>>()
      .mockReturnValueOnce(slowBatch)
      .mockResolvedValueOnce(
        batchResponse([
          wikiStatus('2611.00001', {
            status: 'recorded',
            recordPath: 'raw/paper_records/2611.00001.md',
            notePath: 'Literature/Paper_Notes/L2_Structured/Edge/2611.00001.md',
            level: 'L2'
          })
        ])
      )
    const h = nativeHarness({
      getLatestDiscover: vi.fn(async () => discoverSnapshotWithPapers()),
      getLlmWikiStatuses
    })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    h.render(screen)
    screen.llmWikiChanged('2611.00001')
    await flushMicrotasks()
    expect(h.find(h.render(screen), 'discover-results')?.rows?.[0]?.subtitle).toContain(
      'In llm-wiki · L2'
    )
    releaseSlowBatch()
    await flushMicrotasks()
    expect(h.find(h.render(screen), 'discover-results')?.rows?.[0]?.subtitle).toContain(
      'In llm-wiki · L2'
    )
    screen.dispose()
  })
})

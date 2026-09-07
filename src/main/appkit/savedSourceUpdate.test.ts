import { describe, expect, it, vi } from 'vitest'
import { SavedScreen } from './saved'
import { SavedSourceUpdateControls } from './savedSourceUpdate'
import { TriageHistory } from './reading'
import { nativeHarness } from './testSupport'
import { hashAnalysisSource } from '../../core/analysis/sourceSnapshot'
import type { DashboardItem } from '../../shared/api'
const item: DashboardItem = {
  id: 'github:owner/repo',
  source: 'github',
  kind: 'repository',
  title: 'Repository',
  summary: 'Old summary',
  url: 'https://github.com/owner/repo',
  publishedAt: '2026-09-01',
  score: 10,
  triageState: 'saved',
  reasons: ['Old match']
}
const newer = { ...item, summary: 'Updated source summary', reasons: ['New match'] }
const candidate = {
  itemId: item.id,
  sessionId: 'new-session',
  title: item.title,
  retrievedAt: '2026-09-07T12:00:00Z',
  updatedAt: '2026-09-07T10:00:00Z',
  currentSourceHash: hashAnalysisSource(item),
  sourceHash: hashAnalysisSource(newer)
}

describe('native Saved snapshot update', () => {
  it('ignores a late preview for a previously selected record', async () => {
    let resolvePreview!: (value: typeof candidate) => void
    const h = nativeHarness({
      getSavedSourceUpdate: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolvePreview = resolve
            })
        )
        .mockResolvedValue(null)
    })
    const controls = new SavedSourceUpdateControls(h.context, vi.fn())
    controls.select(item)
    controls.select({ ...item, id: 'github:other/repo' })
    resolvePreview(candidate)
    await vi.waitFor(() =>
      expect(h.find(controls.render(), 'saved-source-update-status')?.text).toContain('No newer')
    )
    expect(h.find(controls.render(), 'saved-update-source')?.enabled).toBe(false)
    controls.dispose()
  })
  it('updates the selected saved record and refreshes the reader without an unsave/model call', async () => {
    const h = nativeHarness({
      getSavedSourceUpdate: vi.fn().mockResolvedValueOnce(candidate).mockResolvedValue(null),
      applySavedSourceUpdate: vi.fn(async () => ({
        status: 'updated' as const,
        item: newer,
        dashboard: { ...h.dashboard, savedItems: [newer] }
      })),
      setTriageState: vi.fn(),
      analyzeItem: vi.fn()
    })
    h.context.data.dashboard = { ...h.dashboard, savedItems: [item] }
    const screen = new SavedScreen(h.context, new TriageHistory(h.context))
    await vi.waitFor(() =>
      expect(h.find(h.render(screen), 'saved-update-source')?.enabled).toBe(true)
    )
    await h.act(screen, 'saved-update-source')
    expect(h.api.applySavedSourceUpdate).toHaveBeenCalledWith({
      itemId: item.id,
      sessionId: candidate.sessionId,
      expectedSourceHash: candidate.currentSourceHash,
      sourceHash: candidate.sourceHash
    })
    expect(h.find(h.render(screen), 'saved-summary')?.text).toBe(newer.summary)
    expect(h.api.setTriageState).not.toHaveBeenCalled()
    expect(h.api.analyzeItem).not.toHaveBeenCalled()
    expect(h.context.notify).toHaveBeenCalledWith(expect.stringContaining('history retained'))
    screen.dispose()
  })
  it('shows an honest no-update state and a retry for failed local lookup', async () => {
    const h = nativeHarness({
      getSavedSourceUpdate: vi
        .fn()
        .mockRejectedValueOnce(new Error('read failed'))
        .mockResolvedValue(null)
    })
    h.context.data.dashboard = { ...h.dashboard, savedItems: [item] }
    const screen = new SavedScreen(h.context, new TriageHistory(h.context))
    await vi.waitFor(() =>
      expect(h.find(h.render(screen), 'saved-source-update-retry')).toBeDefined()
    )
    await h.act(screen, 'saved-source-update-retry')
    expect(h.find(h.render(screen), 'saved-update-source')?.enabled).toBe(false)
    expect(h.find(h.render(screen), 'saved-source-update-status')?.text).toContain(
      'No newer local snapshot'
    )
    screen.dispose()
  })
  it('reports a changed candidate without silently applying it', async () => {
    const h = nativeHarness({
      getSavedSourceUpdate: vi.fn(async () => candidate),
      applySavedSourceUpdate: vi.fn(async () => ({
        status: 'conflict' as const,
        item,
        dashboard: { ...h.dashboard, savedItems: [item] }
      }))
    })
    h.context.data.dashboard = { ...h.dashboard, savedItems: [item] }
    const screen = new SavedScreen(h.context, new TriageHistory(h.context))
    await vi.waitFor(() =>
      expect(h.find(h.render(screen), 'saved-update-source')?.enabled).toBe(true)
    )
    await h.act(screen, 'saved-update-source')
    expect(h.context.notify).toHaveBeenCalledWith(expect.stringContaining('changed'), 'error')
    expect(h.find(h.render(screen), 'saved-summary')?.text).toBe(item.summary)
    screen.dispose()
  })
})

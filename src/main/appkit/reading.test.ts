import { describe, expect, it, vi } from 'vitest'
import type { DashboardItem } from '../../shared/api'
import { ResearchReader, TriageHistory } from './reading'
import { nativeHarness } from './testSupport'

const item: DashboardItem = {
  id: 'arxiv:1',
  source: 'arxiv',
  kind: 'paper',
  title: 'Research paper',
  summary: 'Full summary '.repeat(100),
  url: 'https://arxiv.org/abs/1',
  publishedAt: '2026-09-06',
  score: 8,
  triageState: 'new',
  reasons: ['Matched interest']
}
const artifact = {
  id: 'analysis-1',
  itemId: item.id,
  providerId: 'fixture',
  providerName: 'Fixture',
  model: 'fixture',
  promptVersion: 'fixture-v1',
  sourceHash: 'hash',
  content: '# Result\n\nFull analysis.',
  createdAt: 'now'
}

describe('native reading and triage', () => {
  it('distinguishes a pending saved-analysis read from no analysis and exposes stale source evidence', async () => {
    let finish!: (value: typeof artifact) => void
    const h = nativeHarness({
      getLatestAnalysis: vi.fn(
        () =>
          new Promise<typeof artifact>((resolve) => {
            finish = resolve
          })
      ),
      getAnalysisArtifact: vi.fn(async () => ({
        artifact,
        freshness: 'stale' as const,
        currentSourceHash: 'changed'
      }))
    })
    const reader = new ResearchReader(h.context, 'saved', new TriageHistory(h.context))
    reader.select(item)
    expect(h.find(h.render(reader), 'saved-stored-analysis-loading')?.text).toContain('Loading')
    expect(h.find(h.render(reader), 'saved-no-analysis')).toBeUndefined()
    finish(artifact)
    await vi.waitFor(() =>
      expect(h.find(h.render(reader), 'saved-analysis-freshness')?.text).toContain('Source changed')
    )
    expect(h.find(h.render(reader), 'saved-analysis')?.text).toContain(artifact.content)
    expect(h.api.getAnalysisArtifact).toHaveBeenCalledWith(artifact.id)
  })
  it('keeps analysis before long content and expands intact supplementary metadata on request', async () => {
    const h = nativeHarness()
    const reader = new ResearchReader(h.context, 'discover', new TriageHistory(h.context))
    reader.runner = 'codex'
    reader.select(
      item,
      'session-1',
      '## Source details\nAuthors: Researcher\nPublished: exact timestamp'
    )
    const scene = h.render(reader)
    const content = scene.children![0]!
    const topActions = h.find(content, 'discover-reading-actions')!
    expect(h.find(topActions, 'discover-analyze')?.enabled).toBe(true)
    expect(h.find(scene, 'discover-provenance')).toBeUndefined()
    expect(h.find(scene, 'discover-evidence')?.text).toContain(
      'Full-paper results are not verified'
    )
    await h.act(reader, 'discover-metadata-toggle')
    expect(h.find(h.render(reader), 'discover-provenance')?.text).toContain(
      'Published: exact timestamp'
    )
    await h.act(reader, 'discover-metadata-toggle')
    expect(h.find(h.render(reader), 'discover-provenance')).toBeUndefined()
    expect(h.find(h.render(reader), 'discover-reading-meta')?.text).not.toContain('Score 8')
  })
  it('shows an analysis completed after switching away and back to the same item', async () => {
    let finish!: (value: typeof artifact) => void
    const h = nativeHarness({
      analyzeItem: vi.fn(
        () =>
          new Promise<typeof artifact>((resolve) => {
            finish = resolve
          })
      )
    })
    const reader = new ResearchReader(h.context, 'saved', new TriageHistory(h.context))
    reader.runner = 'codex'
    reader.select(item)
    const work = reader.analyze()
    reader.select({ ...item, id: 'arxiv:2' })
    reader.select(item)
    await Promise.resolve()
    finish(artifact)
    await work
    expect(h.find(h.render(reader), 'saved-analysis')?.text).toContain('Full analysis.')
  })

  it('does not treat absence from the bounded dashboard as proof an item is unsaved', async () => {
    const h = nativeHarness({ setTriageState: vi.fn(async () => h.dashboard) })
    const reader = new ResearchReader(h.context, 'discover', new TriageHistory(h.context))
    reader.select({ ...item, triageState: 'saved' }, 'session-1')
    expect(h.find(h.render(reader), 'discover-save')?.title).toBe('Unsave')
    await h.act(reader, 'discover-save')
    expect(h.api.setTriageState).toHaveBeenCalledWith(item.id, 'viewed')
    expect(h.find(h.render(reader), 'discover-save')?.title).toBe('Save')
  })
  it('does not replace the current paper with a late analysis for a previous selection', async () => {
    let finish!: (value: typeof artifact) => void
    const h = nativeHarness({
      getLatestAnalysis: vi.fn(async () => null),
      analyzeItem: vi.fn(
        () =>
          new Promise<typeof artifact>((resolve) => {
            finish = resolve
          })
      )
    })
    const reader = new ResearchReader(h.context, 'saved', new TriageHistory(h.context))
    reader.runner = 'codex'
    reader.select(item)
    const work = reader.analyze()
    reader.select({ ...item, id: 'arxiv:2', title: 'Other paper' })
    finish(artifact)
    await work
    expect(JSON.stringify(h.render(reader))).not.toContain('Full analysis.')
    expect(JSON.stringify(h.render(reader))).toContain('Other paper')
  })

  it('expands complete summaries and supports analysis for non-paper Saved records', async () => {
    const analyze = vi.fn(async () => artifact)
    const h = nativeHarness({ analyzeItem: analyze })
    const reader = new ResearchReader(h.context, 'saved', new TriageHistory(h.context))
    reader.runner = 'codex'
    reader.select({ ...item, id: 'github:1', source: 'github', kind: 'repository' })
    expect(JSON.stringify(h.render(reader))).not.toContain(item.summary)
    await h.act(reader, 'saved-expand')
    expect(JSON.stringify(h.render(reader))).toContain(item.summary)
    await h.act(reader, 'saved-analyze')
    expect(analyze).toHaveBeenCalledWith('github:1', 'codex')
  })

  it('records undo only on successful changes and restores the exact previous triage state', async () => {
    const change = vi.fn(async () => ({
      ...h.dashboard,
      savedItems: [{ ...item, triageState: 'saved' as const }]
    }))
    const h = nativeHarness({ setTriageState: change })
    h.context.data.dashboard = { ...h.dashboard, items: [item] }
    const history = new TriageHistory(h.context)
    await history.change(item, 'saved')
    expect(history.canUndo).toBe(true)
    await history.undo()
    expect(change).toHaveBeenLastCalledWith(item.id, 'new')
    expect(history.canUndo).toBe(false)
    change.mockRejectedValueOnce(new Error('write failed'))
    await history.change(item, 'dismissed')
    expect(history.canUndo).toBe(false)
  })
})

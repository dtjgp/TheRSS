// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardItem } from '../../shared/api'
import type { LlmWikiLibraryStatus } from '../../shared/llmWikiLibrary'
import type { LlmWikiPromotionPreview } from '../../shared/llmWikiPromotion'
import { App } from './App'
import {
  createApi,
  createDiscoverSnapshot,
  emptyDashboard,
  resetAppTestEnvironment
} from './App.testSupport'

const arxivId = '2611.00001'
const discover = createDiscoverSnapshot()
const discoverPaper = {
  ...discover.items[0]!,
  id: `arxiv:${arxivId}v2`,
  externalId: `${arxivId}v2`,
  url: `https://arxiv.org/abs/${arxivId}v2`
}
const savedPaper: DashboardItem = { ...discoverPaper, triageState: 'saved' }
const linked: LlmWikiLibraryStatus = {
  arxivId,
  status: 'recorded',
  checkedAt: '2026-11-06T08:00:00.000Z',
  recordPath: 'raw/paper_records/Paper.md',
  notePath: 'Literature/Paper_Notes/L2_Structured/Paper.md',
  level: 'L2',
  readStatus: 'unread',
  reason: null
}

describe('Paper membership in the compatibility UI', () => {
  beforeEach(resetAppTestEnvironment)

  it('loads exact membership in Discover, opens an existing note, and refreshes in Saved', async () => {
    const api = createApi({ ...emptyDashboard, savedItems: [savedPaper] })
    vi.mocked(api.getLatestDiscover).mockResolvedValue({
      ...discover,
      items: [discoverPaper, ...discover.items.slice(1)]
    })
    vi.mocked(api.getLlmWikiStatus)
      .mockResolvedValueOnce(linked)
      .mockResolvedValueOnce({ ...linked, notePath: null, level: null, readStatus: null })
      .mockResolvedValueOnce({
        ...linked,
        status: 'unavailable',
        notePath: null,
        recordPath: null,
        level: null,
        readStatus: null
      })
    vi.mocked(api.openLlmWikiNote).mockResolvedValue({ opened: true })
    const user = userEvent.setup()
    render(<App api={api} />)

    const reader = await screen.findByRole('article', { name: 'Selected Discover result' })
    const wiki = within(reader).getByRole('region', { name: 'llm-wiki membership' })
    expect(await within(wiki).findByText(/In llm-wiki.*L2.*unread/i)).toBeVisible()
    expect(api.getLlmWikiStatus).toHaveBeenCalledWith({ arxivId, refresh: false })
    await user.click(within(wiki).getByRole('button', { name: 'Open in Obsidian' }))
    expect(api.openLlmWikiNote).toHaveBeenCalledWith(arxivId)
    await user.click(screen.getByRole('button', { name: '02 Saved' }))
    expect(await screen.findByText(/paper record only/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Recheck llm-wiki' }))
    expect(await screen.findByText('llm-wiki unavailable')).toBeVisible()
    expect(api.getLlmWikiStatus).toHaveBeenLastCalledWith({ arxivId, refresh: true })
    expect(screen.queryByRole('button', { name: 'Open in Obsidian' })).toBeNull()
  })

  it('rechecks the visible paper after a confirmed promotion attempt, even on failure', async () => {
    const api = createApi({ ...emptyDashboard, savedItems: [savedPaper] })
    vi.mocked(api.getLlmWikiStatus).mockResolvedValueOnce({
      ...linked,
      status: 'not-found',
      notePath: null,
      recordPath: null,
      level: null,
      readStatus: null
    })
    vi.mocked(api.getLlmWikiStatus).mockResolvedValue(linked)
    const preview: LlmWikiPromotionPreview = {
      version: 'llm-wiki-promotion-preview-v1',
      previewId: '11111111-1111-4111-8111-111111111111',
      itemId: savedPaper.id,
      arxivId,
      title: savedPaper.title,
      ready: true,
      vaultLabel: 'llm-wiki',
      level: 'L2',
      routingRationale: 'Fixture routing.',
      intendedPaths: [linked.notePath!],
      pdf: null,
      evidenceBoundary: 'Fixture evidence only.',
      blockers: [],
      sourceHash: 'a'.repeat(64),
      contractHash: 'b'.repeat(64),
      expiresAt: '2026-11-06T09:00:00.000Z'
    }
    vi.mocked(api.previewLlmWikiPromotion).mockResolvedValue(preview)
    vi.mocked(api.confirmLlmWikiPromotion).mockRejectedValue(new Error('Partial local write'))
    const user = userEvent.setup()
    render(<App api={api} />)
    await user.click(screen.getByRole('button', { name: '02 Saved' }))
    expect(await screen.findByText('No llm-wiki paper record found')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Promote to llm-wiki' }))
    expect(api.getLlmWikiStatus).toHaveBeenCalledTimes(1)
    await user.click(await screen.findByRole('button', { name: 'Confirm local promotion' }))
    await waitFor(() =>
      expect(api.getLlmWikiStatus).toHaveBeenLastCalledWith({ arxivId, refresh: true })
    )
    expect(await screen.findByText(/In llm-wiki.*L2.*unread/i)).toBeVisible()
    expect(screen.getByText('Partial local write')).toBeVisible()
  })
})

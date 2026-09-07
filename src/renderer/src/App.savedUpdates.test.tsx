// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardItem } from '../../shared/api'
import { App } from './App'
import { createApi, emptyDashboard, resetAppTestEnvironment } from './App.testSupport'
const item: DashboardItem = {
  id: 'github:owner/repo',
  source: 'github',
  kind: 'repository',
  title: 'Saved repository',
  summary: 'Original metadata',
  publishedAt: '2026-09-01',
  url: 'https://github.com/owner/repo',
  score: 10,
  triageState: 'saved',
  reasons: ['Original match']
}
const candidate = {
  itemId: item.id,
  sessionId: 'new-local',
  title: item.title,
  retrievedAt: '2026-09-07T12:00:00Z',
  updatedAt: '2026-09-07T10:00:00Z',
  currentSourceHash: 'a'.repeat(64),
  sourceHash: 'b'.repeat(64)
}

describe('Saved source update in the compatibility UI', () => {
  beforeEach(resetAppTestEnvironment)
  it('applies the exact preview and replaces visible metadata while retaining Saved state', async () => {
    const newer = { ...item, summary: 'Updated local metadata', reasons: ['Updated match'] }
    const api = createApi({ ...emptyDashboard, savedItems: [item] })
    vi.mocked(api.getSavedSourceUpdate).mockResolvedValueOnce(candidate).mockResolvedValue(null)
    vi.mocked(api.applySavedSourceUpdate).mockResolvedValue({
      status: 'updated',
      item: newer,
      dashboard: { ...emptyDashboard, savedItems: [newer] }
    })
    const user = userEvent.setup()
    render(<App api={api} />)
    await user.click(await screen.findByRole('button', { name: '02 Saved' }))
    const update = await screen.findByRole('button', { name: 'Update saved snapshot' })
    await waitFor(() => expect(update).toBeEnabled())
    await user.click(update)
    expect(api.applySavedSourceUpdate).toHaveBeenCalledWith({
      itemId: item.id,
      sessionId: candidate.sessionId,
      expectedSourceHash: candidate.currentSourceHash,
      sourceHash: candidate.sourceHash
    })
    const reader = screen.getByRole('article', { name: 'Selected signal details' })
    expect(await within(reader).findByText('Updated local metadata')).toBeVisible()
    expect(within(reader).getByRole('button', { name: 'Save signal' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(api.setTriageState).not.toHaveBeenCalled()
    expect(api.analyzeItem).not.toHaveBeenCalled()
  })
  it('keeps data intact on a failed update and allows a local lookup retry', async () => {
    const api = createApi({ ...emptyDashboard, savedItems: [item] })
    vi.mocked(api.getSavedSourceUpdate)
      .mockRejectedValueOnce(new Error('lookup failed'))
      .mockResolvedValue(candidate)
    vi.mocked(api.applySavedSourceUpdate).mockRejectedValue(new Error('Local update failed'))
    const user = userEvent.setup()
    render(<App api={api} />)
    await user.click(await screen.findByRole('button', { name: '02 Saved' }))
    await user.click(await screen.findByRole('button', { name: 'Retry snapshot check' }))
    const update = screen.getByRole('button', { name: 'Update saved snapshot' })
    await waitFor(() => expect(update).toBeEnabled())
    await user.click(update)
    expect(await screen.findByText('Local update failed')).toBeVisible()
    expect(
      within(screen.getByRole('article', { name: 'Selected signal details' })).getByText(
        'Original metadata'
      )
    ).toBeVisible()
  })
})

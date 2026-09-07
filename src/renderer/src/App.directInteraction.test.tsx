// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { createApi, createDiscoverSnapshot, resetAppTestEnvironment } from './App.testSupport'

describe('direct Discover editing in the compatibility UI', () => {
  beforeEach(resetAppTestEnvironment)
  it('keeps the query visible while restoring a session and prevents overwriting an early edit', async () => {
    const api = createApi()
    const snapshot = createDiscoverSnapshot()
    let finish!: (value: typeof snapshot) => void
    vi.mocked(api.getLatestDiscover).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    render(<App api={api} />)
    const query = screen.getByRole('textbox', { name: 'Research question' })
    expect(query).toBeVisible()
    expect(query).toBeEnabled()
    fireEvent.change(query, { target: { value: 'My early draft' } })
    finish(snapshot)
    await waitFor(() => expect(screen.getByLabelText('Unsubmitted search changes')).toBeVisible())
    expect(query).toHaveValue('My early draft')
  })
  it('preserves results while editing and labels the unsubmitted query; submission locks its input', async () => {
    const api = createApi()
    const snapshot = createDiscoverSnapshot()
    vi.mocked(api.getLatestDiscover).mockResolvedValue(snapshot)
    let finish!: (value: typeof snapshot) => void
    vi.mocked(api.searchDiscover).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    render(<App api={api} />)
    const query = screen.getByRole('textbox', { name: 'Research question' })
    await waitFor(() => expect(query).toHaveValue(snapshot.intent))
    fireEvent.change(query, { target: { value: 'A revised research question' } })
    expect(api.searchDiscover).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Unsubmitted search changes')).toHaveTextContent(snapshot.intent)
    expect(screen.getByRole('list', { name: 'Discover result list' })).toBeVisible()
    fireEvent.submit(query.closest('form')!)
    expect(query).toBeDisabled()
    finish({ ...snapshot, intent: 'A revised research question' })
    await waitFor(() => expect(query).toBeEnabled())
    expect(screen.queryByLabelText('Unsubmitted search changes')).toBeNull()
  })
})

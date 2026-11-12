// @vitest-environment jsdom

import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DiscoverSourcePreference } from '../../shared/discoverSourcePreference'
import { App } from './App'
import { createApi } from './App.testSupport'

const preference = (sources: DiscoverSourcePreference['sources']): DiscoverSourcePreference => ({
  sources,
  unavailable: [],
  origin: 'user',
  updatedAt: '2026-11-12T00:00:00.000Z'
})

async function openDialog() {
  let settle!: (value: DiscoverSourcePreference) => void
  const api = createApi()
  vi.mocked(api.getDiscoverSourcePreference).mockResolvedValue(preference(['arxiv']))
  vi.mocked(api.saveDiscoverSourcePreference).mockImplementation(
    () =>
      new Promise((resolve) => {
        settle = resolve
      })
  )
  const user = userEvent.setup()
  render(<App api={api} />)
  await user.click(screen.getByRole('button', { name: '04 Sources' }))
  const entry = await screen.findByRole('button', { name: 'My sources · 1/22' })
  await user.click(entry)
  const dialog = screen.getByRole('dialog', { name: 'Default search sources' })
  return { api, user, entry, dialog, settle: () => settle }
}

describe('My sources dialog keyboard focus', () => {
  it('keeps Tab and Shift-Tab inside the dialog in both directions', async () => {
    const { user, dialog } = await openDialog()
    const find = within(dialog).getByRole('searchbox', { name: 'Find sources' })
    const save = within(dialog).getByRole('button', { name: 'Save default sources' })
    expect(find).toHaveFocus()
    await user.tab({ shift: true })
    expect(save).toHaveFocus()
    await user.tab()
    expect(find).toHaveFocus()
    for (let step = 0; step < 40; step++) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it('holds focus in the dialog while saving and returns it to the entry after the save', async () => {
    const { user, entry, dialog, settle } = await openDialog()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Use GitHub by default' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save default sources' }))
    expect(within(dialog).getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(dialog).toHaveFocus()
    await user.tab()
    expect(dialog).toHaveFocus()
    await user.tab({ shift: true })
    expect(dialog).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Default search sources' })).toBe(dialog)
    settle()(preference(['arxiv', 'github']))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(entry).toHaveFocus()
  })

  it('returns focus to the entry after Cancel', async () => {
    const { user, entry, dialog } = await openDialog()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(entry).toHaveFocus()
  })
})

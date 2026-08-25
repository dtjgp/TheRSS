// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { TheRSSApi } from '../../shared/api'
import { SettingsView } from './SettingsView'

function settingsApi(): TheRSSApi {
  return {
    onAppCommand: vi.fn().mockReturnValue(() => undefined),
    getSystemAccent: vi.fn().mockResolvedValue(null),
    onSystemAccentChange: vi.fn().mockReturnValue(() => undefined),
    getDashboard: vi.fn(),
    getSourceContent: vi.fn(),
    refreshSourceContent: vi.fn(),
    getInterestProfile: vi.fn(),
    saveInterestProfile: vi.fn(),
    refresh: vi.fn(),
    searchDiscover: vi.fn(),
    getLatestDiscover: vi.fn(),
    getAnalytics: vi.fn(),
    saveDiscoverResult: vi.fn(),
    setTriageState: vi.fn(),
    getModelProvider: vi.fn().mockResolvedValue({
      id: 'default',
      name: 'Protected provider',
      protocol: 'openai-compatible',
      baseUrl: 'https://api.example.com/v1',
      model: 'model-a',
      hasCredential: true,
      updatedAt: '2026-08-24T08:00:00.000Z'
    }),
    saveModelProvider: vi.fn(),
    testModelProvider: vi.fn().mockResolvedValue({
      status: 'authentication_failed',
      message: 'Authentication was rejected. Replace the credential and try again.',
      testedAt: '2026-08-24T09:00:00.000Z'
    }),
    clearModelProviderCredential: vi.fn().mockResolvedValue({
      id: 'default',
      name: 'Protected provider',
      protocol: 'openai-compatible',
      baseUrl: 'https://api.example.com/v1',
      model: 'model-a',
      hasCredential: false,
      updatedAt: '2026-08-24T09:01:00.000Z'
    }),
    setSettingsDirty: vi.fn(),
    confirmDiscardSettings: vi.fn().mockResolvedValue(true),
    getDiscoverPersonalizationSettings: vi.fn().mockResolvedValue({
      prompt: '',
      updatedAt: '2026-08-24T08:00:00.000Z'
    }),
    saveDiscoverPersonalizationPrompt: vi.fn(),
    getLocalAgentStatuses: vi.fn(),
    analyzeItem: vi.fn(),
    analyzeDiscoverResult: vi.fn(),
    getLatestAnalysis: vi.fn(),
    previewLlmWikiPromotion: vi.fn(),
    confirmLlmWikiPromotion: vi.fn(),
    cancelLlmWikiPromotion: vi.fn(),
    getLatestLlmWikiPromotion: vi.fn()
  }
}

describe('SettingsView', () => {
  it('separates personal context and provider settings into accessible panes', async () => {
    const user = userEvent.setup()
    render(<SettingsView api={settingsApi()} localAgents={[]} onDirtyChange={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeVisible()
    const tabs = screen.getByRole('tablist', { name: 'Settings sections' })
    expect(screen.getByRole('tab', { name: 'Personal context' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await user.click(screen.getByRole('tab', { name: 'Model provider' }))
    expect(screen.getByRole('heading', { name: 'Model provider' })).toBeVisible()
    expect(tabs).toContainElement(screen.getByRole('tab', { name: 'Model provider' }))
  })

  it('associates field errors and does not call main with invalid provider input', async () => {
    const api = settingsApi()
    vi.mocked(api.getModelProvider).mockResolvedValue(null)
    const user = userEvent.setup()
    render(<SettingsView api={api} localAgents={[]} onDirtyChange={vi.fn()} />)

    await user.click(screen.getByRole('tab', { name: 'Model provider' }))
    await user.click(screen.getByRole('button', { name: 'Save model provider' }))

    const name = screen.getByRole('textbox', { name: 'Provider name' })
    const url = screen.getByRole('textbox', { name: 'Provider base URL' })
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAccessibleDescription('Enter a provider name.')
    expect(url).toHaveAttribute('aria-invalid', 'true')
    expect(url).toHaveAccessibleDescription('Enter an HTTPS or loopback HTTP base URL.')
    expect(api.saveModelProvider).not.toHaveBeenCalled()
  })

  it('tests the unsaved draft and exposes classified feedback without saving it', async () => {
    const api = settingsApi()
    const user = userEvent.setup()
    render(<SettingsView api={api} localAgents={[]} onDirtyChange={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'Model provider' }))
    await screen.findByDisplayValue('Protected provider')

    await user.clear(screen.getByRole('textbox', { name: 'Model name' }))
    await user.type(screen.getByRole('textbox', { name: 'Model name' }), 'model-b')
    await user.click(screen.getByRole('button', { name: 'Test connection' }))

    expect(api.testModelProvider).toHaveBeenCalledWith({
      name: 'Protected provider',
      protocol: 'openai-compatible',
      baseUrl: 'https://api.example.com/v1',
      model: 'model-b'
    })
    expect(
      await screen.findByRole('status', { name: 'Provider connection result' })
    ).toHaveTextContent('Authentication was rejected')
    expect(api.saveModelProvider).not.toHaveBeenCalled()
  })

  it('clears a protected credential only through the explicit clear action', async () => {
    const api = settingsApi()
    const user = userEvent.setup()
    render(<SettingsView api={api} localAgents={[]} onDirtyChange={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'Model provider' }))
    expect(await screen.findByText('Credential protected by macOS')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Clear protected credential' }))

    await waitFor(() => expect(api.clearModelProviderCredential).toHaveBeenCalledOnce())
    expect(await screen.findByRole('status')).toHaveTextContent('Credential cleared')
    expect(screen.queryByText('Credential protected by macOS')).not.toBeInTheDocument()
  })

  it('requires an explicit replacement before saving a protected credential to another endpoint', async () => {
    const api = settingsApi()
    const user = userEvent.setup()
    render(<SettingsView api={api} localAgents={[]} onDirtyChange={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'Model provider' }))
    const baseUrl = await screen.findByRole('textbox', { name: 'Provider base URL' })

    await user.clear(baseUrl)
    await user.type(baseUrl, 'https://other.example.com/v1')
    await user.click(screen.getByRole('button', { name: 'Save model provider' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('replacement credential')
    expect(api.saveModelProvider).not.toHaveBeenCalled()
  })

  it('reports unsaved edits and clears the dirty state after a successful save', async () => {
    const api = settingsApi()
    vi.mocked(api.saveModelProvider).mockResolvedValue({
      id: 'default',
      name: 'Protected provider',
      protocol: 'openai-compatible',
      baseUrl: 'https://api.example.com/v1',
      model: 'model-b',
      hasCredential: true,
      updatedAt: '2026-08-24T10:00:00.000Z'
    })
    const onDirtyChange = vi.fn()
    const user = userEvent.setup()
    render(<SettingsView api={api} localAgents={[]} onDirtyChange={onDirtyChange} />)
    await user.click(screen.getByRole('tab', { name: 'Model provider' }))
    await screen.findByDisplayValue('model-a')

    await user.clear(screen.getByRole('textbox', { name: 'Model name' }))
    await user.type(screen.getByRole('textbox', { name: 'Model name' }), 'model-b')
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('button', { name: 'Save model provider' }))
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false))
    expect(await screen.findByRole('status')).toHaveTextContent('Provider settings saved')
  })
})

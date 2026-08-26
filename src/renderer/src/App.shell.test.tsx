// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardSnapshot, TheRSSApi } from '../../shared/api'
import { App } from './App'
import { createApi, emptyDashboard, resetAppTestEnvironment } from './App.testSupport'

describe('App', () => {
  beforeEach(resetAppTestEnvironment)

  it('opens Settings from the native command and saves a provider', async () => {
    const api = createApi()
    let listener: Parameters<TheRSSApi['onAppCommand']>[0] | null = null
    vi.mocked(api.onAppCommand).mockImplementation((candidate) => {
      listener = candidate
      return () => undefined
    })
    const user = userEvent.setup()
    render(<App api={api} />)

    act(() => listener?.('open-settings'))
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Model provider' }))
    await user.type(screen.getByRole('textbox', { name: 'Provider name' }), 'Local fixture')
    await user.type(
      screen.getByRole('textbox', { name: 'Provider base URL' }),
      'http://127.0.0.1:11434/v1'
    )
    await user.type(screen.getByRole('textbox', { name: 'Model name' }), 'fixture-model')
    await user.click(screen.getByRole('button', { name: 'Save model provider' }))
    expect(api.saveModelProvider).toHaveBeenCalledWith({
      name: 'Local fixture',
      protocol: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: 'fixture-model'
    })
  })

  it('loads and saves the optional personal Discover prompt from Settings', async () => {
    const api = createApi()
    vi.mocked(api.getDiscoverPersonalizationSettings).mockResolvedValue({
      prompt: 'Prefer systems papers with explicit evaluation and reproducibility detail.',
      updatedAt: '2026-08-20T08:00:00.000Z'
    })
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    expect(await screen.findByRole('textbox', { name: 'Personal Discover prompt' })).toHaveValue(
      'Prefer systems papers with explicit evaluation and reproducibility detail.'
    )
    await user.clear(screen.getByRole('textbox', { name: 'Personal Discover prompt' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Personal Discover prompt' }),
      'Prioritize edge intelligence, energy systems, and clear claim boundaries.'
    )
    await user.click(screen.getByRole('button', { name: 'Save personal Discover prompt' }))

    expect(api.saveDiscoverPersonalizationPrompt).toHaveBeenCalledWith(
      'Prioritize edge intelligence, energy systems, and clear claim boundaries.'
    )
  })

  it('guards navigation away from unsaved Settings edits', async () => {
    const api = createApi()
    vi.mocked(api.confirmDiscardSettings).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('tab', { name: 'Model provider' }))
    await user.type(screen.getByRole('textbox', { name: 'Provider name' }), 'Unsaved provider')
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes')
    expect(api.setSettingsDirty).toHaveBeenLastCalledWith(true)

    await user.click(screen.getByRole('button', { name: '01 Discover' }))
    expect(api.confirmDiscardSettings).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: '01 Discover' }))
    expect(api.confirmDiscardSettings).toHaveBeenCalledTimes(2)
    expect(
      screen.getByRole('heading', { name: 'Search across your full source desk' })
    ).toBeVisible()
    expect(api.setSettingsDirty).toHaveBeenLastCalledWith(false)
  })

  it('clears and disables saved personal context across Settings and Discover', async () => {
    const api = createApi()
    let storedPrompt = 'Prefer reviewer-safe energy systems research.'
    vi.mocked(api.getDiscoverPersonalizationSettings).mockImplementation(() =>
      Promise.resolve({
        prompt: storedPrompt,
        updatedAt: '2026-08-20T08:00:00.000Z'
      })
    )
    vi.mocked(api.saveDiscoverPersonalizationPrompt).mockImplementation((prompt) => {
      storedPrompt = prompt.trim()
      return Promise.resolve({
        prompt: storedPrompt,
        updatedAt: '2026-08-20T09:00:00.000Z'
      })
    })
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const personalPrompt = await screen.findByRole('textbox', {
      name: 'Personal Discover prompt'
    })
    await user.clear(personalPrompt)
    await user.click(screen.getByRole('button', { name: 'Save personal Discover prompt' }))

    expect(api.saveDiscoverPersonalizationPrompt).toHaveBeenCalledWith('')
    expect(await screen.findByRole('status')).toHaveTextContent('Personal context cleared')

    await user.click(screen.getByRole('button', { name: '01 Discover' }))
    expect(await screen.findByRole('status', { name: 'Personal prompt status' })).toHaveTextContent(
      'Personal context off'
    )
  })

  it('responds to native navigation, sidebar, and selected-item analysis commands', async () => {
    const savedItem: DashboardSnapshot['savedItems'][number] = {
      id: 'folo:302:saved',
      source: 'folo:302',
      kind: 'article',
      title: 'Saved BAAI article',
      summary: 'Saved article summary.',
      url: 'https://www.baai.ac.cn/saved',
      publishedAt: '2026-08-18T00:00:00.000Z',
      score: 35,
      triageState: 'saved',
      reasons: ['Saved reason']
    }
    const api = createApi({ ...emptyDashboard, savedItems: [savedItem] })
    let listener: Parameters<TheRSSApi['onAppCommand']>[0] | null = null
    vi.mocked(api.onAppCommand).mockImplementation((candidate) => {
      listener = candidate
      return () => undefined
    })
    const user = userEvent.setup()
    render(<App api={api} />)

    act(() => listener?.('show-saved'))
    const savedSignal = await screen.findByRole('button', {
      name: 'Select signal: Saved BAAI article'
    })
    await user.click(savedSignal)
    await waitFor(() => expect(api.getLatestAnalysis).toHaveBeenCalledWith('folo:302:saved'))
    act(() => listener?.('analyze-selected'))
    await waitFor(() =>
      expect(api.analyzeItem).toHaveBeenCalledWith('folo:302:saved', 'model-provider')
    )
    expect(await screen.findByText('Bounded fixture analysis.')).toBeVisible()
    act(() => listener?.('show-discover'))
    expect(
      screen.getByRole('heading', { name: 'Search across your full source desk' })
    ).toBeVisible()
    act(() => listener?.('toggle-sidebar'))
    expect(screen.getByRole('button', { name: 'Show sidebar' })).toBeVisible()
  })

  it('lets the user resize the sidebar with pointer or keyboard and restores the width', () => {
    const { unmount } = render(<App api={createApi()} />)
    const shell = document.querySelector<HTMLElement>('.app-shell')
    const separator = screen.getByRole('separator', { name: 'Resize sidebar' })

    expect(shell).toHaveStyle({ '--sidebar-width': '196px' })
    expect(separator).toHaveAttribute('aria-valuemin', '184')
    expect(separator).toHaveAttribute('aria-valuemax', '360')
    expect(separator).toHaveAttribute('aria-valuenow', '196')

    fireEvent.pointerDown(separator, { pointerId: 1, clientX: 196 })
    fireEvent.pointerMove(separator, { pointerId: 1, clientX: 312 })
    expect(shell).toHaveStyle({ '--sidebar-width': '312px' })
    expect(separator).toHaveAttribute('aria-valuenow', '312')
    fireEvent.pointerUp(separator, { pointerId: 1, clientX: 312 })
    expect(window.localStorage.getItem('therss.sidebar-width')).toBe('312')

    fireEvent.keyDown(separator, { key: 'ArrowLeft' })
    expect(shell).toHaveStyle({ '--sidebar-width': '304px' })
    expect(window.localStorage.getItem('therss.sidebar-width')).toBe('304')

    unmount()
    render(<App api={createApi()} />)
    expect(document.querySelector<HTMLElement>('.app-shell')).toHaveStyle({
      '--sidebar-width': '304px'
    })
  })

  it('rolls back an interrupted sidebar drag and clears the resizing state', () => {
    render(<App api={createApi()} />)
    const shell = document.querySelector<HTMLElement>('.app-shell')
    const separator = screen.getByRole('separator', { name: 'Resize sidebar' })

    fireEvent.pointerDown(separator, { pointerId: 1, clientX: 196 })
    fireEvent.pointerMove(separator, { pointerId: 1, clientX: 260 })
    expect(shell).toHaveStyle({ '--sidebar-width': '260px' })
    expect(shell).toHaveClass('app-shell--sidebar-resizing')
    fireEvent.pointerCancel(separator, { pointerId: 1 })
    expect(shell).toHaveStyle({ '--sidebar-width': '196px' })
    expect(shell).not.toHaveClass('app-shell--sidebar-resizing')
    expect(window.localStorage.getItem('therss.sidebar-width')).toBeNull()

    fireEvent.pointerDown(separator, { pointerId: 2, clientX: 196 })
    fireEvent.pointerMove(separator, { pointerId: 2, clientX: 280 })
    fireEvent.lostPointerCapture(separator, { pointerId: 2 })
    expect(shell).toHaveStyle({ '--sidebar-width': '196px' })
    expect(shell).not.toHaveClass('app-shell--sidebar-resizing')
  })

  it('caps a saved width for a narrow window and restores it when space returns', () => {
    window.localStorage.setItem('therss.sidebar-width', '360')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 820 })
    render(<App api={createApi()} />)
    const shell = document.querySelector<HTMLElement>('.app-shell')
    const separator = screen.getByRole('separator', { name: 'Resize sidebar' })

    expect(shell).toHaveStyle({ '--sidebar-width': '184px' })
    expect(separator).toHaveAttribute('aria-valuemax', '184')
    expect(window.localStorage.getItem('therss.sidebar-width')).toBe('360')

    fireEvent.keyDown(separator, { key: 'ArrowRight' })
    fireEvent.pointerDown(separator, { pointerId: 1, clientX: 184 })
    fireEvent.pointerUp(separator, { pointerId: 1, clientX: 184 })
    expect(shell).toHaveStyle({ '--sidebar-width': '184px' })
    expect(window.localStorage.getItem('therss.sidebar-width')).toBe('360')

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1360 })
    fireEvent(window, new Event('resize'))
    expect(shell).toHaveStyle({ '--sidebar-width': '360px' })
    expect(separator).toHaveAttribute('aria-valuemax', '360')
  })

  it('compacts the sidebar only when the renderer viewport is constrained and restores preference', () => {
    render(<App api={createApi()} />)
    const shell = document.querySelector<HTMLElement>('.app-shell')

    expect(shell).not.toHaveClass('app-shell--sidebar-collapsed')
    expect(screen.getByRole('button', { name: 'Hide sidebar' })).toBeEnabled()

    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 820 })
    fireEvent(window, new Event('resize'))
    expect(shell).not.toHaveClass('app-shell--sidebar-collapsed')

    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 700 })
    fireEvent(window, new Event('resize'))
    expect(shell).toHaveClass('app-shell--sidebar-collapsed')
    expect(shell).toHaveAttribute('data-sidebar-constrained', 'true')
    expect(screen.getByRole('button', { name: 'Sidebar compact at current zoom' })).toBeDisabled()
    expect(screen.queryByRole('separator', { name: 'Resize sidebar' })).not.toBeInTheDocument()
    expect(window.localStorage.getItem('therss.sidebar-width')).toBeNull()

    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1360 })
    fireEvent(window, new Event('resize'))
    expect(shell).not.toHaveClass('app-shell--sidebar-collapsed')
    expect(shell).toHaveAttribute('data-sidebar-constrained', 'false')
    expect(screen.getByRole('button', { name: 'Hide sidebar' })).toBeEnabled()
    expect(screen.getByRole('separator', { name: 'Resize sidebar' })).toBeVisible()
  })

  it('preserves a manual compact preference across a constrained viewport round trip', async () => {
    const user = userEvent.setup()
    render(<App api={createApi()} />)
    const shell = document.querySelector<HTMLElement>('.app-shell')

    await user.click(screen.getByRole('button', { name: 'Hide sidebar' }))
    expect(shell).toHaveClass('app-shell--sidebar-collapsed')

    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 700 })
    fireEvent(window, new Event('resize'))
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1360 })
    fireEvent(window, new Event('resize'))

    expect(shell).toHaveClass('app-shell--sidebar-collapsed')
    expect(screen.getByRole('button', { name: 'Show sidebar' })).toBeEnabled()
  })

  it('preserves the wider preference when a capped drag returns to its start', () => {
    window.localStorage.setItem('therss.sidebar-width', '296')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 900 })
    render(<App api={createApi()} />)
    const shell = document.querySelector<HTMLElement>('.app-shell')
    const separator = screen.getByRole('separator', { name: 'Resize sidebar' })

    expect(shell).toHaveStyle({ '--sidebar-width': '260px' })
    fireEvent.pointerDown(separator, { pointerId: 1, clientX: 260 })
    fireEvent.pointerMove(separator, { pointerId: 1, clientX: 252 })
    expect(shell).toHaveStyle({ '--sidebar-width': '252px' })
    fireEvent.pointerMove(separator, { pointerId: 1, clientX: 260 })
    fireEvent.pointerUp(separator, { pointerId: 1, clientX: 260 })
    expect(shell).toHaveStyle({ '--sidebar-width': '260px' })
    expect(window.localStorage.getItem('therss.sidebar-width')).toBe('296')

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1360 })
    fireEvent(window, new Event('resize'))
    expect(shell).toHaveStyle({ '--sidebar-width': '296px' })
  })

  it('clamps malformed saved widths and keeps resizing available when storage throws', () => {
    window.localStorage.setItem('therss.sidebar-width', '999')
    const firstRender = render(<App api={createApi()} />)
    expect(document.querySelector<HTMLElement>('.app-shell')).toHaveStyle({
      '--sidebar-width': '360px'
    })
    firstRender.unmount()

    window.localStorage.setItem('therss.sidebar-width', 'not-a-number')
    const secondRender = render(<App api={createApi()} />)
    expect(document.querySelector<HTMLElement>('.app-shell')).toHaveStyle({
      '--sidebar-width': '196px'
    })
    secondRender.unmount()

    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    const thirdRender = render(<App api={createApi()} />)
    expect(document.querySelector<HTMLElement>('.app-shell')).toHaveStyle({
      '--sidebar-width': '196px'
    })
    getItem.mockRestore()

    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    expect(() =>
      fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize sidebar' }), {
        key: 'ArrowRight'
      })
    ).not.toThrow()
    expect(document.querySelector<HTMLElement>('.app-shell')).toHaveStyle({
      '--sidebar-width': '204px'
    })
    setItem.mockRestore()
    thirdRender.unmount()
  })

  it('keeps a saved signal after a failed removal and removes it after a successful retry', async () => {
    const savedItem: DashboardSnapshot['savedItems'][number] = {
      id: 'folo:302:saved',
      source: 'folo:302',
      kind: 'article',
      title: 'Saved BAAI article',
      summary: 'Saved article summary.',
      url: 'https://www.baai.ac.cn/saved',
      publishedAt: '2026-08-18T00:00:00.000Z',
      score: 35,
      triageState: 'saved',
      reasons: ['Saved reason']
    }
    const api = createApi({ ...emptyDashboard, savedItems: [savedItem] })
    vi.mocked(api.setTriageState)
      .mockRejectedValueOnce(new Error('database busy'))
      .mockResolvedValueOnce(emptyDashboard)
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(screen.getByRole('button', { name: '02 Saved' }))
    const saveButton = await screen.findByRole('button', { name: 'Save signal', pressed: true })
    await user.click(saveButton)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The item state could not be updated. The local index was not changed.'
    )
    expect(screen.getByRole('button', { name: 'Select signal: Saved BAAI article' })).toBeVisible()
    expect(saveButton).toHaveAttribute('aria-pressed', 'true')

    await user.click(saveButton)
    expect(api.setTriageState).toHaveBeenLastCalledWith('folo:302:saved', 'viewed')
    expect(await screen.findByRole('heading', { name: 'No saved signals yet.' })).toBeVisible()
  })

  it('dismisses a saved signal and restores its exact prior state with Undo', async () => {
    const savedItem: DashboardSnapshot['savedItems'][number] = {
      id: 'arxiv:saved-paper',
      source: 'arxiv',
      kind: 'paper',
      title: 'Saved paper for triage',
      summary: 'Paper summary.',
      url: 'https://arxiv.org/abs/saved-paper',
      publishedAt: '2026-08-18T00:00:00.000Z',
      score: 44,
      triageState: 'saved',
      reasons: ['Saved paper reason']
    }
    const savedDashboard = { ...emptyDashboard, savedItems: [savedItem] }
    const api = createApi(savedDashboard)
    vi.mocked(api.setTriageState)
      .mockResolvedValueOnce(emptyDashboard)
      .mockResolvedValueOnce(savedDashboard)
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(screen.getByRole('button', { name: '02 Saved' }))
    expect(await screen.findByRole('button', { name: 'Promote to llm-wiki' })).toBeVisible()
    await user.click(await screen.findByRole('button', { name: 'Dismiss signal' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Dismissed “Saved paper for triage”'
    )
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(api.setTriageState).toHaveBeenNthCalledWith(2, 'arxiv:saved-paper', 'saved')
    expect(
      await screen.findByRole('button', { name: 'Select signal: Saved paper for triage' })
    ).toBeVisible()
  })

  it('keeps Saved triage actions before a collapsed long summary', async () => {
    const longSummary = 'Long abstract evidence. '.repeat(80)
    const savedItem: DashboardSnapshot['savedItems'][number] = {
      id: 'arxiv:long-summary',
      source: 'arxiv',
      kind: 'paper',
      title: 'Long paper for Saved triage',
      summary: longSummary,
      url: 'https://arxiv.org/abs/long-summary',
      publishedAt: '2026-08-18T00:00:00.000Z',
      score: 64,
      triageState: 'saved',
      reasons: ['Long abstract fixture']
    }
    const secondSavedItem: DashboardSnapshot['savedItems'][number] = {
      ...savedItem,
      id: 'arxiv:second-long-summary',
      title: 'Second long paper for Saved triage',
      url: 'https://arxiv.org/abs/second-long-summary'
    }
    const user = userEvent.setup()
    render(<App api={createApi({ ...emptyDashboard, savedItems: [savedItem, secondSavedItem] })} />)

    await user.click(screen.getByRole('button', { name: '02 Saved' }))
    const saveAction = await screen.findByRole('button', { name: 'Save signal' })
    const summary = document.querySelector<HTMLElement>('.signal-detail__summary')!
    expect(summary).toHaveTextContent('Long abstract evidence.')
    expect(
      Boolean(saveAction.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true)
    const summaryToggle = screen.getByRole('button', { name: 'Show full summary' })
    expect(summaryToggle).toHaveAttribute('aria-expanded', 'false')
    expect(summary).toHaveAttribute('data-expanded', 'false')

    await user.click(summaryToggle)
    expect(screen.getByRole('button', { name: 'Collapse summary' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(summary).toHaveAttribute('data-expanded', 'true')

    await user.click(
      screen.getByRole('button', { name: 'Select signal: Second long paper for Saved triage' })
    )
    expect(screen.getByRole('button', { name: 'Show full summary' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })

  it('restores the latest persisted analysis for the selected saved signal', async () => {
    const savedItem: DashboardSnapshot['savedItems'][number] = {
      id: 'arxiv:persisted',
      source: 'arxiv',
      kind: 'paper',
      title: 'Persisted analysis paper',
      summary: 'A paper with prior analysis.',
      url: 'https://arxiv.org/abs/persisted',
      publishedAt: '2026-08-18T00:00:00.000Z',
      score: 62,
      triageState: 'saved',
      reasons: ['Previously analyzed']
    }
    const api = createApi({ ...emptyDashboard, savedItems: [savedItem] })
    vi.mocked(api.getLatestAnalysis).mockResolvedValue({
      id: 'analysis-persisted',
      itemId: 'arxiv:persisted',
      providerId: 'local-agent:codex',
      providerName: 'Codex CLI',
      model: 'codex-cli',
      promptVersion: 'llm-wiki-paper-l1-v1',
      sourceHash: 'd'.repeat(64),
      content: 'Persisted local analysis restored.',
      createdAt: '2026-08-19T12:00:00.000Z'
    })
    const user = userEvent.setup()
    render(<App api={api} />)

    await user.click(screen.getByRole('button', { name: '02 Saved' }))
    await waitFor(() => expect(api.getLatestAnalysis).toHaveBeenCalledWith('arxiv:persisted'))
    expect(await screen.findByText('Persisted local analysis restored.')).toBeVisible()
  })

  it('opens Data Analytics from the consolidated navigation', async () => {
    const user = userEvent.setup()
    render(<App api={createApi()} />)
    await user.click(screen.getByRole('button', { name: '03 Data Analytics' }))
    expect(await screen.findByRole('heading', { name: 'Data Analytics' })).toBeVisible()
  })

  it('opens every primary destination at the top of the main workspace', async () => {
    const user = userEvent.setup()
    render(<App api={createApi()} />)
    const main = document.querySelector('main')!
    main.scrollTop = 420

    await user.click(screen.getByRole('button', { name: '03 Data Analytics' }))

    expect(main.scrollTop).toBe(0)
    expect(await screen.findByRole('heading', { name: 'Data Analytics' })).toBeVisible()
  })

  it('opens the retained live-verified source directory', async () => {
    const user = userEvent.setup()
    render(<App api={createApi()} />)
    await user.click(screen.getByRole('button', { name: '04 Sources' }))
    expect(
      await screen.findByRole('heading', { name: '22 configured research sources' })
    ).toBeVisible()
    expect(screen.getAllByRole('article')).toHaveLength(22)
    expect(screen.getByRole('heading', { name: 'arXiv' })).toBeVisible()
    expect(screen.queryByText('X (Twitter)')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pending integrations/i })).not.toBeInTheDocument()
  })

  it('opens the source directory filtered to the recorded attention set from the sidebar', async () => {
    const user = userEvent.setup()
    render(
      <App
        api={createApi({
          ...emptyDashboard,
          sourceHealth: { arxiv: 'failed', github: 'healthy' },
          sourceHealthDetails: {
            arxiv: {
              status: 'failed',
              observedAt: '2026-08-24T08:30:00.000Z',
              errorMessage: 'Timed out after the bounded retry window'
            },
            github: {
              status: 'healthy',
              observedAt: '2026-08-24T08:31:00.000Z',
              errorMessage: null
            }
          }
        })}
      />
    )

    await user.click(await screen.findByRole('button', { name: 'Source attention needed' }))
    expect(screen.getByRole('button', { name: 'Show sources needing attention' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'arXiv' })).toBeVisible()
  })

  it('keeps account, sync, Today, and Interests surfaces absent', () => {
    render(<App api={createApi()} />)
    expect(screen.queryByRole('button', { name: /Today|Interests|Sync/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Google Drive|Sign in/i)).not.toBeInTheDocument()
  })
})

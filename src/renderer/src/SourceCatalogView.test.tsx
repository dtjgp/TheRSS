// @vitest-environment jsdom

import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DashboardSnapshot, SourceContentSnapshot, TheRSSApi } from '../../shared/api'
import { SourceCatalogView } from './SourceCatalogView'

function sourceSnapshot(
  source: SourceContentSnapshot['source'],
  overrides: Partial<SourceContentSnapshot> = {}
): SourceContentSnapshot {
  return {
    source,
    status: 'cached',
    windowDays: 30,
    windowStart: '2026-07-20T12:00:00.000Z',
    windowEnd: '2026-08-19T12:00:00.000Z',
    lastIndexedAt: '2026-08-19T10:00:00.000Z',
    returnedCount: 0,
    rejectedCount: 0,
    items: [],
    ...overrides
  }
}

function createSourceApi(
  initial: SourceContentSnapshot = sourceSnapshot('folo:302')
): Pick<TheRSSApi, 'getDashboard' | 'getSourceContent' | 'refreshSourceContent'> {
  return {
    getDashboard: vi.fn().mockResolvedValue({
      date: '2026-08-24',
      profileName: null,
      lastRefreshAt: null,
      sourceHealth: { arxiv: 'idle', github: 'idle', [initial.source]: 'healthy' },
      sourceHealthDetails: {
        arxiv: { status: 'idle', observedAt: null, errorMessage: null },
        github: { status: 'idle', observedAt: null, errorMessage: null },
        [initial.source]: {
          status: 'healthy',
          observedAt: '2026-08-24T12:00:00.000Z',
          errorMessage: null
        }
      },
      counts: { total: 0, arxiv: 0, github: 0, unread: 0 },
      items: [],
      savedItems: []
    }),
    getSourceContent: vi.fn().mockResolvedValue(initial),
    refreshSourceContent: vi.fn().mockResolvedValue(initial)
  }
}

function renderCatalog(
  api: Pick<
    TheRSSApi,
    'getDashboard' | 'getSourceContent' | 'refreshSourceContent'
  > = createSourceApi(),
  sourceHealth?: DashboardSnapshot['sourceHealth'],
  sourceHealthDetails?: DashboardSnapshot['sourceHealthDetails'],
  attentionOnly = false,
  onAttentionOnlyChange = vi.fn(),
  onDashboardChange = vi.fn()
) {
  return render(
    <SourceCatalogView
      api={api}
      sourceHealth={sourceHealth}
      sourceHealthDetails={sourceHealthDetails}
      attentionOnly={attentionOnly}
      onAttentionOnlyChange={onAttentionOnlyChange}
      onDashboardChange={onDashboardChange}
    />
  )
}

describe('SourceCatalogView', () => {
  it('provides one Tab stop in the source list and leaves source requests idle on entry', async () => {
    const user = userEvent.setup()
    const api = createSourceApi()
    renderCatalog(api)
    const options = within(
      screen.getByRole('listbox', { name: 'Configured sources' })
    ).getAllByRole('option')
    expect(options.filter((option) => option.tabIndex === 0)).toEqual([options[0]])

    screen.getByRole('combobox', { name: 'Research axis' }).focus()
    await user.tab()
    expect(options[0]).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Refresh recent content' })).toHaveFocus()
    expect(api.getSourceContent).not.toHaveBeenCalled()
    expect(api.refreshSourceContent).not.toHaveBeenCalled()
  })

  it('moves only focus with arrows, Home and End, including the first and last boundaries', async () => {
    const user = userEvent.setup()
    const api = createSourceApi()
    renderCatalog(api)
    const options = within(
      screen.getByRole('listbox', { name: 'Configured sources' })
    ).getAllByRole('option')
    options[0]!.focus()
    await user.keyboard('{ArrowUp}')
    expect(options[0]).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(options[1]).toHaveFocus()
    expect(options[1]).toHaveAttribute('aria-selected', 'false')
    expect(options.filter((option) => option.tabIndex === 0)).toEqual([options[1]])
    await user.keyboard('{Control>}{ArrowDown}{/Control}')
    expect(options[1]).toHaveFocus()
    await user.keyboard('{End}')
    expect(options.at(-1)).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(options.at(-1)).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(options.at(-2)).toHaveFocus()
    await user.keyboard('{Home}')
    expect(options[0]).toHaveFocus()
    expect(screen.getByRole('region', { name: 'arXiv source detail' })).toBeVisible()
    expect(api.getSourceContent).not.toHaveBeenCalled()
    expect(api.refreshSourceContent).not.toHaveBeenCalled()
  })

  it.each(['{Enter}', ' '])(
    'activates the focused source with %s and does not reload it when focus moves',
    async (key) => {
      const user = userEvent.setup()
      const api = createSourceApi(sourceSnapshot('github'))
      render(<SourceCatalogView api={api} sourceHealth={undefined} />)
      const list = screen.getByRole('listbox', { name: 'Configured sources' })
      const options = within(list).getAllByRole('option')
      options[0]!.focus()
      await user.keyboard('{ArrowDown}')
      const github = within(list).getByRole('option', { name: 'Browse GitHub recent content' })
      expect(github).toHaveFocus()
      expect(api.getSourceContent).not.toHaveBeenCalled()
      await user.keyboard(key)
      await waitFor(() => expect(api.getSourceContent).toHaveBeenCalledOnce())
      expect(api.getSourceContent).toHaveBeenCalledWith('github')
      expect(github).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('region', { name: 'GitHub source detail' })).toBeVisible()

      await user.keyboard('{ArrowDown}')
      expect(options[2]).toHaveFocus()
      expect(api.getSourceContent).toHaveBeenCalledOnce()
      expect(api.refreshSourceContent).not.toHaveBeenCalled()
      await user.tab()
      expect(screen.getByRole('link', { name: 'Open official source' })).toHaveFocus()
      await user.tab({ shift: true })
      expect(github).toHaveFocus()
    }
  )

  it('returns the Tab entry to the selected source or first visible source after filtering', async () => {
    const user = userEvent.setup()
    const api = createSourceApi(sourceSnapshot('github'))
    renderCatalog(api)
    const github = screen.getByRole('option', { name: 'Browse GitHub recent content' })
    await user.click(github)
    await user.keyboard('{End}')
    const search = screen.getByRole('searchbox', { name: 'Search source catalog' })
    await user.type(search, 'arXiv')
    const arxiv = screen.getByRole('option', { name: 'Browse arXiv recent content' })
    expect(arxiv).toHaveAttribute('tabindex', '0')
    expect(api.getSourceContent).toHaveBeenCalledOnce()
    await user.clear(search)
    const options = within(
      screen.getByRole('listbox', { name: 'Configured sources' })
    ).getAllByRole('option')
    expect(options.filter((option) => option.tabIndex === 0)).toEqual([github])
    expect(api.getSourceContent).toHaveBeenLastCalledWith('github')

    await user.type(search, 'no-such-retained-source')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByText('No catalog sources match these filters.')).toBeVisible()
    await user.clear(search)
    expect(screen.getByRole('option', { name: 'Browse GitHub recent content' })).toHaveAttribute(
      'tabindex',
      '0'
    )
  })

  it('keeps explicit refresh usable after local-index failure and reports the retry outcome', async () => {
    const user = userEvent.setup()
    const api = createSourceApi(sourceSnapshot('arxiv'))
    const onDashboardChange = vi.fn()
    vi.mocked(api.getSourceContent).mockRejectedValue(new Error('Local index unavailable'))
    vi.mocked(api.refreshSourceContent)
      .mockRejectedValueOnce(new Error('Source request timed out'))
      .mockResolvedValueOnce(sourceSnapshot('arxiv', { status: 'partial', lastIndexedAt: null }))
    renderCatalog(
      api,
      { arxiv: 'refreshing', github: 'no_results' },
      undefined,
      false,
      vi.fn(),
      onDashboardChange
    )
    await user.click(screen.getByRole('option', { name: 'Browse arXiv recent content' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Local index unavailable')
    expect(api.refreshSourceContent).not.toHaveBeenCalled()

    const refresh = screen.getByRole('button', { name: 'Refresh recent content' })
    await user.click(refresh)
    expect(await screen.findByRole('alert')).toHaveTextContent('Source request timed out')
    await user.click(refresh)
    expect(await screen.findByText('Fetched · partial')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText(/Latest indexed item: not yet indexed/u)).toBeVisible()
    expect(api.getSourceContent).toHaveBeenCalledOnce()
    expect(api.refreshSourceContent).toHaveBeenCalledTimes(2)
    expect(onDashboardChange).toHaveBeenCalledOnce()
  })

  it('keeps the configured source list and selected source detail visible together', async () => {
    const user = userEvent.setup()
    renderCatalog(createSourceApi(sourceSnapshot('arxiv')))

    const list = screen.getByRole('listbox', { name: 'Configured sources' })
    expect(within(list).getAllByRole('option')).toHaveLength(22)
    expect(
      within(list).getByRole('option', { name: /Browse arXiv recent content/i })
    ).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('region', { name: 'arXiv source detail' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Back to source directory' })
    ).not.toBeInTheDocument()

    await user.click(within(list).getByRole('option', { name: /Browse GitHub recent content/i }))
    expect(
      within(list).getByRole('option', { name: /Browse GitHub recent content/i })
    ).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('region', { name: 'GitHub source detail' })).toBeVisible()
  })

  it('shows only the 22 configured sources that passed the previous verification gate', () => {
    renderCatalog()

    expect(screen.getByRole('heading', { name: 'Sources' })).toBeVisible()
    expect(screen.getByText(/inspect the 22 retained sources/i)).toBeVisible()
    expect(screen.queryByText(/dated live-verification gate/i)).not.toBeInTheDocument()
    const summary = screen.getByRole('group', { name: 'Source catalog summary' })
    expect(within(summary).getByLabelText('Configured sources')).toHaveTextContent('22')
    expect(
      within(screen.getByRole('listbox', { name: 'Configured sources' })).getAllByRole('option')
    ).toHaveLength(22)
    expect(screen.queryByText('X (Twitter)')).not.toBeInTheDocument()
    expect(screen.queryByText('3GPP Specifications')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pending integrations/i })).not.toBeInTheDocument()
  })

  it('separates configured membership, current health, and cached index freshness', async () => {
    const user = userEvent.setup()
    const api = createSourceApi(sourceSnapshot('arxiv'))
    renderCatalog(api, {
      arxiv: 'failed',
      github: 'healthy',
      'folo:302': 'partial'
    })

    const summary = screen.getByRole('group', { name: 'Source catalog summary' })
    expect(within(summary).getByLabelText('Last recorded ready')).toHaveTextContent('1')
    expect(within(summary).getByLabelText('Failed or partial')).toHaveTextContent('2')
    expect(within(summary).getByLabelText('Not recorded')).toHaveTextContent('19')
    expect(screen.getByText(/catalog membership is not a live-health claim/i)).toBeVisible()

    await user.type(screen.getByRole('searchbox', { name: 'Search source catalog' }), 'arXiv')
    await user.click(screen.getByRole('option', { name: 'Browse arXiv recent content' }))

    expect(await screen.findByText('Last recorded · Time unavailable')).toBeVisible()
    expect(
      within(screen.getByRole('region', { name: 'arXiv source detail' })).getByText('Failed')
    ).toBeVisible()
    expect(screen.getByText('Cached snapshot')).toBeVisible()
    expect(screen.getByText(/does not prove that the source is currently reachable/i)).toBeVisible()
    expect(screen.getByText(/Latest indexed item:/i)).toBeVisible()
  })

  it('shows observed-at evidence and the bounded recorded failure reason', async () => {
    const api = createSourceApi(sourceSnapshot('arxiv'))
    renderCatalog(
      api,
      { arxiv: 'failed', github: 'idle' },
      {
        arxiv: {
          status: 'failed',
          observedAt: '2026-08-24T08:30:00.000Z',
          errorMessage: 'Timed out after the bounded retry window'
        },
        github: { status: 'idle', observedAt: null, errorMessage: null }
      }
    )

    expect(api.getSourceContent).not.toHaveBeenCalled()
    expect(await screen.findByText(/2026-08-24 08:30 UTC/i)).toBeVisible()
    expect(screen.getByText('Timed out after the bounded retry window')).toBeVisible()
  })

  it('filters to sources needing attention through a controlled accessible filter', async () => {
    const onAttentionOnlyChange = vi.fn()
    const user = userEvent.setup()
    renderCatalog(
      createSourceApi(),
      { arxiv: 'failed', github: 'healthy', 'folo:302': 'partial' },
      undefined,
      true,
      onAttentionOnlyChange
    )

    expect(
      within(screen.getByRole('listbox', { name: 'Configured sources' })).getAllByRole('option')
    ).toHaveLength(2)
    const filter = screen.getByRole('button', { name: 'Show failed or partial sources' })
    expect(filter).toHaveAttribute('aria-pressed', 'true')
    await user.click(filter)
    expect(onAttentionOnlyChange).toHaveBeenCalledWith(false)
  })

  it('uses full research-area names and keeps adapter provenance out of directory cards', async () => {
    const user = userEvent.setup()
    renderCatalog()
    await user.type(screen.getByRole('searchbox', { name: 'Search source catalog' }), 'OpenAI')

    const sourceOption = screen.getByRole('option', { name: 'Browse OpenAI recent content' })
    expect(sourceOption).toHaveTextContent('Model compression & edge AI')
    expect(sourceOption).toHaveTextContent('Agents & behavior')
    expect(sourceOption).not.toHaveTextContent('Folo 1543')
    expect(sourceOption).not.toHaveTextContent('Active adapter')

    await user.click(sourceOption)
    const provenance = await screen.findByText('Source provenance')
    await user.click(provenance)
    expect(screen.getByText(/Folo 1543/u)).toBeVisible()
  })

  it('filters the retained set by text, priority, and research axis', async () => {
    const user = userEvent.setup()
    renderCatalog()

    await user.type(screen.getByRole('searchbox', { name: 'Search source catalog' }), 'OpenAI')
    expect(
      within(screen.getByRole('listbox', { name: 'Configured sources' })).getAllByRole('option')
    ).toHaveLength(1)
    expect(screen.getByRole('option', { name: 'Browse OpenAI recent content' })).toBeVisible()

    await user.clear(screen.getByRole('searchbox', { name: 'Search source catalog' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'A')
    expect(
      within(screen.getByRole('listbox', { name: 'Configured sources' })).getAllByRole('option')
    ).toHaveLength(7)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'all')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Research axis' }), 'SG')
    expect(
      within(screen.getByRole('listbox', { name: 'Configured sources' })).getAllByRole('option')
    ).toHaveLength(9)
    expect(
      screen.getByRole('option', {
        name: 'Browse National Bureau of Economic Research recent content'
      })
    ).toBeVisible()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Research axis' }), 'all')
    expect(
      within(screen.getByRole('listbox', { name: 'Configured sources' })).getAllByRole('option')
    ).toHaveLength(22)
    expect(screen.getByRole('option', { name: 'Browse arXiv recent content' })).toBeVisible()
    expect(screen.getByRole('option', { name: 'Browse GitHub recent content' })).toBeVisible()
  })

  it("refreshes today's arXiv papers without requiring or applying Interests", async () => {
    const user = userEvent.setup()
    const api = createSourceApi(
      sourceSnapshot('arxiv', {
        windowDays: 1,
        windowStart: '2026-08-19T00:00:00.000Z',
        items: []
      })
    )
    renderCatalog(api)

    await user.type(screen.getByRole('searchbox', { name: 'Search source catalog' }), 'arXiv')
    await user.click(screen.getByRole('option', { name: 'Browse arXiv recent content' }))

    expect(api.getSourceContent).toHaveBeenCalledWith('arxiv')
    expect(api.refreshSourceContent).toHaveBeenCalledWith('arxiv')
    expect(await screen.findByText(/today's newest available arXiv daily batch/i)).toBeVisible()
    expect(screen.getByText(/without applying a Discover plan/i)).toBeVisible()
    expect(screen.queryByText(/Configure Interests before refreshing/i)).not.toBeInTheDocument()
  })

  it('keeps GitHub browsing independent of the retired Interests surface', async () => {
    const user = userEvent.setup()
    const api = createSourceApi(sourceSnapshot('github'))
    renderCatalog(api)

    await user.type(screen.getByRole('searchbox', { name: 'Search source catalog' }), 'GitHub')
    await user.click(screen.getByRole('option', { name: 'Browse GitHub recent content' }))

    expect(api.getSourceContent).toHaveBeenCalledWith('github')
    expect(api.refreshSourceContent).not.toHaveBeenCalled()
    expect(await screen.findByText(/search GitHub from Discover/i)).toBeVisible()
    expect(screen.queryByText(/Configure Interests/i)).not.toBeInTheDocument()
  })

  it('opens an active source inside the app and displays its indexed 30-day content', async () => {
    const user = userEvent.setup()
    const snapshot = sourceSnapshot('folo:302', {
      items: [
        {
          id: 'folo:302:article:recent',
          source: 'folo:302',
          kind: 'article',
          title: 'BAAI edge intelligence update',
          summary: 'A bounded source-provided summary shown inside TheRSS.',
          url: 'https://www.baai.ac.cn/news/recent',
          publishedAt: '2026-08-18T08:00:00.000Z',
          updatedAt: '2026-08-19T08:00:00.000Z',
          score: 32,
          triageState: 'new',
          reasons: ['Published recently']
        }
      ]
    })
    const api = createSourceApi(snapshot)
    renderCatalog(api)

    await user.type(screen.getByRole('searchbox', { name: 'Search source catalog' }), '北京智源')
    await user.click(
      screen.getByRole('option', { name: 'Browse 北京智源人工智能研究院 recent content' })
    )

    expect(api.getSourceContent).toHaveBeenCalledWith('folo:302')
    expect(await screen.findByRole('heading', { name: '北京智源人工智能研究院' })).toBeVisible()
    expect(screen.getByText('BAAI edge intelligence update')).toBeVisible()
    expect(screen.getByText(/bounded source-provided summary/i)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open original item' })).toHaveAttribute(
      'href',
      'https://www.baai.ac.cn/news/recent'
    )

    expect(screen.getByRole('listbox', { name: 'Configured sources' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Back to source directory' })
    ).not.toBeInTheDocument()
  })

  it('automatically refreshes an empty active non-metered source', async () => {
    const user = userEvent.setup()
    const api = createSourceApi(sourceSnapshot('folo:182'))
    vi.mocked(api.refreshSourceContent).mockResolvedValue(
      sourceSnapshot('folo:182', {
        status: 'fetched',
        returnedCount: 1,
        lastIndexedAt: '2026-08-19T12:00:00.000Z',
        items: [
          {
            id: 'folo:182:article:recent',
            source: 'folo:182',
            kind: 'article',
            title: 'OpenAI recent update',
            summary: 'A recent OpenAI source item.',
            url: 'https://openai.com/news/recent',
            publishedAt: '2026-08-19T10:00:00.000Z',
            updatedAt: '2026-08-19T10:00:00.000Z',
            score: 20,
            triageState: 'new',
            reasons: ['Published today']
          }
        ]
      })
    )
    renderCatalog(api)

    await user.type(screen.getByRole('searchbox', { name: 'Search source catalog' }), 'OpenAI')
    await user.click(screen.getByRole('option', { name: 'Browse OpenAI recent content' }))

    expect(await screen.findByText('OpenAI recent update')).toBeVisible()
    expect(api.refreshSourceContent).toHaveBeenCalledWith('folo:182')
    await waitFor(() => expect(api.getDashboard).toHaveBeenCalledOnce())
  })

  it('shows the bounded real source error instead of a generic empty-state message', async () => {
    const user = userEvent.setup()
    const api = createSourceApi(sourceSnapshot('folo:611'))
    vi.mocked(api.refreshSourceContent).mockRejectedValue(
      new Error('Configured source folo:611 timed out after primary and fallback attempts')
    )
    renderCatalog(api)

    await user.type(
      screen.getByRole('searchbox', { name: 'Search source catalog' }),
      '国家哲学社会科学文献中心'
    )
    await user.click(
      screen.getByRole('option', {
        name: 'Browse 国家哲学社会科学文献中心 recent content'
      })
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Configured source folo:611 timed out after primary and fallback attempts'
    )
  })
})

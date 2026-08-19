// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SourceContentSnapshot, TheRSSApi } from '../../shared/api'
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
): Pick<TheRSSApi, 'getSourceContent' | 'refreshSourceContent'> {
  return {
    getSourceContent: vi.fn().mockResolvedValue(initial),
    refreshSourceContent: vi.fn().mockResolvedValue(initial)
  }
}

function renderCatalog(
  api: Pick<TheRSSApi, 'getSourceContent' | 'refreshSourceContent'> = createSourceApi()
) {
  return render(<SourceCatalogView api={api} />)
}

describe('SourceCatalogView', () => {
  it('shows only the 22 previously live-verified sources', () => {
    renderCatalog()

    expect(screen.getByRole('heading', { name: '22 live-verified research sources' })).toBeVisible()
    const summary = screen.getByRole('group', { name: 'Source catalog summary' })
    expect(within(summary).getByLabelText('Live-verified sources')).toHaveTextContent('22')
    expect(screen.getAllByRole('article')).toHaveLength(22)
    expect(screen.queryByText('X (Twitter)')).not.toBeInTheDocument()
    expect(screen.queryByText('3GPP Specifications')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pending integrations/i })).not.toBeInTheDocument()
  })

  it('filters the retained set by text, priority, and research axis', async () => {
    const user = userEvent.setup()
    renderCatalog()

    await user.type(screen.getByRole('searchbox', { name: 'Search source catalog' }), 'OpenAI')
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'OpenAI' })).toBeVisible()

    await user.clear(screen.getByRole('searchbox', { name: 'Search source catalog' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'A')
    expect(screen.getAllByRole('article')).toHaveLength(7)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'all')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Research axis' }), 'SG')
    expect(screen.getAllByRole('article')).toHaveLength(9)
    expect(
      screen.getByRole('heading', { name: 'National Bureau of Economic Research' })
    ).toBeVisible()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Research axis' }), 'all')
    expect(screen.getAllByRole('article')).toHaveLength(22)
    expect(screen.getByRole('heading', { name: 'arXiv' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'GitHub' })).toBeVisible()
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
    await user.click(screen.getByRole('button', { name: 'Browse arXiv recent content' }))

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
    await user.click(screen.getByRole('button', { name: 'Browse GitHub recent content' }))

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
      screen.getByRole('button', { name: 'Browse 北京智源人工智能研究院 recent content' })
    )

    expect(api.getSourceContent).toHaveBeenCalledWith('folo:302')
    expect(await screen.findByRole('heading', { name: '北京智源人工智能研究院' })).toBeVisible()
    expect(screen.getByText('BAAI edge intelligence update')).toBeVisible()
    expect(screen.getByText(/bounded source-provided summary/i)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open original item' })).toHaveAttribute(
      'href',
      'https://www.baai.ac.cn/news/recent'
    )

    await user.click(screen.getByRole('button', { name: 'Back to source directory' }))
    expect(screen.getByRole('heading', { name: '22 live-verified research sources' })).toBeVisible()
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
    await user.click(screen.getByRole('button', { name: 'Browse OpenAI recent content' }))

    expect(await screen.findByText('OpenAI recent update')).toBeVisible()
    expect(api.refreshSourceContent).toHaveBeenCalledWith('folo:182')
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
      screen.getByRole('button', {
        name: 'Browse 国家哲学社会科学文献中心 recent content'
      })
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Configured source folo:611 timed out after primary and fallback attempts'
    )
  })
})

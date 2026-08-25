// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DashboardSnapshot } from '../../shared/api'
import { ACTIVE_TODAY_SOURCE_IDS } from '../../shared/sourceIdentity'
import { AppTopbar } from './AppTopbar'
import { emptyDashboard } from './App.testSupport'

function dashboardWithHealth(
  overrides: Partial<DashboardSnapshot['sourceHealth']> = {}
): DashboardSnapshot {
  return {
    ...emptyDashboard,
    sourceHealth: Object.fromEntries(
      ACTIVE_TODAY_SOURCE_IDS.map((source) => [source, overrides[source] ?? 'healthy'])
    ) as DashboardSnapshot['sourceHealth']
  }
}

const defaultProps = {
  activeView: 'discover' as const,
  dashboard: dashboardWithHealth(),
  date: '2026-08-25',
  isSidebarCollapsed: false,
  onToggleSidebar: vi.fn(),
  savedCount: 4,
  savedFilterLabel: 'All sources',
  settingsDirty: false
}

describe('AppTopbar', () => {
  it('shows compact text-labelled context for every application view', () => {
    const { rerender } = render(<AppTopbar {...defaultProps} />)
    const status = screen.getByRole('group', { name: 'View context' })

    expect(within(status).getByText('22 sources')).toBeVisible()
    expect(within(status).getByText('Sources ready')).toBeVisible()
    expect(status).toHaveAttribute('data-tone', 'ready')
    expect(status).not.toHaveAttribute('aria-live')

    rerender(<AppTopbar {...defaultProps} activeView="saved" />)
    expect(within(status).getByText('4 saved')).toBeVisible()
    expect(within(status).getByText('All sources')).toBeVisible()

    rerender(<AppTopbar {...defaultProps} activeView="analytics" />)
    expect(within(status).getByText('Local only')).toBeVisible()
    expect(within(status).getByText('No telemetry')).toBeVisible()

    rerender(
      <AppTopbar
        {...defaultProps}
        activeView="sources"
        dashboard={dashboardWithHealth({ arxiv: 'failed', github: 'partial' })}
      />
    )
    expect(within(status).getByText('2 need attention')).toBeVisible()
    expect(within(status).getByText('22 configured')).toBeVisible()
    expect(status).toHaveAttribute('data-tone', 'attention')

    rerender(<AppTopbar {...defaultProps} activeView="settings" settingsDirty />)
    expect(within(status).getByText('Unsaved changes')).toBeVisible()
    expect(within(status).getByText('Review before leaving')).toBeVisible()
    expect(within(status).getByRole('status')).toHaveTextContent('Unsaved changes')
    expect(status).toHaveAttribute('data-tone', 'attention')
  })

  it('keeps missing local state explicit and toggles the sidebar accessibly', async () => {
    const onToggleSidebar = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <AppTopbar {...defaultProps} dashboard={null} date={null} onToggleSidebar={onToggleSidebar} />
    )

    expect(screen.getByText('Loading local index…')).toBeVisible()
    expect(screen.getByRole('group', { name: 'View context' })).toHaveTextContent(
      'Opening local index'
    )

    await user.click(screen.getByRole('button', { name: 'Hide sidebar' }))
    expect(onToggleSidebar).toHaveBeenCalledOnce()

    rerender(
      <AppTopbar
        {...defaultProps}
        dashboard={null}
        date={null}
        isSidebarCollapsed
        onToggleSidebar={onToggleSidebar}
      />
    )
    expect(screen.getByRole('button', { name: 'Show sidebar' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})

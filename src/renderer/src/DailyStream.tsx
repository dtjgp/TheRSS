import type { DashboardItem, TriageState } from '../../shared/api'
import type { DiscoverySource } from '../../shared/discovery'
import { sourceDisplayName, sourceStyleToken } from '../../shared/sourceIdentity'

interface DailyStreamProps {
  readonly items: readonly DashboardItem[]
  readonly dashboardDate: string
  readonly lastRefreshAt: string | null
  readonly selectedItemId: string | null
  readonly onSelect: (item: DashboardItem) => void
}

const stateLabels: Readonly<Record<TriageState, string>> = {
  new: 'New',
  viewed: 'Viewed',
  saved: 'Saved',
  dismissed: 'Dismissed'
}

function timestampValue(value: string): number {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(parsed)
}

function formatEditionDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(parsed)
}

function groupBySource(items: readonly DashboardItem[]) {
  const groups = new Map<DiscoverySource, DashboardItem[]>()
  for (const item of items) groups.set(item.source, [...(groups.get(item.source) ?? []), item])
  return [...groups.entries()]
    .map(([source, sourceItems]) => ({
      source,
      items: sourceItems.sort((left, right) => {
        const difference = timestampValue(right.publishedAt) - timestampValue(left.publishedAt)
        return difference || right.score - left.score || left.id.localeCompare(right.id)
      })
    }))
    .sort((left, right) => {
      const difference =
        timestampValue(right.items[0]?.publishedAt ?? '') -
        timestampValue(left.items[0]?.publishedAt ?? '')
      return (
        difference || sourceDisplayName(left.source).localeCompare(sourceDisplayName(right.source))
      )
    })
}

export function DailyStream({
  items,
  dashboardDate,
  lastRefreshAt,
  selectedItemId,
  onSelect
}: DailyStreamProps) {
  const groups = groupBySource(items)
  const unreadCount = items.filter((item) => item.triageState === 'new').length

  return (
    <aside className="daily-stream" aria-label="Daily stream">
      <header className="daily-stream__header">
        <div className="daily-stream__dateline">
          <p className="eyebrow">DAILY STREAM</p>
          <time dateTime={dashboardDate}>{formatEditionDate(dashboardDate)}</time>
        </div>
        <h2>Today at a glance</h2>
        <p className="daily-stream__scope">Every record returned in the current Today edition.</p>
        <div className="daily-stream__metrics" aria-label="Daily stream counts">
          <strong>{items.length} returned</strong>
          <span>{unreadCount} unread</span>
          <span>{groups.length} sources</span>
        </div>
      </header>

      <div className="daily-stream__body">
        {groups.length === 0 ? (
          <p className="daily-stream__empty">No returned items in this edition.</p>
        ) : (
          <ol className="daily-stream__groups">
            {groups.map((group) => (
              <li className="daily-stream__group" key={group.source}>
                <h3>
                  <span>{sourceDisplayName(group.source)}</span>
                  <small>{group.items.length}</small>
                </h3>
                <ol className="daily-stream__list">
                  {group.items.map((item) => {
                    const isSelected = item.id === selectedItemId
                    return (
                      <li
                        key={item.id}
                        className={`daily-stream__entry ${isSelected ? 'daily-stream__entry--selected' : ''}`}
                      >
                        <button
                          type="button"
                          aria-current={isSelected ? 'true' : undefined}
                          aria-label={`Open in daily workspace: ${item.title}`}
                          onClick={() => onSelect(item)}
                        >
                          <span className="daily-stream__rail" aria-hidden="true">
                            <span />
                          </span>
                          <span className="daily-stream__content">
                            <span className="daily-stream__item-meta">
                              <span
                                className={`daily-stream__source daily-stream__source--${sourceStyleToken(item.source)}`}
                              >
                                {sourceDisplayName(item.source).toLocaleUpperCase()}
                              </span>
                              <time dateTime={item.publishedAt}>
                                {formatDate(item.publishedAt)}
                              </time>
                            </span>
                            <strong>{item.title}</strong>
                            <span
                              className={`daily-stream__state daily-stream__state--${item.triageState}`}
                            >
                              {stateLabels[item.triageState]}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </li>
            ))}
          </ol>
        )}
      </div>

      <footer className="daily-stream__footer">
        <span>Grouped by source · newest groups first</span>
        <span>
          {lastRefreshAt ? `Refreshed ${formatDate(lastRefreshAt)}` : 'Not refreshed yet'}
        </span>
      </footer>
    </aside>
  )
}

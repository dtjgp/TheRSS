import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Sparkles } from 'lucide-react'
import type { TheRSSApi } from '../../shared/api'
import type { DiscoverResultItem } from '../../shared/discover'
import type { AnalysisArtifact } from '../../shared/models'
import { sourceDisplayName, sourceStyleToken } from '../../shared/sourceIdentity'
import { AnalysisPanel } from './AppSections'
import { PaperPromotionAction } from './PaperPromotionAction'
import { ResizableSplitPane } from './ResizableSplitPane'
import { SaveStar } from './SaveStar'

interface DiscoverResultWorkspaceProps {
  readonly api: TheRSSApi
  readonly items: readonly DiscoverResultItem[]
  readonly analysis: AnalysisArtifact | null
  readonly analyzingItemId: string | null
  readonly savingItemId: string | null
  readonly isSaveDisabled: boolean
  readonly sessionId: string
  readonly onToggleSave: (itemId: string) => Promise<void>
  readonly onAnalyze: (itemId: string) => Promise<void>
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  )
}

function resultKindLabel(item: DiscoverResultItem): string {
  if (item.kind === 'repository') return 'Repository'
  return item.kind.charAt(0).toUpperCase() + item.kind.slice(1)
}

function SourceMark({ source }: { readonly source: DiscoverResultItem['source'] }) {
  return (
    <span className={`source-mark source-mark--${sourceStyleToken(source)}`}>
      {sourceDisplayName(source).toLocaleUpperCase()}
    </span>
  )
}

function DiscoverResultRow({
  item,
  isSelected,
  onSelect,
  onShowContextMenu
}: {
  readonly item: DiscoverResultItem
  readonly isSelected: boolean
  readonly onSelect: () => void
  readonly onShowContextMenu: () => void
}) {
  return (
    <li
      className={`signal-row ${isSelected ? 'signal-row--selected' : ''}`}
      data-testid="discover-result"
      onContextMenu={(event) => {
        event.preventDefault()
        onShowContextMenu()
      }}
    >
      <button
        type="button"
        className="signal-row__select"
        aria-current={isSelected ? 'true' : undefined}
        aria-label={`Select result: ${item.title}`}
        data-discover-result-id={item.id}
        tabIndex={isSelected ? 0 : -1}
        onClick={onSelect}
      >
        <span className="signal-row__meta">
          <SourceMark source={item.source} />
          <time dateTime={item.publishedAt}>{new Date(item.publishedAt).toLocaleDateString()}</time>
          <span>{resultKindLabel(item)}</span>
          <span className="signal-row__score">{item.score}</span>
        </span>
        <strong>{item.title}</strong>
        <span className="signal-row__summary">{item.summary}</span>
        <span className="signal-row__state">{item.saved ? 'Saved' : 'Discover result'}</span>
      </button>
    </li>
  )
}

export function DiscoverResultWorkspace({
  api,
  items,
  analysis,
  analyzingItemId,
  savingItemId,
  isSaveDisabled,
  sessionId,
  onToggleSave,
  onAnalyze
}: DiscoverResultWorkspaceProps) {
  const workspaceRef = useRef<HTMLDivElement>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(items[0]?.id ?? null)
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(null)
  const resolvedSelectedItemId = items.some((item) => item.id === selectedItemId)
    ? selectedItemId
    : (items[0]?.id ?? null)
  const selectedIndex = useMemo(() => {
    const matchedIndex = items.findIndex((item) => item.id === resolvedSelectedItemId)
    return matchedIndex >= 0 ? matchedIndex : 0
  }, [items, resolvedSelectedItemId])
  const selectedItem = items[selectedIndex] ?? null

  const selectItem = useCallback((item: DiscoverResultItem, moveFocus: boolean) => {
    setExpandedSummaryId(null)
    setSelectedItemId(item.id)
    if (!moveFocus) return
    queueMicrotask(() => {
      const row = Array.from(
        workspaceRef.current?.querySelectorAll<HTMLButtonElement>('[data-discover-result-id]') ?? []
      ).find((candidate) => candidate.dataset.discoverResultId === item.id)
      row?.focus()
    })
  }, [])

  useEffect(() => {
    const handleKeyboardNavigation = (event: KeyboardEvent) => {
      const target = event.target
      if (
        !selectedItem ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(target) ||
        (target instanceof HTMLElement &&
          target !== document.body &&
          !workspaceRef.current?.contains(target))
      ) {
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault()
        const nextItem = items[Math.min(selectedIndex + 1, items.length - 1)]
        if (nextItem) selectItem(nextItem, true)
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault()
        const previousItem = items[Math.max(selectedIndex - 1, 0)]
        if (previousItem) selectItem(previousItem, true)
      }
    }

    window.addEventListener('keydown', handleKeyboardNavigation)
    return () => window.removeEventListener('keydown', handleKeyboardNavigation)
  }, [items, selectItem, selectedIndex, selectedItem])

  const showItemContextMenu = useCallback(
    (item: DiscoverResultItem) => {
      void api
        .showContextMenu({
          kind: 'discover-result',
          itemId: item.id,
          sessionId,
          title: item.title,
          url: item.url,
          sourceLabel: sourceDisplayName(item.source),
          publishedAt: item.publishedAt,
          isSaved: item.saved,
          canAnalyze: item.kind === 'paper',
          // Promotion retains its dedicated preview and confirmation implementation.
          canPromote: false
        })
        .then((outcome) => {
          if (outcome.action === 'save' || outcome.action === 'unsave') {
            return onToggleSave(item.id)
          }
          if (outcome.action === 'analyze') return onAnalyze(item.id)
          return undefined
        })
        .catch(() => undefined)
    },
    [api, onAnalyze, onToggleSave, sessionId]
  )

  if (!selectedItem) return null

  const canCollapseSummary = selectedItem.summary.length > 420
  const isSummaryExpanded = expandedSummaryId === selectedItem.id
  const isFullSummaryVisible = !canCollapseSummary || isSummaryExpanded
  const selectedAnalysis = analysis?.itemId === selectedItem.id ? analysis : null
  const promotionStatusTargetId = `discover-promotion-status-${selectedItem.id.replaceAll(
    /[^A-Za-z0-9_-]/gu,
    '-'
  )}`

  return (
    <ResizableSplitPane
      ariaLabel="Resize Discover result list"
      storageKey="therss.discover-list-width"
      containerRef={workspaceRef}
      className="signal-workspace discover-result-workspace"
      before={
        <aside className="signal-list-pane" aria-label="Discover result list pane">
          <div className="signal-list-pane__heading">
            <div>
              <strong>{items.length} results</strong>
              <span>
                {selectedIndex + 1} of {items.length}
              </span>
            </div>
            <span>Use arrow keys to move</span>
          </div>
          <ol className="signal-list" aria-label="Discover result list">
            {items.map((item) => (
              <DiscoverResultRow
                key={item.id}
                item={item}
                isSelected={item.id === selectedItem.id}
                onSelect={() => selectItem(item, false)}
                onShowContextMenu={() => {
                  selectItem(item, false)
                  showItemContextMenu(item)
                }}
              />
            ))}
          </ol>
        </aside>
      }
      after={
        <article
          className="signal-detail discover-result-detail"
          aria-label="Selected Discover result"
          onContextMenu={(event) => {
            event.preventDefault()
            showItemContextMenu(selectedItem)
          }}
        >
          <header className="signal-detail__header">
            <div className="signal-detail__meta">
              <SourceMark source={selectedItem.source} />
              <time dateTime={selectedItem.publishedAt}>
                {new Date(selectedItem.publishedAt).toLocaleDateString()}
              </time>
              <span>{resultKindLabel(selectedItem)}</span>
              <span>signal {selectedItem.score}</span>
            </div>
            <span className="signal-detail__position">
              {selectedIndex + 1} of {items.length}
            </span>
          </header>

          <h3 className="signal-detail__title">
            <a href={selectedItem.url} target="_blank" rel="noreferrer">
              {selectedItem.title}
              <ExternalLink aria-hidden="true" size={17} strokeWidth={1.8} />
            </a>
          </h3>

          <div className="signal-detail__actions">
            <button
              type="button"
              className="detail-action detail-action--primary save-button"
              aria-label={selectedItem.saved ? 'Remove result from Saved' : 'Save result'}
              aria-pressed={selectedItem.saved}
              aria-busy={savingItemId === selectedItem.id}
              title={selectedItem.saved ? 'Remove from Saved' : 'Save this result'}
              disabled={isSaveDisabled}
              onClick={() => void onToggleSave(selectedItem.id)}
            >
              <SaveStar isSaved={selectedItem.saved} />
            </button>
            {selectedItem.kind === 'paper' ? (
              <button
                type="button"
                className="detail-action"
                aria-label="Analyze paper"
                disabled={analyzingItemId === selectedItem.id}
                onClick={() => void onAnalyze(selectedItem.id)}
              >
                <Sparkles aria-hidden="true" size={17} strokeWidth={1.8} />
                <span>{analyzingItemId === selectedItem.id ? 'Analyzing…' : 'Analyze paper'}</span>
              </button>
            ) : null}
            {selectedItem.source === 'arxiv' && selectedItem.kind === 'paper' ? (
              <PaperPromotionAction
                api={api}
                itemId={selectedItem.id}
                sessionId={sessionId}
                statusTargetId={promotionStatusTargetId}
              />
            ) : null}
          </div>
          <div
            id={promotionStatusTargetId}
            className="signal-detail__promotion-status"
            aria-live="polite"
          />

          <p className="signal-detail__summary" data-expanded={String(isFullSummaryVisible)}>
            {selectedItem.summary}
          </p>
          {canCollapseSummary ? (
            <button
              type="button"
              className="signal-detail__summary-toggle"
              aria-expanded={isSummaryExpanded}
              onClick={() =>
                setExpandedSummaryId((current) =>
                  current === selectedItem.id ? null : selectedItem.id
                )
              }
            >
              {isSummaryExpanded ? 'Collapse summary' : 'Show full summary'}
            </button>
          ) : null}

          {selectedAnalysis ? <AnalysisPanel artifact={selectedAnalysis} /> : null}

          <section className="signal-detail__reasons" aria-label="Discover match reasons">
            <span className="signal-detail__section-label">Why this matched</span>
            <ul>
              {selectedItem.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>
        </article>
      }
    />
  )
}

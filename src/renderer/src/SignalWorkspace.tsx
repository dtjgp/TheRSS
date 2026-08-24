import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, EyeOff, Sparkles } from 'lucide-react'
import type { DashboardItem, TheRSSApi, TriageState } from '../../shared/api'
import type { AnalysisArtifact } from '../../shared/models'
import { isPaperAnalysisCandidate, PAPER_L1_ANALYSIS_PROMPT_VERSION } from '../../shared/analysis'
import { AnalysisPanel } from './AppSections'
import { SaveStar } from './SaveStar'
import { sourceDisplayName, sourceStyleToken } from '../../shared/sourceIdentity'
import { PaperPromotionAction } from './PaperPromotionAction'
import { ResizableSplitPane } from './ResizableSplitPane'

interface SignalWorkspaceProps {
  readonly api: TheRSSApi
  readonly items: readonly DashboardItem[]
  readonly analysis: AnalysisArtifact | null
  readonly analyzingItemId: string | null
  readonly selectedItemId: string | null
  readonly onAnalyze: (id: string) => Promise<void>
  readonly onTriage: (id: string, state: TriageState) => Promise<void>
  readonly onSelectionChange: (id: string) => void
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

function SourceMark({ source }: { readonly source: DashboardItem['source'] }) {
  return (
    <span className={`source-mark source-mark--${sourceStyleToken(source)}`}>
      {sourceDisplayName(source).toLocaleUpperCase()}
    </span>
  )
}

function SignalListItem({
  item,
  isSelected,
  onSelect
}: {
  readonly item: DashboardItem
  readonly isSelected: boolean
  readonly onSelect: () => void
}) {
  return (
    <li className={`signal-row ${isSelected ? 'signal-row--selected' : ''}`}>
      <button
        type="button"
        className="signal-row__select"
        aria-current={isSelected ? 'true' : undefined}
        aria-label={`Select signal: ${item.title}`}
        data-signal-id={item.id}
        tabIndex={isSelected ? 0 : -1}
        onClick={onSelect}
      >
        <span className="signal-row__meta">
          <SourceMark source={item.source} />
          <time dateTime={item.publishedAt}>{new Date(item.publishedAt).toLocaleDateString()}</time>
          <span className="signal-row__score">{item.score}</span>
        </span>
        <strong>{item.title}</strong>
        <span className="signal-row__summary">{item.summary}</span>
        <span className="signal-row__state">
          {item.triageState === 'saved'
            ? 'Saved'
            : item.triageState === 'new'
              ? 'Unread'
              : 'Viewed'}
        </span>
      </button>
    </li>
  )
}

function ShortcutHint({ keyName, label }: { readonly keyName: string; readonly label: string }) {
  return (
    <span>
      <kbd>{keyName}</kbd>
      {label}
    </span>
  )
}

export function SignalWorkspace({
  api,
  items,
  analysis,
  analyzingItemId,
  selectedItemId,
  onAnalyze,
  onTriage,
  onSelectionChange
}: SignalWorkspaceProps) {
  const workspaceRef = useRef<HTMLDivElement>(null)
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(null)
  const selectedIndex = useMemo(() => {
    const matchedIndex = items.findIndex((item) => item.id === selectedItemId)
    return matchedIndex >= 0 ? matchedIndex : 0
  }, [items, selectedItemId])
  const selectedItem = items[selectedIndex] ?? null

  useEffect(() => {
    if (!selectedItem) return
    onSelectionChange(selectedItem.id)
  }, [onSelectionChange, selectedItem])

  const selectItem = useCallback(
    (item: DashboardItem, moveFocus: boolean) => {
      setExpandedSummaryId(null)
      onSelectionChange(item.id)
      if (item.triageState === 'new') void onTriage(item.id, 'viewed')
      if (moveFocus) {
        queueMicrotask(() => {
          const row = Array.from(
            workspaceRef.current?.querySelectorAll<HTMLButtonElement>('[data-signal-id]') ?? []
          ).find((candidate) => candidate.dataset.signalId === item.id)
          row?.focus()
        })
      }
    },
    [onSelectionChange, onTriage]
  )

  useEffect(() => {
    const handleKeyboardTriage = (event: KeyboardEvent) => {
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
        return
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault()
        const previousItem = items[Math.max(selectedIndex - 1, 0)]
        if (previousItem) selectItem(previousItem, true)
        return
      }

      if (event.repeat) return

      switch (event.key.toLowerCase()) {
        case 's':
          event.preventDefault()
          void onTriage(selectedItem.id, selectedItem.triageState === 'saved' ? 'viewed' : 'saved')
          break
        case 'd':
          event.preventDefault()
          void onTriage(selectedItem.id, 'dismissed')
          break
        case 'a':
          event.preventDefault()
          void onAnalyze(selectedItem.id)
          break
      }
    }

    window.addEventListener('keydown', handleKeyboardTriage)
    return () => window.removeEventListener('keydown', handleKeyboardTriage)
  }, [items, onAnalyze, onTriage, selectItem, selectedIndex, selectedItem])

  if (!selectedItem) return null

  const isSaved = selectedItem.triageState === 'saved'
  const isPaper = isPaperAnalysisCandidate(selectedItem)
  const isSummaryExpanded = expandedSummaryId === selectedItem.id
  const canCollapseSummary = selectedItem.summary.length > 420
  const isFullSummaryVisible = !canCollapseSummary || isSummaryExpanded
  const selectedAnalysis = analysis?.itemId === selectedItem.id ? analysis : null
  const paperL1Analysis =
    isPaper && selectedAnalysis?.promptVersion === PAPER_L1_ANALYSIS_PROMPT_VERSION
      ? selectedAnalysis
      : null
  const promotionStatusTargetId = `promotion-status-${selectedItem.id.replaceAll(/[^A-Za-z0-9_-]/gu, '-')}`

  return (
    <ResizableSplitPane
      ariaLabel="Resize saved signal list"
      storageKey="therss.saved-list-width"
      containerRef={workspaceRef}
      className="signal-workspace"
      before={
        <aside className="signal-list-pane" aria-label="Research signal list">
          <div className="signal-list-pane__heading">
            <div>
              <strong>{items.length} signals</strong>
              <span>
                {selectedIndex + 1} of {items.length}
              </span>
            </div>
            <span>Use arrow keys to move</span>
          </div>
          <ol className="signal-list">
            {items.map((item) => (
              <SignalListItem
                key={item.id}
                item={item}
                isSelected={item.id === selectedItem.id}
                onSelect={() => selectItem(item, false)}
              />
            ))}
          </ol>
        </aside>
      }
      after={
        <article className="signal-detail" aria-label="Selected signal details">
          <header className="signal-detail__header">
            <div className="signal-detail__meta">
              <SourceMark source={selectedItem.source} />
              <time dateTime={selectedItem.publishedAt}>
                {new Date(selectedItem.publishedAt).toLocaleDateString()}
              </time>
              <span>signal {selectedItem.score}</span>
            </div>
            <span className="signal-detail__position">
              {selectedIndex + 1} of {items.length}
            </span>
          </header>

          <h2 className="signal-detail__title">
            <a href={selectedItem.url} target="_blank" rel="noreferrer">
              {selectedItem.title}
              <ExternalLink aria-hidden="true" size={17} strokeWidth={1.8} />
            </a>
          </h2>

          <div className="signal-detail__actions">
            <button
              type="button"
              className="detail-action detail-action--primary save-button"
              aria-label="Save signal"
              aria-pressed={isSaved}
              title={isSaved ? 'Remove from Saved' : 'Save this signal'}
              onClick={() => void onTriage(selectedItem.id, isSaved ? 'viewed' : 'saved')}
            >
              <SaveStar isSaved={isSaved} />
              <kbd>S</kbd>
            </button>
            {selectedItem.source === 'arxiv' && selectedItem.kind === 'paper' ? (
              <PaperPromotionAction
                api={api}
                itemId={selectedItem.id}
                statusTargetId={promotionStatusTargetId}
              />
            ) : null}
            <button
              type="button"
              className="detail-action"
              aria-label="Analyze signal"
              disabled={analyzingItemId === selectedItem.id}
              onClick={() => void onAnalyze(selectedItem.id)}
            >
              <Sparkles aria-hidden="true" size={17} strokeWidth={1.8} />
              <span>{analyzingItemId === selectedItem.id ? 'Analyzing…' : 'Analyze'}</span>
              <kbd>A</kbd>
            </button>
            <button
              type="button"
              className="detail-action detail-action--muted"
              aria-label="Dismiss signal"
              onClick={() => void onTriage(selectedItem.id, 'dismissed')}
            >
              <EyeOff aria-hidden="true" size={17} strokeWidth={1.8} />
              <span>Dismiss</span>
              <kbd>D</kbd>
            </button>
          </div>
          <div
            id={promotionStatusTargetId}
            className="signal-detail__promotion-status"
            aria-live="polite"
          />

          <p className="signal-detail__summary" data-expanded={String(isFullSummaryVisible)}>
            {selectedItem.summary}
          </p>
          {canCollapseSummary && (
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
          )}

          {isPaper && (
            <section className="paper-l1-analysis" aria-label="L1 paper analysis">
              <div className="paper-l1-analysis__heading">
                <span>L1 PAPER ANALYSIS</span>
                <strong>llm-wiki decision-to-evidence template</strong>
              </div>
              {paperL1Analysis ? (
                <AnalysisPanel artifact={paperL1Analysis} />
              ) : (
                <>
                  <p>
                    {selectedAnalysis
                      ? 'The saved result below uses an earlier generic prompt. Run Analyze or press A to replace it with a provisional, abstract-bounded L1 analysis.'
                      : 'Run Analyze or press A to create a provisional, abstract-bounded L1 analysis. No model or local agent runs automatically.'}
                  </p>
                  {selectedAnalysis && <AnalysisPanel artifact={selectedAnalysis} />}
                </>
              )}
            </section>
          )}

          <section className="signal-detail__reasons" aria-label="Match reasons">
            <span className="signal-detail__section-label">Why this matched</span>
            <ul>
              {selectedItem.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>

          <div className="signal-detail__shortcut-legend" aria-label="Inbox keyboard shortcuts">
            <ShortcutHint keyName="↑↓" label="Move" />
            <ShortcutHint keyName="S" label="Save" />
            <ShortcutHint keyName="D" label="Dismiss" />
            <ShortcutHint keyName="A" label="Analyze" />
          </div>

          {!isPaper && selectedAnalysis && <AnalysisPanel artifact={selectedAnalysis} />}

          <p className="signal-detail__evidence-boundary">
            Discovery evidence only. Open the source before treating methods, results, or repository
            quality as verified.
          </p>
        </article>
      }
    />
  )
}

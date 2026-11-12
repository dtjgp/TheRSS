import { useEffect, useRef, useState } from 'react'
import type { TheRSSApi } from '../../shared/api'
import {
  llmWikiDailyEmptyState,
  llmWikiDailyOriginalUrl,
  llmWikiDailyPaperLabel,
  llmWikiDailyStatusText,
  type LlmWikiDailyOpenRequest,
  type LlmWikiDailySnapshot
} from '../../shared/llmWikiDaily'
import { ResizableSplitPane } from './ResizableSplitPane'

interface DailyPapersViewProps {
  readonly api: Pick<TheRSSApi, 'getLlmWikiDaily' | 'openLlmWikiDaily'>
  readonly onBack: () => void
}

export function DailyPapersView({ api, onBack }: DailyPapersViewProps) {
  const [request, setRequest] = useState(0)
  const [observation, setObservation] = useState<{
    request: number
    snapshot: LlmWikiDailySnapshot | null
  } | null>(null)
  const [selection, setSelection] = useState<{ date: string; arxivId: string } | null>(null)
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState<LlmWikiDailyOpenRequest | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    let active = true
    void api.getLlmWikiDaily().then(
      (snapshot) => {
        if (!active) return
        setObservation({ request, snapshot })
        setSelection((current) => (current?.date === snapshot.edition?.date ? current : null))
      },
      () => {
        if (active) setObservation({ request, snapshot: null })
      }
    )
    return () => {
      active = false
    }
  }, [api, request])

  const snapshot = observation?.snapshot
  const edition = snapshot?.edition
  const loading = observation?.request !== request
  const selected =
    edition?.papers.find(
      (paper) => edition.date === selection?.date && paper.arxivId === selection.arxivId
    ) ?? edition?.papers[0]
  // Nothing final is explained while a read is pending.
  const emptyState = loading ? null : llmWikiDailyEmptyState(snapshot ?? null)
  const status = loading
    ? 'Reading Daily ArXiv Scan…'
    : snapshot
      ? llmWikiDailyStatusText(snapshot)
      : 'Daily ArXiv Scan could not be read. Try refreshing.'

  const open = async (target: LlmWikiDailyOpenRequest) => {
    setOpening(true)
    setOpenError(null)
    try {
      await api.openLlmWikiDaily(target)
    } catch {
      setOpenError(target)
    } finally {
      setOpening(false)
    }
  }

  return (
    <section
      className="discover-view daily-papers"
      aria-labelledby="daily-papers-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) onBack()
      }}
    >
      <header className="today-view__heading">
        <div>
          <button type="button" className="text-button" onClick={onBack}>
            Back to Discover
          </button>
          <h1 id="daily-papers-title" ref={headingRef} tabIndex={-1}>
            Daily Papers
          </h1>
          <p className="discover-copy">
            The llm-wiki Daily ArXiv Scan shortlist. Reading priorities use discovery evidence.
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          disabled={loading || opening}
          onClick={() => {
            setOpenError(null)
            setRequest((value) => value + 1)
          }}
        >
          Refresh daily papers
        </button>
      </header>
      <section className="daily-papers__edition" aria-label="Daily edition">
        <p role="status" aria-label="Daily scan status">
          {status}
        </p>
        {snapshot && (
          <div className="daily-papers__meta">
            <span>
              Requested date <time dateTime={snapshot.requestedDate}>{snapshot.requestedDate}</time>
            </span>
            {edition && (
              <span>
                Displayed edition <time dateTime={edition.date}>{edition.date}</time>
              </span>
            )}
            <span>
              Checked{' '}
              <time dateTime={snapshot.checkedAt}>
                {new Date(snapshot.checkedAt).toLocaleString()}
              </time>
            </span>
          </div>
        )}
        {edition && (
          <button
            type="button"
            className="secondary-button"
            disabled={loading || opening}
            onClick={() => void open({ date: edition.date })}
          >
            Open digest in Obsidian
          </button>
        )}
        {openError && !openError.arxivId && (
          <p role="alert">Obsidian could not open the digest. Refresh and try again.</p>
        )}
      </section>
      {emptyState && (
        <section className="daily-papers__empty" aria-label="Daily edition explanation">
          <h2>{emptyState.title}</h2>
          <p>{emptyState.detail}</p>
        </section>
      )}
      {edition && selected && (
        <ResizableSplitPane
          ariaLabel="Resize daily paper list"
          storageKey="therss.daily-papers-list-width"
          className="signal-workspace daily-papers__workspace"
          before={
            <div className="signal-list-pane">
              <div className="signal-list-pane__heading">
                <strong>Shortlist</strong>
                <span>Use arrow keys to move</span>
              </div>
              <ol
                className="signal-list"
                aria-label="Daily paper shortlist"
                onKeyDown={(event) => {
                  if (event.altKey || event.ctrlKey || event.metaKey) return
                  const rows = Array.from(event.currentTarget.querySelectorAll('button'))
                  const index = rows.findIndex((row) => row === event.target)
                  if (index < 0 || !['ArrowDown', 'ArrowUp'].includes(event.key)) return
                  event.preventDefault()
                  const offset = event.key === 'ArrowDown' ? 1 : -1
                  const nextIndex = Math.max(0, Math.min(rows.length - 1, index + offset))
                  const paper = edition.papers[nextIndex]!
                  setSelection({ date: edition.date, arxivId: paper.arxivId })
                  rows[nextIndex]?.focus()
                }}
              >
                {edition.papers.map((paper) => {
                  const active = paper.arxivId === selected.arxivId
                  return (
                    <li
                      className={active ? 'signal-row signal-row--selected' : 'signal-row'}
                      key={paper.arxivId}
                    >
                      <button
                        type="button"
                        className="signal-row__select"
                        aria-pressed={active}
                        tabIndex={active ? 0 : -1}
                        onClick={() => setSelection({ date: edition.date, arxivId: paper.arxivId })}
                      >
                        <span className="signal-row__meta">{llmWikiDailyPaperLabel(paper)}</span>
                        <strong>{paper.title}</strong>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>
          }
          after={
            <article className="signal-detail" aria-label="Selected daily paper">
              <header className="signal-detail__header">
                <div className="signal-detail__meta">
                  <span>arXiv:{selected.arxivId}</span>
                  <span>{llmWikiDailyPaperLabel(selected)}</span>
                </div>
              </header>
              <h2 className="signal-detail__title">{selected.title}</h2>
              <section className="signal-detail__reasons" aria-label="Daily selection reason">
                <span className="signal-detail__section-label">Why selected</span>
                <p>{selected.reason ?? 'The daily digest did not record a selection reason.'}</p>
              </section>
              <div className="signal-detail__actions">
                {selected.canOpenNote && (
                  <button
                    type="button"
                    className="detail-action"
                    disabled={loading || opening}
                    onClick={() => void open({ date: edition.date, arxivId: selected.arxivId })}
                  >
                    Open note in Obsidian
                  </button>
                )}
                <a
                  className="detail-action"
                  href={llmWikiDailyOriginalUrl(selected.arxivId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open on arXiv
                </a>
              </div>
              {!selected.canOpenNote && (
                <p className="daily-papers__note">
                  No identity-checked Obsidian note is available.
                </p>
              )}
              {openError?.arxivId === selected.arxivId && (
                <p role="alert">Obsidian could not open the note. Refresh and try again.</p>
              )}
            </article>
          }
        />
      )}
    </section>
  )
}

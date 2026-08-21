import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TheRSSApi } from '../../shared/api'
import type {
  LlmWikiPromotionPreview,
  LlmWikiPromotionReceipt
} from '../../shared/llmWikiPromotion'

interface PaperPromotionActionProps {
  readonly api: TheRSSApi
  readonly itemId: string
  readonly sessionId?: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The llm-wiki promotion could not be prepared.'
}

export function PaperPromotionAction({ api, itemId, sessionId }: PaperPromotionActionProps) {
  const [preview, setPreview] = useState<LlmWikiPromotionPreview | null>(null)
  const [receipt, setReceipt] = useState<LlmWikiPromotionReceipt | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'preview' | 'confirm' | 'cancel' | null>(null)

  useEffect(() => {
    let active = true
    void api
      .getLatestLlmWikiPromotion(itemId)
      .then((latest) => {
        if (active) setReceipt(latest)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [api, itemId])

  const prepare = async () => {
    setBusy('preview')
    setError(null)
    try {
      setPreview(await api.previewLlmWikiPromotion(itemId, sessionId))
    } catch (caught) {
      setError(errorMessage(caught))
      setPreview(null)
    } finally {
      setBusy(null)
    }
  }

  const confirm = async () => {
    if (!preview?.previewId) return
    setBusy('confirm')
    setError(null)
    try {
      const result = await api.confirmLlmWikiPromotion(preview.previewId)
      setReceipt(result)
      setPreview(null)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPreview(null)
      setBusy(null)
    }
  }

  const cancel = async () => {
    if (!preview?.previewId) {
      setPreview(null)
      return
    }
    setBusy('cancel')
    try {
      setReceipt(await api.cancelLlmWikiPromotion(preview.previewId))
      setPreview(null)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPreview(null)
      setBusy(null)
    }
  }

  const dialog = preview
    ? createPortal(
        <div
          className="promotion-dialog-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`promotion-title-${itemId}`}
        >
          <section className="promotion-dialog">
            <h2 id={`promotion-title-${itemId}`}>Promote paper to llm-wiki</h2>
            <p>Destination: local llm-wiki vault</p>
            {preview.level ? (
              <p>
                Review level: <strong>{preview.level}</strong> — {preview.routingRationale}
              </p>
            ) : null}
            <p>{preview.evidenceBoundary}</p>

            {preview.intendedPaths.length > 0 ? (
              <ul aria-label="Intended llm-wiki paths">
                {preview.intendedPaths.map((path) => (
                  <li key={path}>
                    <code>{path}</code>
                  </li>
                ))}
              </ul>
            ) : null}

            {preview.pdf ? (
              <p>
                Verified PDF: {preview.pdf.pageCount} pages, {preview.pdf.byteSize} bytes
              </p>
            ) : null}

            {preview.blockers.length > 0 ? (
              <div role="alert">
                <strong>Promotion is blocked.</strong>
                <ul>
                  {preview.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="promotion-dialog-actions">
              <button type="button" onClick={() => void cancel()} disabled={busy !== null}>
                Cancel promotion
              </button>
              {preview.ready && preview.previewId ? (
                <button type="button" onClick={() => void confirm()} disabled={busy !== null}>
                  {busy === 'confirm' ? 'Promoting…' : 'Confirm local promotion'}
                </button>
              ) : null}
            </div>
          </section>
        </div>,
        document.body
      )
    : null

  return (
    <>
      <div className="paper-promotion-action">
        <button
          type="button"
          aria-label="Promote to llm-wiki"
          onClick={() => void prepare()}
          disabled={busy !== null}
        >
          {busy === 'preview' ? 'Preparing llm-wiki preview…' : 'Promote to llm-wiki'}
        </button>

        {receipt && receipt.status !== 'skipped' ? (
          <p role="status" className={`promotion-receipt promotion-${receipt.status}`}>
            {receipt.summary}
          </p>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
      </div>
      {dialog}
    </>
  )
}

import { useEffect, useState } from 'react'
import type { TheRSSApi } from '../../shared/api'
import { llmWikiLibraryStatusSchema, type LlmWikiLibraryStatus } from '../../shared/llmWikiLibrary'

interface PaperWikiStatusProps {
  readonly api: Pick<TheRSSApi, 'getLlmWikiStatus' | 'openLlmWikiNote'>
  readonly arxivId: string
  readonly promotionAttempt: number
}

const labels = {
  'not-found': 'No llm-wiki paper record found',
  recorded: 'In llm-wiki',
  'note-missing': 'llm-wiki note missing',
  ambiguous: 'Multiple llm-wiki records',
  unavailable: 'llm-wiki unavailable'
}

export function PaperWikiStatus({ api, arxivId, promotionAttempt }: PaperWikiStatusProps) {
  const [manualAttempt, setManualAttempt] = useState(0)
  const check = `${arxivId}:${promotionAttempt}:${manualAttempt}`
  const [observation, setObservation] = useState<{
    check: string
    result: LlmWikiLibraryStatus | null
  } | null>(null)
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState(false)
  const checking = observation?.check !== check
  const result = checking ? null : observation.result

  useEffect(() => {
    let active = true
    const refresh = promotionAttempt > 0 || manualAttempt > 0
    void (async () => {
      try {
        const result = llmWikiLibraryStatusSchema.parse(
          await api.getLlmWikiStatus({ arxivId, refresh })
        )
        if (active) {
          setObservation({ check, result: result.arxivId === arxivId ? result : null })
        }
      } catch {
        if (active) setObservation({ check, result: null })
      }
    })()
    return () => {
      active = false
    }
  }, [api, arxivId, check, manualAttempt, promotionAttempt])

  const open = async () => {
    setOpening(true)
    setOpenError(false)
    try {
      await api.openLlmWikiNote(arxivId)
    } catch {
      setOpenError(true)
    } finally {
      setOpening(false)
    }
  }

  const recorded = result?.status === 'recorded'
  const recordOnly = recorded && !result.notePath

  return (
    <section className="paper-wiki-status" aria-label="llm-wiki membership">
      <p aria-live="polite">
        <strong>
          {checking ? 'Checking llm-wiki…' : result ? labels[result.status] : labels.unavailable}
          {recordOnly && ' · Paper record only'}
          {recorded && result.notePath && ` · ${result.level ?? 'Paper note'}`}
          {recorded &&
            result.notePath &&
            result.readStatus &&
            ` · Vault status: ${result.readStatus}`}
        </strong>
      </p>
      {result && (
        <p className="paper-wiki-status__meta">
          Checked{' '}
          <time dateTime={result.checkedAt}>{new Date(result.checkedAt).toLocaleString()}</time>
          {' · Paper metadata only'}
        </p>
      )}
      {result?.reason && <p>{result.reason}</p>}
      {recordOnly && (
        <p>Preview llm-wiki promotion to check whether an L1 or L2 note can be added.</p>
      )}
      {openError && <p role="alert">Obsidian could not open this paper. Recheck llm-wiki.</p>}
      <div className="paper-wiki-status__actions">
        {recorded && (
          <button
            type="button"
            className={result.notePath ? 'detail-action detail-action--primary' : 'detail-action'}
            disabled={opening}
            onClick={() => void open()}
          >
            {opening ? 'Opening Obsidian…' : 'Open in Obsidian'}
          </button>
        )}
        <button
          type="button"
          className="detail-action"
          disabled={checking || opening}
          onClick={() => {
            setOpenError(false)
            setManualAttempt((value) => value + 1)
          }}
        >
          Recheck llm-wiki
        </button>
      </div>
    </section>
  )
}

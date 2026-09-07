import { useEffect, useState } from 'react'
import type { DashboardItem, TheRSSApi } from '../../shared/api'
import type { AnalysisArtifact, AnalysisArtifactState } from '../../shared/models'
import type {
  SavedSourceUpdateCandidate,
  SavedSourceUpdateResult
} from '../../shared/savedSourceUpdate'

interface Lookup {
  readonly key: string
  readonly candidate: SavedSourceUpdateCandidate | null
  readonly failed: boolean
  readonly analysis: AnalysisArtifactState | null
}
export function SavedSourceUpdate({
  api,
  item,
  analysis,
  onUpdated
}: {
  readonly api: TheRSSApi
  readonly item: DashboardItem
  readonly analysis: AnalysisArtifact | null
  readonly onUpdated: (result: SavedSourceUpdateResult) => void
}) {
  const [retry, setRetry] = useState(0)
  const [lookup, setLookup] = useState<Lookup | null>(null)
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState<{ id: string; text: string; failed: boolean } | null>(null)
  const key = JSON.stringify([item, retry, analysis?.id])
  useEffect(() => {
    let active = true
    void Promise.allSettled([
      api.getSavedSourceUpdate(item.id),
      analysis ? api.getAnalysisArtifact(analysis.id) : Promise.resolve(null)
    ]).then(([source, artifact]) => {
      if (!active) return
      setLookup({
        key,
        candidate:
          source.status === 'fulfilled' && source.value?.itemId === item.id ? source.value : null,
        failed: source.status === 'rejected',
        analysis:
          artifact.status === 'fulfilled' && artifact.value?.artifact.id === analysis?.id
            ? artifact.value
            : null
      })
    })
    return () => {
      active = false
    }
  }, [api, item, analysis, key])
  const state = lookup?.key === key ? lookup : null
  const candidate = state?.candidate
  const update = async () => {
    if (!candidate || updating) return
    setUpdating(true)
    try {
      const result = await api.applySavedSourceUpdate({
        itemId: item.id,
        sessionId: candidate.sessionId,
        expectedSourceHash: candidate.currentSourceHash,
        sourceHash: candidate.sourceHash
      })
      onUpdated(result)
      setMessage({
        id: item.id,
        failed: result.status === 'conflict' || result.status === 'unavailable',
        text:
          result.status === 'updated'
            ? 'Saved snapshot updated; analysis history retained.'
            : result.status === 'unchanged'
              ? 'The saved snapshot is already current.'
              : result.status === 'conflict'
                ? 'The source changed while preparing the update. Check the latest snapshot and try again.'
                : 'This record is no longer saved. Its previous analyses were retained.'
      })
      setRetry((value) => value + 1)
    } catch (error) {
      setMessage({
        id: item.id,
        failed: true,
        text: error instanceof Error ? error.message : 'Local update failed.'
      })
    } finally {
      setUpdating(false)
    }
  }
  return (
    <section aria-label="Saved source snapshot" className="signal-detail__source-update">
      <button
        type="button"
        className="detail-action"
        disabled={!candidate || updating || !state}
        onClick={() => void update()}
      >
        {updating ? 'Updating snapshot…' : 'Update saved snapshot'}
      </button>
      {state?.failed && (
        <button
          type="button"
          className="detail-action"
          onClick={() => setRetry((value) => value + 1)}
        >
          Retry snapshot check
        </button>
      )}
      <p role="status">
        {!state
          ? 'Checking newer local snapshots…'
          : state.failed
            ? 'Could not check newer local snapshots.'
            : candidate
              ? `Local retrieval: ${candidate.retrievedAt.slice(0, 10)}. Updates metadata and match reasons; keeps analysis history.`
              : 'No newer local snapshot. Search again to retrieve fresh metadata.'}
      </p>
      {state?.analysis?.freshness === 'stale' && (
        <p role="status">Source changed since this analysis. Reanalyze before relying on it.</p>
      )}
      {message?.id === item.id && <p role={message.failed ? 'alert' : 'status'}>{message.text}</p>}
    </section>
  )
}

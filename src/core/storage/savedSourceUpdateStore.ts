import type Database from 'better-sqlite3'
import type { DashboardItem } from '../../shared/api'
import type {
  SavedSourceUpdateCandidate,
  SavedSourceUpdateRequest,
  SavedSourceUpdateStatus
} from '../../shared/savedSourceUpdate'
import { hashAnalysisSource } from '../analysis/sourceSnapshot'
import { parseStringList } from './rowParsers'
import { replaceSavedDiscoverSnapshot } from './discoverSnapshotStore'

interface CaptureRow {
  item_id: string
  source: DashboardItem['source']
  item_kind: NonNullable<DashboardItem['kind']>
  external_id: string
  title: string
  summary: string
  url: string
  published_at: string
  updated_at: string
  score: number
  reasons_json: string
  session_id: string
  retrieved_at: string
}
interface SavedRow extends CaptureRow {
  triage_state: string
  last_seen_at: string
}
function sourceHash(row: CaptureRow): string {
  return hashAnalysisSource({
    id: row.item_id,
    source: row.source,
    kind: row.item_kind,
    title: row.title,
    summary: row.summary,
    url: row.url,
    publishedAt: row.published_at,
    score: row.score,
    reasons: parseStringList(row.reasons_json),
    triageState: 'saved'
  })
}
function savedRow(database: Database.Database, itemId: string): SavedRow | undefined {
  return database
    .prepare('SELECT id AS item_id, * FROM discovery_item WHERE id = ? AND triage_state = ?')
    .get(itemId, 'saved') as SavedRow | undefined
}
export function getSavedSourceUpdate(
  database: Database.Database,
  itemId: string
): SavedSourceUpdateCandidate | null {
  const saved = savedRow(database, itemId)
  if (!saved) return null
  // A bounded history read can prove a newer origin; if the origin is absent, last_seen is conservative.
  const captures = database
    .prepare(
      `SELECT r.*, s.created_at AS retrieved_at
    FROM discover_result r JOIN discover_session s ON s.id = r.session_id
    WHERE r.item_id = ? AND r.source = ? AND r.item_kind = ? AND r.external_id = ?
    ORDER BY s.created_at DESC, s.id DESC LIMIT 500`
    )
    .all(itemId, saved.source, saved.item_kind, saved.external_id) as CaptureRow[]
  const candidate = captures[0]
  if (!candidate) return null
  const currentSourceHash = sourceHash(saved)
  const candidateHash = sourceHash(candidate)
  if (candidateHash === currentSourceHash) return null
  const sourceTime = Date.parse(saved.updated_at),
    candidateTime = Date.parse(candidate.updated_at)
  if (!Number.isFinite(sourceTime) || !Number.isFinite(candidateTime) || candidateTime < sourceTime)
    return null
  const origin = captures.find((capture) => sourceHash(capture) === currentSourceHash)
  const observedAfter = Date.parse(origin?.retrieved_at ?? saved.last_seen_at)
  const retrievedAt = Date.parse(candidate.retrieved_at)
  if (
    !Number.isFinite(observedAfter) ||
    !Number.isFinite(retrievedAt) ||
    retrievedAt <= observedAfter
  )
    return null
  return {
    itemId,
    sessionId: candidate.session_id,
    title: candidate.title,
    retrievedAt: candidate.retrieved_at,
    updatedAt: candidate.updated_at,
    currentSourceHash,
    sourceHash: candidateHash
  }
}
export function applySavedSourceUpdate(
  database: Database.Database,
  request: SavedSourceUpdateRequest,
  updatedAt: string
): SavedSourceUpdateStatus {
  return database.transaction((): SavedSourceUpdateStatus => {
    const current = savedRow(database, request.itemId)
    if (!current) return 'unavailable'
    if (sourceHash(current) !== request.expectedSourceHash) return 'conflict'
    const candidate = getSavedSourceUpdate(database, request.itemId)
    if (!candidate) return 'unchanged'
    if (candidate.sessionId !== request.sessionId || candidate.sourceHash !== request.sourceHash)
      return 'conflict'
    replaceSavedDiscoverSnapshot(database, candidate.sessionId, request.itemId, updatedAt)
    return 'updated'
  })()
}

import type Database from 'better-sqlite3'
import type { AnalysisArtifact } from '../../shared/models'
import {
  llmWikiPromotionReceiptSchema,
  type LlmWikiPromotionReceipt
} from '../../shared/llmWikiPromotion'
import { parseStringList } from './rowParsers'

interface AnalysisArtifactRow {
  id: string
  item_id: string
  provider_id: string
  provider_name: string
  model: string
  prompt_version: string
  source_hash: string
  content: string
  created_at: string
}

interface LlmWikiPromotionReceiptRow {
  id: string
  item_id: string
  arxiv_id: string
  status: LlmWikiPromotionReceipt['status']
  runner: string
  version: string
  prompt_version: string
  source_hash: string
  contract_hash: string
  evidence_tier: LlmWikiPromotionReceipt['evidenceTier']
  summary: string
  created_paths_json: string
  updated_paths_json: string
  pdf_path: string | null
  sidecar_path: string | null
  note_path: string | null
  audit_path: string | null
  blockers_json: string
  started_at: string
  completed_at: string | null
}

export function saveAnalysis(
  database: Database.Database,
  artifact: AnalysisArtifact,
  usage: { readonly inputTokens: number | null; readonly outputTokens: number | null }
): void {
  database
    .prepare(
      `INSERT INTO analysis_artifact(
         id, item_id, provider_id, provider_name, model, prompt_version,
         source_hash, content, input_tokens, output_tokens, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      artifact.id,
      artifact.itemId,
      artifact.providerId,
      artifact.providerName,
      artifact.model,
      artifact.promptVersion,
      artifact.sourceHash,
      artifact.content,
      usage.inputTokens,
      usage.outputTokens,
      artifact.createdAt
    )
}

export function saveLlmWikiPromotionReceipt(
  database: Database.Database,
  receipt: LlmWikiPromotionReceipt
): void {
  const validated = llmWikiPromotionReceiptSchema.parse(receipt)
  database
    .prepare(
      `INSERT INTO llm_wiki_promotion_receipt(
         id, item_id, arxiv_id, status, runner, version, prompt_version,
         source_hash, contract_hash, evidence_tier, summary,
         created_paths_json, updated_paths_json, pdf_path, sidecar_path,
         note_path, audit_path, blockers_json, started_at, completed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      validated.id,
      validated.itemId,
      validated.arxivId,
      validated.status,
      validated.runner,
      validated.version,
      validated.promptVersion,
      validated.sourceHash,
      validated.contractHash,
      validated.evidenceTier,
      validated.summary,
      JSON.stringify(validated.createdPaths),
      JSON.stringify(validated.updatedPaths),
      validated.pdfPath,
      validated.sidecarPath,
      validated.notePath,
      validated.auditPath,
      JSON.stringify(validated.blockers),
      validated.startedAt,
      validated.completedAt
    )
}

export function getLatestLlmWikiPromotionReceipt(
  database: Database.Database,
  itemId: string
): LlmWikiPromotionReceipt | null {
  const row = database
    .prepare(
      `SELECT id, item_id, arxiv_id, status, runner, version, prompt_version,
              source_hash, contract_hash, evidence_tier, summary,
              created_paths_json, updated_paths_json, pdf_path, sidecar_path,
              note_path, audit_path, blockers_json, started_at, completed_at
       FROM llm_wiki_promotion_receipt
       WHERE item_id = ?
       ORDER BY sequence DESC
       LIMIT 1`
    )
    .get(itemId) as LlmWikiPromotionReceiptRow | undefined
  if (!row) return null

  return llmWikiPromotionReceiptSchema.parse({
    version: row.version,
    id: row.id,
    itemId: row.item_id,
    arxivId: row.arxiv_id,
    status: row.status,
    runner: row.runner,
    promptVersion: row.prompt_version,
    sourceHash: row.source_hash,
    contractHash: row.contract_hash,
    evidenceTier: row.evidence_tier,
    summary: row.summary,
    createdPaths: parseStringList(row.created_paths_json),
    updatedPaths: parseStringList(row.updated_paths_json),
    pdfPath: row.pdf_path,
    sidecarPath: row.sidecar_path,
    notePath: row.note_path,
    auditPath: row.audit_path,
    blockers: parseStringList(row.blockers_json),
    startedAt: row.started_at,
    completedAt: row.completed_at
  })
}

export function reconcileInterruptedLlmWikiPromotions(
  database: Database.Database,
  completedAt = new Date().toISOString()
): number {
  const itemIds = database
    .prepare(
      `SELECT current.item_id
       FROM llm_wiki_promotion_receipt AS current
       WHERE current.status = 'running'
         AND current.sequence = (
           SELECT MAX(latest.sequence)
           FROM llm_wiki_promotion_receipt AS latest
           WHERE latest.item_id = current.item_id
         )`
    )
    .pluck()
    .all() as string[]
  for (const itemId of itemIds) {
    const running = getLatestLlmWikiPromotionReceipt(database, itemId)
    if (!running || running.status !== 'running') continue
    saveLlmWikiPromotionReceipt(database, {
      ...running,
      id: `interrupted:${running.id}`.slice(0, 300),
      status: 'partial',
      evidenceTier: 'partial',
      summary:
        'The previous app session ended without a terminal vault receipt; inspect llm-wiki before retrying.',
      blockers: ['The previous promotion outcome is unknown after application interruption.'],
      completedAt
    })
  }
  return itemIds.length
}

export function getLatestAnalysis(
  database: Database.Database,
  itemId: string
): AnalysisArtifact | null {
  const row = database
    .prepare(
      `SELECT id, item_id, provider_id, provider_name, model, prompt_version,
              source_hash, content, created_at
       FROM analysis_artifact
       WHERE item_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`
    )
    .get(itemId) as AnalysisArtifactRow | undefined

  return row
    ? {
        id: row.id,
        itemId: row.item_id,
        providerId: row.provider_id,
        providerName: row.provider_name,
        model: row.model,
        promptVersion: row.prompt_version,
        sourceHash: row.source_hash,
        content: row.content,
        createdAt: row.created_at
      }
    : null
}

import type Database from 'better-sqlite3'
import { llmWikiInboxReceiptSchema, type LlmWikiInboxReceipt } from '../../shared/llmWikiInbox'

export const LLM_WIKI_INBOX_RECEIPT_TABLE = `
  CREATE TABLE IF NOT EXISTS llm_wiki_inbox_receipt (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    item_id TEXT NOT NULL REFERENCES discovery_item(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    item_kind TEXT NOT NULL,
    status TEXT NOT NULL CHECK (
      status IN (
        'running', 'completed', 'partial', 'blocked',
        'no-change', 'no-source', 'skipped', 'failed'
      )
    ),
    payload_json TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS llm_wiki_inbox_receipt_by_item
    ON llm_wiki_inbox_receipt(item_id, sequence DESC);
`

export class LlmWikiInboxStore {
  constructor(private readonly database: Database.Database) {}

  saveReceipt(candidate: LlmWikiInboxReceipt): void {
    const receipt = llmWikiInboxReceiptSchema.parse(candidate)
    this.database
      .prepare(
        `
        INSERT INTO llm_wiki_inbox_receipt (
          id, item_id, source, item_kind, status, payload_json, started_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          payload_json = excluded.payload_json,
          completed_at = excluded.completed_at
      `
      )
      .run(
        receipt.id,
        receipt.itemId,
        receipt.source,
        receipt.kind,
        receipt.status,
        JSON.stringify(receipt),
        receipt.startedAt,
        receipt.completedAt
      )
  }

  getLatestReceipt(itemId: string): LlmWikiInboxReceipt | null {
    const row = this.database
      .prepare(
        `
        SELECT payload_json
        FROM llm_wiki_inbox_receipt
        WHERE item_id = ?
        ORDER BY sequence DESC
        LIMIT 1
      `
      )
      .get(itemId) as { payload_json: string } | undefined
    if (!row) return null
    return llmWikiInboxReceiptSchema.parse(JSON.parse(row.payload_json))
  }

  reconcileInterruptedReceipts(now = new Date().toISOString()): number {
    const rows = this.database
      .prepare(
        `
        SELECT id, payload_json
        FROM llm_wiki_inbox_receipt
        WHERE status = 'running'
      `
      )
      .all() as Array<{ id: string; payload_json: string }>
    if (rows.length === 0) return 0
    const update = this.database.prepare(
      `
      UPDATE llm_wiki_inbox_receipt
      SET status = 'partial', payload_json = ?, completed_at = ?
      WHERE id = ?
    `
    )
    const run = this.database.transaction(() => {
      for (const row of rows) {
        const parsed = llmWikiInboxReceiptSchema.parse(JSON.parse(row.payload_json))
        const reconciled = llmWikiInboxReceiptSchema.parse({
          ...parsed,
          status: 'partial',
          evidenceTier: 'partial',
          summary:
            'The Inbox capture did not finish before TheRSS closed. Inspect llm-wiki/Inbox and log.md before retrying.',
          blockers: ['Previous Inbox capture was interrupted before completion.'],
          completedAt: now
        })
        update.run(JSON.stringify(reconciled), now, row.id)
      }
    })
    run()
    return rows.length
  }
}

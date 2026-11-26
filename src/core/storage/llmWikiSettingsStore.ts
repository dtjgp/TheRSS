import type Database from 'better-sqlite3'
import { llmWikiVaultPathSchema } from '../../shared/llmWikiSettings'

export const LLM_WIKI_SETTINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS llm_wiki_settings (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    vault_path TEXT,
    updated_at TEXT NOT NULL
  );`

export function readLlmWikiVaultPath(database: Database.Database): string | null {
  const row = database
    .prepare('SELECT vault_path FROM llm_wiki_settings WHERE singleton_id = 1')
    .get() as { vault_path: unknown } | undefined
  return llmWikiVaultPathSchema.parse(row?.vault_path ?? null)
}

export function saveLlmWikiVaultPath(
  database: Database.Database,
  candidate: unknown,
  now = new Date().toISOString()
): string | null {
  const vaultPath = llmWikiVaultPathSchema.parse(candidate)
  database
    .prepare(
      `INSERT INTO llm_wiki_settings(singleton_id, vault_path, updated_at)
       VALUES (1, ?, ?)
       ON CONFLICT(singleton_id) DO UPDATE SET
         vault_path = excluded.vault_path,
         updated_at = excluded.updated_at`
    )
    .run(vaultPath, now)
  return vaultPath
}

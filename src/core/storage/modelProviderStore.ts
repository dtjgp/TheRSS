import type Database from 'better-sqlite3'
import type { ModelProtocol, ModelProviderSummary } from '../../shared/models'

/** A model provider as persisted locally, including its encrypted credential. */
export interface StoredModelProvider {
  readonly id: string
  readonly name: string
  readonly protocol: ModelProtocol
  readonly baseUrl: string
  readonly model: string
  readonly secretCiphertext: Buffer | null
  readonly updatedAt: string
}

interface ModelProviderRow {
  id: string
  name: string
  protocol: ModelProtocol
  base_url: string
  model: string
  secret_ciphertext: Buffer | null
  updated_at: string
}

export function getModelProvider(
  database: Database.Database,
  id = 'default'
): StoredModelProvider | null {
  const row = database
    .prepare(
      `SELECT id, name, protocol, base_url, model, secret_ciphertext, updated_at
         FROM model_provider WHERE id = ?`
    )
    .get(id) as ModelProviderRow | undefined

  return row
    ? {
        id: row.id,
        name: row.name,
        protocol: row.protocol,
        baseUrl: row.base_url,
        model: row.model,
        secretCiphertext: row.secret_ciphertext,
        updatedAt: row.updated_at
      }
    : null
}

export function saveModelProvider(
  database: Database.Database,
  profile: Omit<ModelProviderSummary, 'hasCredential'>,
  secretCiphertext: Buffer | undefined
): StoredModelProvider {
  database
    .prepare(
      `INSERT INTO model_provider(
           id, name, protocol, base_url, model, secret_ciphertext, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           protocol = excluded.protocol,
           base_url = excluded.base_url,
           model = excluded.model,
           secret_ciphertext = COALESCE(
             excluded.secret_ciphertext,
             model_provider.secret_ciphertext
           ),
           updated_at = excluded.updated_at`
    )
    .run(
      profile.id,
      profile.name,
      profile.protocol,
      profile.baseUrl,
      profile.model,
      secretCiphertext ?? null,
      profile.updatedAt
    )

  return getModelProvider(database, profile.id)!
}

export function clearModelProviderCredential(
  database: Database.Database,
  id = 'default',
  updatedAt = new Date().toISOString()
): StoredModelProvider {
  const result = database
    .prepare(
      `UPDATE model_provider
         SET secret_ciphertext = NULL, updated_at = ?
         WHERE id = ?`
    )
    .run(updatedAt, id)
  if (result.changes !== 1) throw new Error('Configure a model provider first')
  return getModelProvider(database, id)!
}

import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  LLM_WIKI_SETTINGS_TABLE,
  readLlmWikiVaultPath,
  saveLlmWikiVaultPath
} from './llmWikiSettingsStore'
import { ResearchRepository } from './researchRepository'

const UPDATED_AT = '2026-11-21T09:00:00.000Z'
const RESET_AT = '2026-11-21T09:05:00.000Z'

describe('llm-wiki vault path storage', () => {
  let database: Database.Database

  beforeEach(() => {
    database = new Database(':memory:')
  })

  afterEach(() => {
    database.close()
  })

  it('stores one normalized override and persists null on reset', () => {
    database.exec(LLM_WIKI_SETTINGS_TABLE)
    expect(readLlmWikiVaultPath(database)).toBeNull()

    expect(saveLlmWikiVaultPath(database, ' /tmp/Jun’s vault/// ', UPDATED_AT)).toBe(
      '/tmp/Jun’s vault'
    )
    expect(readLlmWikiVaultPath(database)).toBe('/tmp/Jun’s vault')
    expect(saveLlmWikiVaultPath(database, '/', UPDATED_AT)).toBe('/')
    expect(readLlmWikiVaultPath(database)).toBe('/')

    expect(saveLlmWikiVaultPath(database, null, RESET_AT)).toBeNull()
    expect(readLlmWikiVaultPath(database)).toBeNull()
    expect(database.prepare('SELECT * FROM llm_wiki_settings').all()).toEqual([
      { singleton_id: 1, vault_path: null, updated_at: RESET_AT }
    ])
  })

  it.each(['relative/folder', '/tmp/../folder', '/tmp/folder\n', '/' + 'a'.repeat(1_000), 42])(
    'rejects invalid input %j and preserves the previous setting',
    (candidate) => {
      database.exec(LLM_WIKI_SETTINGS_TABLE)
      saveLlmWikiVaultPath(database, '/tmp/current-vault', UPDATED_AT)

      expect(() => saveLlmWikiVaultPath(database, candidate, RESET_AT)).toThrow()
      expect(database.prepare('SELECT * FROM llm_wiki_settings').all()).toEqual([
        { singleton_id: 1, vault_path: '/tmp/current-vault', updated_at: UPDATED_AT }
      ])
    }
  )

  it('adds the settings table to an existing DB and reads the override after reopening', () => {
    database.exec(
      'CREATE TABLE discover_personalization (singleton_id INTEGER PRIMARY KEY, prompt TEXT NOT NULL, updated_at TEXT NOT NULL)'
    )
    database
      .prepare('INSERT INTO discover_personalization VALUES (1, ?, ?)')
      .run('Existing research prompt', UPDATED_AT)
    const repository = new ResearchRepository(database)

    expect(repository.getLlmWikiVaultPath()).toBeNull()
    expect(repository.saveLlmWikiVaultPath('/tmp/selected-vault/')).toBe('/tmp/selected-vault')

    const reopened = new ResearchRepository(new Database(database.serialize()))
    try {
      expect(reopened.getLlmWikiVaultPath()).toBe('/tmp/selected-vault')
      expect(reopened.getDiscoverPersonalizationSettings()).toEqual({
        prompt: 'Existing research prompt',
        updatedAt: UPDATED_AT
      })
      expect(reopened.saveLlmWikiVaultPath(null)).toBeNull()
      expect(reopened.getLlmWikiVaultPath()).toBeNull()
    } finally {
      reopened.close()
    }
  })

  it('rolls back settings table creation when the initial migration fails', () => {
    database.exec('CREATE TABLE discover_source_preference (broken_column INTEGER)')
    expect(() => new ResearchRepository(database)).toThrow(/singleton_id/u)
    expect(
      database.prepare("SELECT name FROM sqlite_schema WHERE name = 'llm_wiki_settings'").get()
    ).toBeUndefined()
    expect(database.pragma('foreign_keys', { simple: true })).toBe(1)
  })
})

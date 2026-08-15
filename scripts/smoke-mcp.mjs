import { error as logError, log } from 'node:console'
import { lstat, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cwd, execPath } from 'node:process'
import Database from 'better-sqlite3'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  getDefaultEnvironment,
  StdioClientTransport
} from '@modelcontextprotocol/sdk/client/stdio.js'

const expectedTools = ['list_today_items', 'get_item', 'get_analysis_context']
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'therss-mcp-smoke-'))
const databasePath = join(temporaryDirectory, 'therss.sqlite')
const database = new Database(databasePath)
database.exec(`
  CREATE TABLE discovery_item (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    url TEXT NOT NULL,
    published_at TEXT NOT NULL,
    score REAL NOT NULL,
    triage_state TEXT NOT NULL,
    reasons_json TEXT NOT NULL,
    excluded INTEGER NOT NULL
  );
  CREATE TABLE analysis_artifact (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    source_hash TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`)
database
  .prepare(
    `INSERT INTO discovery_item(
      id, source, title, summary, url, published_at, score, triage_state,
      reasons_json, excluded
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  .run(
    'arxiv:smoke',
    'arxiv',
    'TheRSS MCP smoke paper',
    'Deterministic local context.',
    'https://arxiv.org/abs/smoke',
    '2026-08-15T00:00:00.000Z',
    42,
    'new',
    JSON.stringify(['MCP smoke fixture']),
    0
  )
database
  .prepare(
    `INSERT INTO analysis_artifact(
      id, item_id, provider_id, provider_name, model, prompt_version,
      source_hash, content, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  .run(
    'analysis-smoke',
    'arxiv:smoke',
    'default',
    'Fixture provider',
    'fixture-model',
    'discovery-analysis-v1',
    'fixture-source-hash',
    'Deterministic analysis context.',
    '2026-08-15T01:00:00.000Z'
  )
database.close()

const client = new Client({ name: 'TheRSS smoke client', version: '0.1.0' })
const transport = new StdioClientTransport({
  command: execPath,
  args: ['out/mcp/stdio.js'],
  cwd: cwd(),
  env: { ...getDefaultEnvironment(), THERSS_DB_PATH: databasePath },
  stderr: 'pipe'
})

try {
  await client.connect(transport)
  const response = await client.listTools()
  const names = response.tools.map((tool) => tool.name)
  if (JSON.stringify(names) !== JSON.stringify(expectedTools)) {
    throw new Error(`Unexpected TheRSS MCP tools: ${names.join(', ')}`)
  }
  if (!response.tools.every((tool) => tool.annotations?.readOnlyHint === true)) {
    throw new Error('A TheRSS MCP tool is not marked read-only')
  }

  const listResult = await client.callTool({
    name: 'list_today_items',
    arguments: { source: 'arxiv', limit: 1 }
  })
  const itemResult = await client.callTool({
    name: 'get_item',
    arguments: { id: 'arxiv:smoke' }
  })
  const contextResult = await client.callTool({
    name: 'get_analysis_context',
    arguments: { id: 'arxiv:smoke' }
  })
  const serialized = JSON.stringify({ listResult, itemResult, contextResult })
  if (!serialized.includes('TheRSS MCP smoke paper')) {
    throw new Error('TheRSS MCP stdio tools did not return the seeded item')
  }
  if (!serialized.includes('fixture-source-hash')) {
    throw new Error('TheRSS MCP analysis context omitted source provenance')
  }
  if (serialized.includes('secret_ciphertext')) {
    throw new Error('TheRSS MCP context exposed a secret field')
  }

  log(`TheRSS MCP stdio smoke passed: ${names.join(', ')}`)
} finally {
  await client.close()
  try {
    const temporaryStat = await lstat(temporaryDirectory)
    if (temporaryStat.isDirectory() && !temporaryStat.isSymbolicLink()) {
      await rm(temporaryDirectory, { recursive: true })
    } else {
      logError(`Refusing to clean unexpected MCP smoke path: ${temporaryDirectory}`)
    }
  } catch (error) {
    logError(`Could not clean MCP smoke directory: ${String(error)}`)
  }
}

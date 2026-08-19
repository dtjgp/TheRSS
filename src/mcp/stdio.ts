import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { env } from 'node:process'
import { error as logError } from 'node:console'
import Database from 'better-sqlite3'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ResearchRepository } from '../core/storage/researchRepository'
import { createTheRssMcpServer } from './server'
import { defaultDatabasePath } from './databasePath'

const databasePath = resolve(env.THERSS_DB_PATH ?? defaultDatabasePath())
if (!existsSync(databasePath)) {
  throw new Error(`TheRSS database does not exist: ${databasePath}. Open TheRSS once first.`)
}

const repository = new ResearchRepository(
  new Database(databasePath, { readonly: true, fileMustExist: true }),
  { migrate: false }
)
const server = createTheRssMcpServer(repository)

server.connect(new StdioServerTransport()).catch((error: unknown) => {
  logError('TheRSS MCP server failed:', error)
  repository.close()
})

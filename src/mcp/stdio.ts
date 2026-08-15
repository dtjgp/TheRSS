import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { env, platform } from 'node:process'
import { error as logError } from 'node:console'
import Database from 'better-sqlite3'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ResearchRepository } from '../core/storage/researchRepository'
import { createTheRssMcpServer } from './server'

function defaultDatabasePath(): string {
  if (platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'TheRSS', 'therss.sqlite')
  }
  if (platform === 'win32') {
    return join(env.APPDATA ?? homedir(), 'TheRSS', 'therss.sqlite')
  }
  return join(env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'TheRSS', 'therss.sqlite')
}

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

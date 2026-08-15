import { log } from 'node:console'
import { cwd, execPath } from 'node:process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const expectedTools = ['list_today_items', 'get_item', 'get_analysis_context']
const client = new Client({ name: 'TheRSS smoke client', version: '0.1.0' })
const transport = new StdioClientTransport({
  command: execPath,
  args: ['out/mcp/stdio.js'],
  cwd: cwd(),
  stderr: 'pipe'
})

await client.connect(transport)
const response = await client.listTools()
const names = response.tools.map((tool) => tool.name)
if (JSON.stringify(names) !== JSON.stringify(expectedTools)) {
  throw new Error(`Unexpected TheRSS MCP tools: ${names.join(', ')}`)
}
if (!response.tools.every((tool) => tool.annotations?.readOnlyHint === true)) {
  throw new Error('A TheRSS MCP tool is not marked read-only')
}

await client.close()
log(`TheRSS MCP stdio smoke passed: ${names.join(', ')}`)

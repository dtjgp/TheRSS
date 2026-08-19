import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ResearchRepository } from '../core/storage/researchRepository'

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
} as const

function textContent(value: unknown) {
  return [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]
}

export function createTheRssMcpServer(repository: ResearchRepository): McpServer {
  const server = new McpServer({
    name: 'TheRSS',
    version: '0.2.0'
  })

  server.registerTool(
    'list_today_items',
    {
      title: 'List TheRSS daily discovery items',
      description:
        'Lists ranked arXiv papers and GitHub repositories from the local TheRSS inbox. Read-only.',
      inputSchema: {
        source: z.enum(['arxiv', 'github']).optional(),
        limit: z.number().int().min(1).max(100).default(20)
      },
      annotations: readOnlyAnnotations
    },
    async ({ source, limit }) => {
      const items = repository
        .listDashboardItems(100)
        .filter((item) => !source || item.source === source)
        .slice(0, limit)
      return {
        content: textContent(items),
        structuredContent: { items }
      }
    }
  )

  server.registerTool(
    'get_item',
    {
      title: 'Get one TheRSS discovery item',
      description:
        'Returns one locally persisted discovery item, including deterministic match reasons. Read-only.',
      inputSchema: { id: z.string().trim().min(1).max(300) },
      annotations: readOnlyAnnotations
    },
    async ({ id }) => {
      const item = repository.getDiscoveryItem(id)
      if (!item) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown TheRSS item: ${id}` }]
        }
      }
      return {
        content: textContent(item),
        structuredContent: { item }
      }
    }
  )

  server.registerTool(
    'get_analysis_context',
    {
      title: 'Get evidence-bounded analysis context',
      description:
        'Returns a discovery item plus its latest saved model analysis and an explicit evidence boundary. Read-only.',
      inputSchema: { id: z.string().trim().min(1).max(300) },
      annotations: readOnlyAnnotations
    },
    async ({ id }) => {
      const item = repository.getDiscoveryItem(id)
      if (!item) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown TheRSS item: ${id}` }]
        }
      }

      const context = {
        item,
        latestAnalysis: repository.getLatestAnalysis(id),
        evidenceBoundary:
          'TheRSS discovery metadata and generated analysis do not verify full-paper methods, experiments, source-code quality, or results.'
      }
      return {
        content: textContent(context),
        structuredContent: context
      }
    }
  )

  return server
}

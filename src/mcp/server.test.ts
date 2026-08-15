import Database from 'better-sqlite3'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { describe, expect, it } from 'vitest'
import type { RankedDiscoveryItem } from '../shared/discovery'
import { ResearchRepository } from '../core/storage/researchRepository'
import { createTheRssMcpServer } from './server'

const rankedItem: RankedDiscoveryItem = {
  item: {
    id: 'arxiv:2608.00001',
    source: 'arxiv',
    externalId: '2608.00001',
    title: 'Structured pruning for edge deployment',
    summary: 'A resource-aware method.',
    url: 'https://arxiv.org/abs/2608.00001',
    publishedAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z',
    authors: ['A. Researcher'],
    categories: ['cs.LG'],
    topics: [],
    language: null,
    stars: null
  },
  score: 62,
  excluded: false,
  reasons: [
    {
      kind: 'keyword',
      value: 'structured pruning',
      field: 'title',
      weight: 30,
      label: 'Title matches “structured pruning”'
    }
  ]
}

async function setupClient(repository: ResearchRepository) {
  const server = createTheRssMcpServer(repository)
  const client = new Client({ name: 'TheRSS test client', version: '0.1.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return { server, client }
}

describe('TheRSS MCP server', () => {
  it('exposes only read-only discovery and analysis-context tools', async () => {
    const repository = new ResearchRepository(new Database(':memory:'))
    repository.upsertRankedItems([rankedItem], '2026-08-15T10:00:00.000Z')
    const { server, client } = await setupClient(repository)

    const tools = await client.listTools()

    expect(tools.tools.map((tool) => tool.name)).toEqual([
      'list_today_items',
      'get_item',
      'get_analysis_context'
    ])
    expect(tools.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true)
    await client.close()
    await server.close()
    repository.close()
  })

  it('returns local item context without model credentials or write capabilities', async () => {
    const repository = new ResearchRepository(new Database(':memory:'))
    repository.upsertRankedItems([rankedItem], '2026-08-15T10:00:00.000Z')
    const { server, client } = await setupClient(repository)

    const result = await client.callTool({
      name: 'get_analysis_context',
      arguments: { id: 'arxiv:2608.00001' }
    })

    expect(result.structuredContent).toMatchObject({
      item: { id: 'arxiv:2608.00001', title: rankedItem.item.title },
      latestAnalysis: null,
      evidenceBoundary: expect.stringContaining('discovery metadata')
    })
    expect(JSON.stringify(result)).not.toContain('secret_ciphertext')
    await client.close()
    await server.close()
    repository.close()
  })
})

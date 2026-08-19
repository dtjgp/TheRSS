import { z } from 'zod'
import type { GitHubInterest } from '../../interests/interestProfile'
import { readBoundedText } from '../../security/boundedResponse'
import type { DiscoveryItem } from '../../../shared/discovery'
import { buildGitHubRadarQueries } from './githubQuery'

const GITHUB_SEARCH_ENDPOINT = 'https://api.github.com/search/repositories'
const DEFAULT_MAX_QUERIES = 6

interface FetchGitHubOptions {
  readonly fetcher?: typeof fetch
  readonly now?: Date
  readonly token?: string | undefined
  readonly maxQueries?: number
  readonly maxResponseBytes?: number
}

const repositorySchema = z.object({
  id: z.number().int().positive(),
  full_name: z.string().min(1),
  html_url: z.url().startsWith('https://github.com/'),
  description: z.string().nullable(),
  created_at: z.iso.datetime(),
  pushed_at: z.iso.datetime(),
  language: z.string().nullable(),
  stargazers_count: z.number().int().nonnegative(),
  topics: z.array(z.string()).default([])
})

const searchResponseSchema = z.object({
  total_count: z.number().int().nonnegative(),
  incomplete_results: z.boolean(),
  items: z.array(repositorySchema).max(100)
})

export function parseGitHubSearchResponse(payload: unknown): DiscoveryItem[] {
  const result = searchResponseSchema.parse(payload)
  return result.items.map((repository) => ({
    id: `github:${repository.full_name.toLocaleLowerCase()}`,
    source: 'github',
    kind: 'repository',
    externalId: repository.full_name,
    title: repository.full_name,
    summary: repository.description ?? 'No repository description provided.',
    url: repository.html_url,
    publishedAt: new Date(repository.created_at).toISOString(),
    updatedAt: new Date(repository.pushed_at).toISOString(),
    authors: [],
    categories: [],
    topics: [...repository.topics],
    language: repository.language,
    stars: repository.stargazers_count,
    metrics: {}
  }))
}

function validateMaxQueries(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 12) {
    throw new Error('GitHub maxQueries must be between 1 and 12')
  }
  return value
}

export async function fetchGitHubRadarItems(
  interest: GitHubInterest,
  options: FetchGitHubOptions = {}
): Promise<DiscoveryItem[]> {
  const fetcher = options.fetcher ?? fetch
  const maxQueries = validateMaxQueries(options.maxQueries ?? DEFAULT_MAX_QUERIES)
  const queries = buildGitHubRadarQueries(interest, options.now ?? new Date()).slice(0, maxQueries)
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'TheRSS/0.1',
    'X-GitHub-Api-Version': '2022-11-28'
  }
  if (options.token?.trim()) headers.Authorization = `Bearer ${options.token.trim()}`

  const uniqueItems = new Map<string, DiscoveryItem>()
  for (const query of queries) {
    const url = new URL(GITHUB_SEARCH_ENDPOINT)
    url.searchParams.set('q', query)
    url.searchParams.set('sort', 'updated')
    url.searchParams.set('order', 'desc')
    url.searchParams.set('per_page', '25')
    const response = await fetcher(url.toString(), {
      headers,
      signal: AbortSignal.timeout(30_000)
    })
    if (!response.ok) {
      throw new Error(`GitHub request failed with status ${response.status}`)
    }

    const responseText = await readBoundedText(
      response,
      options.maxResponseBytes ?? 5_000_000,
      'GitHub'
    )
    for (const item of parseGitHubSearchResponse(JSON.parse(responseText) as unknown)) {
      uniqueItems.set(item.id, item)
    }
  }

  return [...uniqueItems.values()]
}

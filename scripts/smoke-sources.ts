import { error, log } from 'node:console'
import { performance } from 'node:perf_hooks'
import { fetchArxivItems, fetchArxivRecentItems } from '../src/core/sources/arxiv/arxivClient'
import { fetchGitHubRadarItems } from '../src/core/sources/github/githubClient'
import type { DiscoveryItem } from '../src/shared/discovery'

// Unauthenticated GitHub search is rate limited per source IP. That is fine on a
// developer machine but returns 403 from shared CI runners, so allow an optional token
// exactly as the Hugging Face adapter does. Public discovery still works without one.
const githubToken = process.env.THERSS_GITHUB_TOKEN?.trim()

interface SourceProbe {
  readonly id: string
  readonly source: DiscoveryItem['source']
  readonly urlPrefix: string
  readonly run: () => Promise<DiscoveryItem[]>
}

// One line per probe in the same `id<TAB>status<TAB>detail` form as
// smoke:configured-sources, so the Source Health issue step can grep failed lines.
// A rejected probe must not hide the outcome of the others.
const probes: readonly SourceProbe[] = [
  {
    id: 'arxiv:interest',
    source: 'arxiv',
    urlPrefix: 'https://arxiv.org/',
    run: () =>
      fetchArxivItems(
        { categories: ['cs.LG'], keywords: ['structured pruning'], excludeKeywords: [] },
        { maxResults: 3 }
      )
  },
  {
    id: 'arxiv:recent',
    source: 'arxiv',
    urlPrefix: 'https://arxiv.org/',
    run: () => fetchArxivRecentItems({ maxResults: 200 })
  },
  {
    id: 'github:radar',
    source: 'github',
    urlPrefix: 'https://github.com/',
    run: () =>
      fetchGitHubRadarItems(
        { keywords: [], topics: ['model-compression'], languages: [] },
        { maxQueries: 1, ...(githubToken ? { token: githubToken } : {}) }
      )
  }
]

async function runProbe(probe: SourceProbe): Promise<{ status: string; detail: string }> {
  const started = performance.now()
  const elapsed = () => `${Math.round(performance.now() - started)} ms`
  try {
    const items = await probe.run()
    if (
      !items.every((item) => item.source === probe.source && item.url.startsWith(probe.urlPrefix))
    ) {
      return { status: 'failed', detail: `invalid normalized item; ${elapsed()}` }
    }
    return {
      status: items.length > 0 ? 'fetched' : 'no_posts',
      detail: `${items.length} normalized; ${elapsed()}`
    }
  } catch (reason) {
    const message = reason instanceof Error ? `${reason.name}: ${reason.message}` : 'Unknown error'
    return { status: 'failed', detail: `${message.slice(0, 300)}; after ${elapsed()}` }
  }
}

const results = await Promise.all(probes.map(runProbe))
probes.forEach((probe, index) => {
  const result = results[index]!
  log(`${probe.id}\t${result.status}\t${result.detail}`)
})

const failures = results.filter((result) => result.status === 'failed').length
if (failures > 0) {
  error(`Live source smoke failed for ${failures} of ${probes.length} probe(s)`)
  process.exitCode = 1
} else {
  log('Live source smoke passed')
}

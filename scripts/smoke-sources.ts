import { log } from 'node:console'
import { fetchArxivItems, fetchArxivRecentItems } from '../src/core/sources/arxiv/arxivClient'
import { fetchGitHubRadarItems } from '../src/core/sources/github/githubClient'

// Unauthenticated GitHub search is rate limited per source IP. That is fine on a
// developer machine but returns 403 from shared CI runners, so allow an optional token
// exactly as the Hugging Face adapter does. Public discovery still works without one.
const githubToken = process.env.THERSS_GITHUB_TOKEN?.trim()

const [papers, recentPapers, repositories] = await Promise.all([
  fetchArxivItems(
    {
      categories: ['cs.LG'],
      keywords: ['structured pruning'],
      excludeKeywords: []
    },
    { maxResults: 3 }
  ),
  fetchArxivRecentItems({ maxResults: 200 }),
  fetchGitHubRadarItems(
    {
      keywords: [],
      topics: ['model-compression'],
      languages: []
    },
    { maxQueries: 1, ...(githubToken ? { token: githubToken } : {}) }
  )
])

if (!papers.every((item) => item.source === 'arxiv' && item.url.startsWith('https://arxiv.org/'))) {
  throw new Error('Live arXiv smoke returned an invalid normalized item')
}
if (
  !recentPapers.every(
    (item) => item.source === 'arxiv' && item.url.startsWith('https://arxiv.org/')
  )
) {
  throw new Error('Live interest-independent arXiv smoke returned an invalid normalized item')
}
if (
  !repositories.every(
    (item) => item.source === 'github' && item.url.startsWith('https://github.com/')
  )
) {
  throw new Error('Live GitHub smoke returned an invalid normalized item')
}

log(
  `Live source smoke passed: arXiv interest=${papers.length}, arXiv today=${recentPapers.length}, GitHub=${repositories.length}`
)

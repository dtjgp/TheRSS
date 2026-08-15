import { log } from 'node:console'
import { fetchArxivItems } from '../src/core/sources/arxiv/arxivClient'
import { fetchGitHubRadarItems } from '../src/core/sources/github/githubClient'

const [papers, repositories] = await Promise.all([
  fetchArxivItems(
    {
      categories: ['cs.LG'],
      keywords: ['structured pruning'],
      excludeKeywords: []
    },
    { maxResults: 3 }
  ),
  fetchGitHubRadarItems(
    {
      keywords: [],
      topics: ['model-compression'],
      languages: []
    },
    { maxQueries: 1 }
  )
])

if (!papers.every((item) => item.source === 'arxiv' && item.url.startsWith('https://arxiv.org/'))) {
  throw new Error('Live arXiv smoke returned an invalid normalized item')
}
if (
  !repositories.every(
    (item) => item.source === 'github' && item.url.startsWith('https://github.com/')
  )
) {
  throw new Error('Live GitHub smoke returned an invalid normalized item')
}

log(`Live source smoke passed: arXiv=${papers.length}, GitHub=${repositories.length}`)

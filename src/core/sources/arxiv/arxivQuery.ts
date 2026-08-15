import type { ArxivInterest } from '../../interests/interestProfile'

const ARXIV_QUERY_ENDPOINT = 'https://export.arxiv.org/api/query'
const MAX_RESULTS_PER_REFRESH = 200

function quoteArxivValue(value: string): string {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    throw new Error('arXiv query values cannot be empty')
  }

  if (/^[\p{L}\p{N}._-]+$/u.test(trimmedValue)) {
    return trimmedValue
  }

  return `"${trimmedValue.replaceAll('"', '\\"')}"`
}

function joinGroup(field: 'cat' | 'all', values: readonly string[]): string | null {
  if (values.length === 0) {
    return null
  }

  return `(${values.map((value) => `${field}:${quoteArxivValue(value)}`).join(' OR ')})`
}

export function buildArxivSearchExpression(interest: ArxivInterest): string {
  const positiveGroups = [
    joinGroup('cat', interest.categories),
    joinGroup('all', interest.keywords)
  ].filter((group): group is string => group !== null)

  if (positiveGroups.length === 0) {
    throw new Error('At least one arXiv category or keyword is required')
  }

  const exclusions = interest.excludeKeywords.map(
    (keyword) => `ANDNOT all:${quoteArxivValue(keyword)}`
  )

  return [...positiveGroups, ...exclusions].join(' AND ').replaceAll('AND ANDNOT', 'ANDNOT')
}

export function buildArxivQueryUrl(interest: ArxivInterest, maxResults = 50): string {
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > MAX_RESULTS_PER_REFRESH) {
    throw new Error(`maxResults must be between 1 and ${MAX_RESULTS_PER_REFRESH}`)
  }

  const url = new URL(ARXIV_QUERY_ENDPOINT)
  url.searchParams.set('search_query', buildArxivSearchExpression(interest))
  url.searchParams.set('start', '0')
  url.searchParams.set('max_results', String(maxResults))
  url.searchParams.set('sortBy', 'submittedDate')
  url.searchParams.set('sortOrder', 'descending')
  return url.toString()
}

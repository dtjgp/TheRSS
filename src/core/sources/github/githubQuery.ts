import type { GitHubInterest } from '../../interests/interestProfile'

const MIN_LOOKBACK_DAYS = 1
const MAX_LOOKBACK_DAYS = 90

function uniqueValues(values: readonly string[]): string[] {
  const seen = new Set<string>()

  return values.flatMap((value) => {
    const trimmedValue = value.trim()
    const key = trimmedValue.toLocaleLowerCase()
    if (!trimmedValue || seen.has(key)) {
      return []
    }

    seen.add(key)
    return [trimmedValue]
  })
}

function quoteGitHubKeyword(value: string): string {
  return value.includes(' ') ? `"${value.replaceAll('"', '\\"')}"` : value
}

function dateDaysBefore(now: Date, lookbackDays: number): string {
  const startDate = new Date(now)
  startDate.setUTCDate(startDate.getUTCDate() - lookbackDays)
  return startDate.toISOString().slice(0, 10)
}

export function buildGitHubRadarQueries(
  interest: GitHubInterest,
  now: Date,
  lookbackDays = 14
): string[] {
  if (
    !Number.isInteger(lookbackDays) ||
    lookbackDays < MIN_LOOKBACK_DAYS ||
    lookbackDays > MAX_LOOKBACK_DAYS
  ) {
    throw new Error(`lookbackDays must be between ${MIN_LOOKBACK_DAYS} and ${MAX_LOOKBACK_DAYS}`)
  }

  const since = dateDaysBefore(now, lookbackDays)
  const commonQualifiers = `pushed:>=${since} archived:false fork:false`

  const keywordQueries = uniqueValues(interest.keywords).map(
    (keyword) => `${quoteGitHubKeyword(keyword)} in:name,description,topics ${commonQualifiers}`
  )
  const topicQueries = uniqueValues(interest.topics).map(
    (topic) => `topic:${topic.toLocaleLowerCase()} ${commonQualifiers}`
  )
  const languageQueries = uniqueValues(interest.languages).map(
    (language) => `language:${language} pushed:>=${since} stars:>=10 archived:false fork:false`
  )

  return [...keywordQueries, ...topicQueries, ...languageQueries]
}

import type { InterestProfile } from '../interests/interestProfile'
import type { DiscoveryItem, MatchReason, RankedDiscoveryItem } from '../../shared/discovery'

const TITLE_KEYWORD_WEIGHT = 30
const SUMMARY_KEYWORD_WEIGHT = 12
const CATEGORY_WEIGHT = 18
const TOPIC_WEIGHT = 18
const LANGUAGE_WEIGHT = 10

function includesText(value: string, query: string): boolean {
  return value.toLocaleLowerCase().includes(query.toLocaleLowerCase())
}

function recencyReason(item: DiscoveryItem, now: Date): MatchReason | null {
  const timestamp = Date.parse(item.updatedAt || item.publishedAt)
  if (!Number.isFinite(timestamp)) {
    return null
  }

  const ageDays = Math.max(0, (now.getTime() - timestamp) / 86_400_000)
  const weight = ageDays <= 2 ? 14 : ageDays <= 7 ? 9 : ageDays <= 30 ? 4 : 0
  if (weight === 0) {
    return null
  }

  const roundedAgeDays = Math.floor(ageDays)
  return {
    kind: 'recency',
    value: `${roundedAgeDays}d`,
    weight,
    label:
      ageDays < 1
        ? 'Published today'
        : `Published ${roundedAgeDays} ${roundedAgeDays === 1 ? 'day' : 'days'} ago`
  }
}

function popularityReason(stars: number | null): MatchReason | null {
  if (stars === null || stars <= 0) {
    return null
  }

  const weight = Math.min(12, Math.round(Math.log10(stars + 1) * 4))
  return {
    kind: 'popularity',
    value: String(stars),
    weight,
    label: `${stars.toLocaleString()} GitHub stars`
  }
}

export function rankDiscoveryItem(
  item: DiscoveryItem,
  profile: InterestProfile,
  now: Date
): RankedDiscoveryItem {
  const exclusionReasons = profile.arxiv.excludeKeywords.flatMap((keyword) =>
    includesText(`${item.title}\n${item.summary}`, keyword)
      ? [
          {
            kind: 'exclusion' as const,
            value: keyword,
            weight: -100,
            label: `Excluded keyword: ${keyword}`
          }
        ]
      : []
  )

  const keywords = item.source === 'arxiv' ? profile.arxiv.keywords : profile.github.keywords
  const keywordReasons = keywords.flatMap((keyword): MatchReason[] => {
    if (includesText(item.title, keyword)) {
      return [
        {
          kind: 'keyword',
          field: 'title',
          value: keyword,
          weight: TITLE_KEYWORD_WEIGHT,
          label: `Title matches “${keyword}”`
        }
      ]
    }
    if (includesText(item.summary, keyword)) {
      return [
        {
          kind: 'keyword',
          field: 'summary',
          value: keyword,
          weight: SUMMARY_KEYWORD_WEIGHT,
          label: `Summary matches “${keyword}”`
        }
      ]
    }
    return []
  })

  const categoryReasons = item.categories.flatMap((category): MatchReason[] =>
    profile.arxiv.categories.some(
      (interestCategory) => interestCategory.toLocaleLowerCase() === category.toLocaleLowerCase()
    )
      ? [
          {
            kind: 'category',
            value: category,
            weight: CATEGORY_WEIGHT,
            label: `arXiv category ${category}`
          }
        ]
      : []
  )

  const topicReasons = item.topics.flatMap((topic): MatchReason[] =>
    profile.github.topics.some(
      (interestTopic) => interestTopic.toLocaleLowerCase() === topic.toLocaleLowerCase()
    )
      ? [
          {
            kind: 'topic',
            value: topic,
            weight: TOPIC_WEIGHT,
            label: `GitHub topic ${topic}`
          }
        ]
      : []
  )

  const languageReasons: MatchReason[] =
    item.language &&
    profile.github.languages.some(
      (language) => language.toLocaleLowerCase() === item.language?.toLocaleLowerCase()
    )
      ? [
          {
            kind: 'language',
            value: item.language,
            weight: LANGUAGE_WEIGHT,
            label: `Primary language ${item.language}`
          }
        ]
      : []

  const optionalReasons = [recencyReason(item, now), popularityReason(item.stars)].filter(
    (reason): reason is MatchReason => reason !== null
  )
  const reasons = [
    ...keywordReasons,
    ...categoryReasons,
    ...topicReasons,
    ...languageReasons,
    ...optionalReasons,
    ...exclusionReasons
  ]
  const excluded = exclusionReasons.length > 0
  const score = excluded
    ? 0
    : Math.round(reasons.reduce((total, reason) => total + reason.weight, 0) * 100) / 100

  return {
    item,
    score,
    excluded,
    reasons
  }
}

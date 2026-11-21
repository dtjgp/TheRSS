import { describe, expect, it } from 'vitest'
import type { DiscoverResultItem } from './discover'
import {
  discoverItemSortTimestamp,
  filterAndSortDiscoverItems,
  matchesDiscoverTimeRange
} from './discoverViewFilter'

function makeItem(overrides: Partial<DiscoverResultItem> = {}): DiscoverResultItem {
  return {
    id: 'arxiv:2611.00001v1',
    source: 'arxiv',
    kind: 'paper',
    externalId: '2611.00001v1',
    title: 'Sample paper',
    summary: 'Sample summary',
    url: 'https://arxiv.org/abs/2611.00001v1',
    publishedAt: '2026-11-18T12:00:00.000Z',
    updatedAt: '2026-11-18T12:00:00.000Z',
    authors: ['Author'],
    categories: ['cs.LG'],
    topics: [],
    language: null,
    stars: null,
    metrics: {},
    score: 50,
    reasons: ['Title matches “pruning”'],
    saved: false,
    ...overrides
  }
}

describe('discoverViewFilter', () => {
  const referenceTime = Date.parse('2026-11-20T12:00:00.000Z')

  it('filters by 7d and 30d windows using the newer of publishedAt and updatedAt', () => {
    const recentPaper = makeItem({
      id: 'recent-paper',
      publishedAt: '2026-11-16T00:00:00.000Z',
      updatedAt: '2026-11-16T00:00:00.000Z'
    })
    const recentlyPushedRepo = makeItem({
      id: 'pushed-repo',
      source: 'github',
      kind: 'repository',
      publishedAt: '2025-01-10T00:00:00.000Z',
      updatedAt: '2026-11-19T10:00:00.000Z'
    })
    const twoWeeksOld = makeItem({
      id: 'two-weeks',
      publishedAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z'
    })
    const oldPaper = makeItem({
      id: 'old-paper',
      publishedAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z'
    })

    const items = [recentPaper, recentlyPushedRepo, twoWeeksOld, oldPaper]

    expect(
      filterAndSortDiscoverItems(items, {
        kind: 'all',
        timeRange: '7d',
        sortOrder: 'relevance',
        referenceTime
      }).map((item) => item.id)
    ).toEqual(['recent-paper', 'pushed-repo'])

    expect(
      filterAndSortDiscoverItems(items, {
        kind: 'all',
        timeRange: '30d',
        sortOrder: 'relevance',
        referenceTime
      }).map((item) => item.id)
    ).toEqual(['recent-paper', 'pushed-repo', 'two-weeks'])
  })

  it('handles NCPSD month-only entries via month-interval overlap without fabricating day precision', () => {
    const novMonthOnly = makeItem({
      id: 'ncpssd-nov',
      source: 'folo:611',
      kind: 'paper',
      publishedAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
      summary: '2026年11月刊发研究综述'
    })
    const sepMonthOnly = makeItem({
      id: 'ncpssd-sep',
      source: 'folo:611',
      kind: 'paper',
      publishedAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      summary: '2026年9月刊发研究综述'
    })
    const midNovExact = makeItem({
      id: 'exact-nov-15',
      publishedAt: '2026-11-15T00:00:00.000Z',
      updatedAt: '2026-11-15T00:00:00.000Z',
      score: 40
    })

    expect(matchesDiscoverTimeRange(novMonthOnly, '7d', referenceTime)).toBe(true)
    expect(matchesDiscoverTimeRange(sepMonthOnly, '30d', referenceTime)).toBe(false)
    expect(discoverItemSortTimestamp(novMonthOnly)).toBe(Date.parse('2026-11-01T00:00:00.000Z'))

    // Under newest sort, exact 2026-11-15 ranks ahead of month-only 2026-11-01 anchor.
    expect(
      filterAndSortDiscoverItems([novMonthOnly, midNovExact], {
        kind: 'all',
        timeRange: 'all',
        sortOrder: 'newest',
        referenceTime
      }).map((item) => item.id)
    ).toEqual(['exact-nov-15', 'ncpssd-nov'])
  })

  it('sorts by newest with score tie-breaking and preserves incoming order under relevance', () => {
    const highScoreOlder = makeItem({
      id: 'high-older',
      publishedAt: '2026-11-10T00:00:00.000Z',
      updatedAt: '2026-11-10T00:00:00.000Z',
      score: 95
    })
    const sameDayLower = makeItem({
      id: 'same-day-lower',
      publishedAt: '2026-11-19T00:00:00.000Z',
      updatedAt: '2026-11-19T00:00:00.000Z',
      score: 30
    })
    const sameDayHigher = makeItem({
      id: 'same-day-higher',
      publishedAt: '2026-11-19T00:00:00.000Z',
      updatedAt: '2026-11-19T00:00:00.000Z',
      score: 70
    })
    const invalidDate = makeItem({
      id: 'invalid-date',
      publishedAt: 'not-a-date',
      updatedAt: 'not-a-date',
      score: 99
    })

    const items = [highScoreOlder, sameDayLower, sameDayHigher, invalidDate]

    expect(
      filterAndSortDiscoverItems(items, {
        kind: 'all',
        timeRange: 'all',
        sortOrder: 'relevance',
        referenceTime
      }).map((item) => item.id)
    ).toEqual(['high-older', 'same-day-lower', 'same-day-higher', 'invalid-date'])

    expect(
      filterAndSortDiscoverItems(items, {
        kind: 'all',
        timeRange: 'all',
        sortOrder: 'newest',
        referenceTime
      }).map((item) => item.id)
    ).toEqual(['same-day-higher', 'same-day-lower', 'high-older', 'invalid-date'])

    // Bounded time window excludes invalid dates cleanly.
    expect(
      filterAndSortDiscoverItems(items, {
        kind: 'all',
        timeRange: '30d',
        sortOrder: 'newest',
        referenceTime
      }).map((item) => item.id)
    ).toEqual(['same-day-higher', 'same-day-lower', 'high-older'])
  })

  it('combines kind filter (including other) with time range and sort', () => {
    const article = makeItem({
      id: 'article-new',
      source: 'folo:20',
      kind: 'article',
      publishedAt: '2026-11-19T00:00:00.000Z',
      updatedAt: '2026-11-19T00:00:00.000Z'
    })
    const paper = makeItem({
      id: 'paper-new',
      publishedAt: '2026-11-19T00:00:00.000Z',
      updatedAt: '2026-11-19T00:00:00.000Z'
    })

    expect(
      filterAndSortDiscoverItems([paper, article], {
        kind: 'other',
        timeRange: '7d',
        sortOrder: 'newest',
        referenceTime
      }).map((item) => item.id)
    ).toEqual(['article-new'])
  })
})

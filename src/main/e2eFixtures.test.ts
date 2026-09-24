import { describe, expect, it } from 'vitest'
import { e2eConfiguredArticle, e2eRecentConfiguredArticle } from './e2eFixtures'

describe('E2E configured-source fixture', () => {
  it('publishes the refreshed source item inside the rolling window of the run clock', () => {
    const now = new Date('2031-02-10T12:00:00.000Z')
    const item = e2eRecentConfiguredArticle(now)
    const age = now.getTime() - Date.parse(item.publishedAt!)

    expect(age).toBeGreaterThan(0)
    expect(age).toBeLessThan(30 * 24 * 60 * 60 * 1000)
    expect(item.updatedAt).toBe(item.publishedAt)
    expect(item).toMatchObject({
      id: e2eConfiguredArticle.id,
      source: 'folo:302',
      title: e2eConfiguredArticle.title
    })
  })

  it('keeps the shared fixed-date fixture unchanged for other fixtures', () => {
    e2eRecentConfiguredArticle(new Date('2031-02-10T12:00:00.000Z'))
    expect(e2eConfiguredArticle.publishedAt).toBe('2026-08-14T00:00:00.000Z')
  })
})

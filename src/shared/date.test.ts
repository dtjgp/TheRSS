import { describe, expect, it } from 'vitest'
import { isTimestampOnLocalDate, localDateKey } from './date'

describe('local date keys', () => {
  it('formats a calendar day in the runtime local timezone', () => {
    const localEvening = new Date(2026, 7, 15, 23, 30)

    expect(localDateKey(localEvening)).toBe('2026-08-15')
    expect(isTimestampOnLocalDate(localEvening.toISOString(), '2026-08-15')).toBe(true)
  })

  it('treats malformed timestamps as not refreshed', () => {
    expect(isTimestampOnLocalDate('not-a-timestamp', '2026-08-15')).toBe(false)
  })
})

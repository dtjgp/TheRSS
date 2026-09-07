import { describe, expect, it, vi } from 'vitest'
import { RequestPacer } from './requestPacer'

describe('arXiv request pacing', () => {
  it('serializes callers and spaces real request starts by at least three seconds', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    try {
      const queue = new RequestPacer(3000),
        starts: number[] = []
      const first = queue.run(async () => {
        starts.push(Date.now())
        return 'first'
      })
      const second = queue.run(async () => {
        starts.push(Date.now())
        return 'second'
      })
      await vi.advanceTimersByTimeAsync(2999)
      expect(starts).toEqual([0])
      await vi.advanceTimersByTimeAsync(1)
      expect(starts).toEqual([0, 3000])
      expect(await Promise.all([first, second])).toEqual(['first', 'second'])
    } finally {
      vi.useRealTimers()
    }
  })
  it('cancels queued work immediately without starting it or blocking subsequent callers', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    try {
      const queue = new RequestPacer(3000)
      let finish!: () => void
      const active = queue.run(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve
          })
      )
      await Promise.resolve()
      const controller = new AbortController(),
        operation = vi.fn(async () => 'unexpected')
      const canceled = queue.run(operation, controller.signal).catch((error: Error) => error)
      controller.abort()
      expect(await canceled).toMatchObject({ name: 'AbortError' })
      expect(operation).not.toHaveBeenCalled()
      finish()
      await active
      const later = queue.run(async () => 'later')
      await vi.advanceTimersByTimeAsync(3000)
      expect(await later).toBe('later')
      expect(operation).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

import { describe, expect, it, vi } from 'vitest'
import { RequestPacer, sourceDelay } from './requestPacer'

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

  it('waits the full interval after a slow request completes', async () => {
    vi.useFakeTimers()
    try {
      const queue = new RequestPacer(3000)
      const first = queue.run(() => new Promise<void>((resolve) => setTimeout(resolve, 5000)))
      const operation = vi.fn(async () => 'second')
      const second = queue.run(operation)

      await vi.advanceTimersByTimeAsync(7999)
      await first
      expect(operation).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(await second).toBe('second')
    } finally {
      vi.useRealTimers()
    }
  })

  it('rechecks an extended cooldown and promptly cancels a waiting caller', async () => {
    vi.useFakeTimers()
    try {
      const queue = new RequestPacer(3000)
      const controller = new AbortController()
      const operation = vi.fn(async () => 'next')
      const cancelReason = new Error('canceled in cooldown')
      queue.applyCooldown(5000)
      const canceled = expect(queue.run(operation, controller.signal)).rejects.toBe(cancelReason)
      const next = queue.run(operation)

      await vi.advanceTimersByTimeAsync(1000)
      queue.applyCooldown(8000)
      queue.applyCooldown(2000)
      controller.abort(cancelReason)
      await canceled
      await vi.advanceTimersByTimeAsync(7999)
      expect(operation).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(await next).toBe('next')
      expect(operation).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('waits for a cooldown extended after the current pacing timer starts', async () => {
    vi.useFakeTimers()
    try {
      const queue = new RequestPacer(3000)
      await queue.run(async () => undefined)
      const operation = vi.fn(async () => 'next')
      const next = queue.run(operation)

      await vi.advanceTimersByTimeAsync(1000)
      queue.applyCooldown(5000)
      await vi.advanceTimersByTimeAsync(4999)
      expect(operation).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(await next).toBe('next')
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

  it('rejects pre-aborted runs and waits without adding work or timers', async () => {
    vi.useFakeTimers()
    try {
      const operation = vi.fn(async () => 'unexpected')
      const signal = AbortSignal.abort()
      await expect(new RequestPacer(3000).run(operation, signal)).rejects.toBe(signal.reason)
      await expect(sourceDelay(3000, signal)).rejects.toBe(signal.reason)
      expect(operation).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('spaces the next request from a failed request even when both accept cancellation', async () => {
    vi.useFakeTimers()
    try {
      const queue = new RequestPacer(3000)
      const { signal } = new AbortController()
      const reason = new Error('request failed')
      const failed = expect(
        queue.run(async () => {
          await sourceDelay(5000, signal)
          throw reason
        }, signal)
      ).rejects.toBe(reason)
      const operation = vi.fn(async () => 'next')
      const next = queue.run(operation, signal)

      await vi.advanceTimersByTimeAsync(7999)
      await failed
      expect(operation).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(await next).toBe('next')
    } finally {
      vi.useRealTimers()
    }
  })
})

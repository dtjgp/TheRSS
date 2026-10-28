import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPendingCallTracker,
  nativeSmokeStepTimeoutMs,
  runStepWithDeadline,
  withDeadline
} from '../../../scripts/native-smoke-step.mjs'

afterEach(() => {
  vi.useRealTimers()
})

describe('native smoke step timeout setting', () => {
  it('defaults to 120 s', () => {
    expect(nativeSmokeStepTimeoutMs({})).toBe(120_000)
  })
  it('accepts a positive whole number of milliseconds', () => {
    expect(nativeSmokeStepTimeoutMs({ THERSS_NATIVE_STEP_TIMEOUT_MS: '45000' })).toBe(45_000)
  })
  it.each(['0', '-5', '1.5', 'abc', '', '12ms'])('rejects %j', (value) => {
    expect(() => nativeSmokeStepTimeoutMs({ THERSS_NATIVE_STEP_TIMEOUT_MS: value })).toThrow(
      /THERSS_NATIVE_STEP_TIMEOUT_MS/u
    )
  })
})

describe('native smoke step deadline', () => {
  it('returns the group result and leaves no timer behind', async () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()
    await expect(
      runStepWithDeadline({ name: 'g', run: async () => 'done', timeoutMs: 1000, onTimeout })
    ).resolves.toBe('done')
    expect(vi.getTimerCount()).toBe(0)
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('passes a group failure through without timeout diagnostics', async () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()
    await expect(
      runStepWithDeadline({
        name: 'g',
        run: async () => {
          throw new Error('assertion failed')
        },
        timeoutMs: 1000,
        onTimeout
      })
    ).rejects.toThrow('assertion failed')
    expect(vi.getTimerCount()).toBe(0)
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('fails a group that never settles, names it and collects diagnostics once', async () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn(async () => {})
    const result = runStepWithDeadline({
      name: 'Window recreation',
      run: () => new Promise(() => {}),
      timeoutMs: 1000,
      onTimeout
    })
    const assertion = expect(result).rejects.toThrow(
      'Native smoke group timed out after 1000 ms: Window recreation'
    )
    await vi.advanceTimersByTimeAsync(999)
    expect(onTimeout).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await assertion
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('keeps the timeout error when diagnostics fail', async () => {
    vi.useFakeTimers()
    const result = runStepWithDeadline({
      name: 'g',
      run: () => new Promise(() => {}),
      timeoutMs: 10,
      onTimeout: async () => {
        throw new Error('sample failed')
      }
    })
    const assertion = expect(result).rejects.toThrow(
      /timed out after 10 ms: g \(diagnostics failed: Error: sample failed\)/u
    )
    await vi.advanceTimersByTimeAsync(10)
    await assertion
  })
})

describe('bounded cleanup call', () => {
  it('returns the value of a call that settles in time', async () => {
    vi.useFakeTimers()
    await expect(withDeadline(Promise.resolve(7), 50, 'inspect')).resolves.toBe(7)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('rejects with the label when the call does not settle', async () => {
    vi.useFakeTimers()
    const result = withDeadline(new Promise(() => {}), 50, 'application.close')
    const assertion = expect(result).rejects.toThrow('application.close did not finish in 50 ms')
    await vi.advanceTimersByTimeAsync(50)
    await assertion
  })
})

describe('pending main-process call tracker', () => {
  it('lists only the calls that have not settled, with their age', async () => {
    let clock = 1_000
    const tracker = createPendingCallTracker(() => clock)
    let release: (value: string) => void = () => {}
    const hung = tracker.track('window.close()', new Promise<string>(() => {}))
    const settled = tracker.track(
      'inspect()',
      new Promise<string>((resolve) => {
        release = resolve
      })
    )
    const failed = tracker.track('act()', Promise.reject(new Error('disabled')))
    await expect(failed).rejects.toThrow('disabled')
    release('ok')
    await expect(settled).resolves.toBe('ok')
    clock = 4_500
    expect(tracker.snapshot()).toEqual([{ label: 'window.close()', ageMs: 3_500 }])
    void hung
  })

  it('shortens long labels to one bounded line', () => {
    const tracker = createPendingCallTracker(() => 0)
    void tracker.track(`first line\n${'x'.repeat(400)}`, new Promise(() => {}))
    const labels = tracker.snapshot().map((entry) => entry.label)
    expect(labels).toHaveLength(1)
    expect(labels[0]).not.toContain('\n')
    expect(labels[0]).toMatch(/^first line x+$/u)
    expect(labels[0]?.length).toBe(200)
  })
})

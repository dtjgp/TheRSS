function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The request was canceled.', 'AbortError')
}

function abortable<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work
  if (signal.aborted) return Promise.reject(abortReason(signal))
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort)
      reject(abortReason(signal))
    }
    signal.addEventListener('abort', abort, { once: true })
    work.then(
      (value) => {
        signal.removeEventListener('abort', abort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort)
        reject(error)
      }
    )
  })
}

export function sourceDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortReason(signal))
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      reject(abortReason(signal!))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, milliseconds)
    signal?.addEventListener('abort', abort, { once: true })
  })
}

/** One real arXiv connection at a time; queued cancellation never sends a request. */
export class RequestPacer {
  private tail: Promise<void> = Promise.resolve()
  private nextStartAt = -Infinity
  private cooldownUntil = -Infinity
  constructor(private readonly intervalMs: number) {}

  applyCooldown(milliseconds: number): void {
    this.cooldownUntil = Math.max(this.cooldownUntil, performance.now() + milliseconds)
  }

  run<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(abortReason(signal))
    const work = this.tail.then(async () => {
      signal?.throwIfAborted()
      while (true) {
        const remaining = Math.max(this.nextStartAt, this.cooldownUntil) - performance.now()
        if (!(remaining > 0)) break
        await sourceDelay(Math.ceil(remaining), signal)
      }
      signal?.throwIfAborted()
      try {
        return await operation()
      } finally {
        this.nextStartAt = performance.now() + this.intervalMs
      }
    })
    this.tail = work.then(
      () => undefined,
      () => undefined
    )
    return abortable(work, signal)
  }
}

/**
 * Time limits for the native smoke workflow groups.
 *
 * A group can wait forever when one call into the Electron main process does not return. CI
 * then stops the whole job at its 30-minute limit and keeps no diagnostics (PR #68 and PR #71,
 * 2026-10-27). Each group therefore has its own limit. When the limit is reached, the caller
 * collects diagnostics and the group fails with its name.
 */
const defaultStepTimeoutMs = 120_000
const labelLimit = 200

/** THERSS_NATIVE_STEP_TIMEOUT_MS overrides the 120 s default with a positive whole number. */
export function nativeSmokeStepTimeoutMs(env) {
  const value = env.THERSS_NATIVE_STEP_TIMEOUT_MS
  if (value === undefined) return defaultStepTimeoutMs
  if (!/^[1-9]\d*$/u.test(value))
    throw new Error(`THERSS_NATIVE_STEP_TIMEOUT_MS must be a positive whole number: ${value}`)
  return Number(value)
}

/**
 * Runs one group. If it does not settle in timeoutMs, onTimeout collects diagnostics once and
 * the result rejects. The group itself cannot be cancelled; the caller closes the app.
 */
export function runStepWithDeadline({ name, run, timeoutMs, onTimeout }) {
  let timer
  const expired = new Promise((_, reject) => {
    timer = globalThis.setTimeout(async () => {
      let detail = ''
      try {
        await onTimeout()
      } catch (error) {
        detail = ` (diagnostics failed: ${String(error)})`
      }
      reject(new Error(`Native smoke group timed out after ${timeoutMs} ms: ${name}${detail}`))
    }, timeoutMs)
  })
  return Promise.race([Promise.resolve().then(run), expired]).finally(() =>
    globalThis.clearTimeout(timer)
  )
}

/** Bounds a diagnostic or cleanup call that may wait on a blocked main process. */
export function withDeadline(promise, timeoutMs, label) {
  let timer
  const expired = new Promise((_, reject) => {
    timer = globalThis.setTimeout(
      () => reject(new Error(`${label} did not finish in ${timeoutMs} ms`)),
      timeoutMs
    )
  })
  return Promise.race([promise, expired]).finally(() => globalThis.clearTimeout(timer))
}

/** Records main-process calls that have started and not settled, for timeout diagnostics. */
export function createPendingCallTracker(now = Date.now) {
  const pending = new Set()
  return {
    track(label, promise) {
      const call = {
        label: String(label).replace(/\s+/gu, ' ').trim().slice(0, labelLimit),
        startedAt: now()
      }
      pending.add(call)
      return Promise.resolve(promise).finally(() => pending.delete(call))
    },
    snapshot() {
      const at = now()
      return [...pending].map((call) => ({ label: call.label, ageMs: at - call.startedAt }))
    }
  }
}

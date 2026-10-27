export function nativeSmokeStepTimeoutMs(env: Readonly<Record<string, string | undefined>>): number
export function runStepWithDeadline<T>(options: {
  name: string
  run: () => Promise<T> | T
  timeoutMs: number
  onTimeout: () => Promise<void> | void
}): Promise<T>
export function withDeadline<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T>
export function createPendingCallTracker(now?: () => number): {
  track<T>(label: string, promise: Promise<T>): Promise<T>
  snapshot(): Array<{ label: string; ageMs: number }>
}

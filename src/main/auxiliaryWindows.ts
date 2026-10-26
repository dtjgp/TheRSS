/**
 * Record and Settings windows of the native route. Neither replaces the main window nor
 * receives item commands; generic so the decisions are testable without Electron.
 */
export class AuxiliaryWindows<W, S extends string = string> {
  /** Read-only record windows by record key; at most one window per record. */
  readonly records = new Map<string, W>()
  /** The single Settings window, whether its native host is attached, and its latest pane. */
  settings: { window: W; ready: boolean; section?: S | undefined } | null = null

  isAuxiliary(window: W): boolean {
    return [...this.records.values()].includes(window) || this.settings?.window === window
  }
  /** Activation recreates the main window when only auxiliary windows remain. */
  needsMainWindow(open: readonly W[]): boolean {
    return !open.some((window) => !this.isAuxiliary(window))
  }
}

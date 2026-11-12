import type { DiscoverSource } from '../../shared/discover'
import type { DiscoverSourcePreference } from '../../shared/discoverSourcePreference'
import type { NativeContext } from './common'

type Listener = (previous: DiscoverSourcePreference, next: DiscoverSourcePreference) => void

/**
 * The window's view of the SQLite-owned default sources. Discover and Sources share one instance
 * per presenter context. A read that finishes after a save never replaces the saved value.
 */
export class SourcePreferences {
  value: DiscoverSourcePreference | null = null
  failed = false
  private pending: Promise<void> | null = null
  private version = 0
  private readonly listeners = new Set<Listener>()

  constructor(private readonly context: NativeContext) {}

  load(force = false): Promise<void> {
    if (this.pending) return this.pending
    if (this.value && !force) return Promise.resolve()
    const version = this.version
    this.pending = this.context.api
      .getDiscoverSourcePreference()
      .then((value) => {
        if (version !== this.version) return
        this.value = value
        this.failed = false
      })
      .catch(() => {
        if (version === this.version) this.failed = !this.value
      })
      .finally(() => {
        this.pending = null
        this.context.redraw()
      })
    return this.pending
  }

  /** Saves a new default. On failure it throws and leaves the stored value unchanged. */
  async save(sources: readonly DiscoverSource[]): Promise<DiscoverSourcePreference> {
    const version = ++this.version
    const saved = await this.context.api.saveDiscoverSourcePreference(sources)
    const previous = this.value
    if (version === this.version) {
      this.value = saved
      this.failed = false
    }
    if (previous) for (const listener of this.listeners) listener(previous, saved)
    this.context.redraw()
    return saved
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

const shared = new WeakMap<NativeContext, SourcePreferences>()

export function sourcePreferences(context: NativeContext): SourcePreferences {
  let preferences = shared.get(context)
  if (!preferences) {
    preferences = new SourcePreferences(context)
    shared.set(context, preferences)
  }
  return preferences
}

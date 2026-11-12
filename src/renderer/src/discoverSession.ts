import type { TheRSSApi } from '../../shared/api'
import type { DiscoverRunner, DiscoverSource } from '../../shared/discover'
import {
  orderedDiscoverSources,
  sameDiscoverSources,
  type DiscoverSourcePreference
} from '../../shared/discoverSourcePreference'

type SessionApi = Pick<TheRSSApi, 'getDiscoverSourcePreference' | 'saveDiscoverSourcePreference'>

export const CHANGED_DEFAULT_NOTE =
  'Default sources saved. This search keeps its current sources; choose Use defaults to switch.'

export interface DiscoverSessionState {
  /** The sources the next search sends. */
  readonly sources: readonly DiscoverSource[]
  /** The stored default, or null until it has been read. */
  readonly defaults: readonly DiscoverSource[] | null
  readonly unavailable: readonly string[]
  /** The default could not be read and nothing has been chosen. */
  readonly failed: boolean
  readonly note: string
  /** The run ID of the search or retry that is running, whichever view started it. */
  readonly activeRun: string | null
}

/**
 * The Web window's Discover draft for this app session: the unsubmitted question and runner and
 * the sources of the next search. It survives page changes and ends with the renderer (a
 * restart). Only `saveDefault` writes anything, and only the default, through the main process.
 */
export class WebDiscoverSession {
  /** An edited, unsubmitted question; null while the stored session's question applies. */
  intent: string | null = null
  runner: DiscoverRunner | null = null

  rememberIntent(intent: string): void {
    this.intent = intent
  }
  rememberRunner(runner: DiscoverRunner): void {
    this.runner = runner
  }
  /** A search or retry is running; a new default then leaves the draft unchanged. */
  get running(): boolean {
    return this.state.activeRun !== null
  }
  /** Claims the single run of this window; false while another run is active. */
  startRun(runId: string): boolean {
    if (this.state.activeRun) return false
    this.update({ activeRun: runId })
    return true
  }
  /** Ends a run; only its owner clears the marker, so a refused second start cannot. */
  finishRun(runId: string): void {
    if (this.state.activeRun === runId) this.update({ activeRun: null })
  }
  private state: DiscoverSessionState = {
    sources: [],
    defaults: null,
    unavailable: [],
    failed: false,
    note: '',
    activeRun: null
  }
  private initialized = false
  private version = 0
  private pending: Promise<void> | null = null
  private readonly listeners = new Set<() => void>()

  constructor(private readonly api: SessionApi) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  readonly getState = (): DiscoverSessionState => this.state

  /** Reads the default once (or again with `force`); a read that ends after a save is ignored. */
  loadDefaults(force = false): Promise<void> {
    if (this.pending) return this.pending
    if (this.state.defaults && !force) return Promise.resolve()
    const version = this.version
    this.pending = this.api
      .getDiscoverSourcePreference()
      .then(
        (preference) => {
          if (version === this.version) this.adoptDefault(preference)
        },
        () => {
          if (version === this.version && !this.state.defaults) this.update({ failed: true })
        }
      )
      .finally(() => {
        this.pending = null
      })
    return this.pending
  }

  /** Changes only this search's sources. */
  apply(sources: Iterable<DiscoverSource>): void {
    this.initialized = true
    this.update({ sources: orderedDiscoverSources(sources), note: '' })
  }

  /**
   * Saves a new default. The draft follows it only if it still equals the previous default and
   * no search is running; otherwise it is kept with a note. A failure throws and changes nothing.
   */
  async saveDefault(sources: readonly DiscoverSource[]): Promise<DiscoverSourcePreference> {
    const saved = await this.api.saveDiscoverSourcePreference(sources)
    this.version++
    const previous = this.state.defaults
    const follows =
      !this.initialized ||
      (!this.running && previous !== null && sameDiscoverSources(this.state.sources, previous))
    this.initialized = true
    this.update({
      defaults: saved.sources,
      unavailable: saved.unavailable,
      failed: false,
      ...(follows ? { sources: saved.sources, note: '' } : { note: CHANGED_DEFAULT_NOTE })
    })
    return saved
  }

  private adoptDefault(preference: DiscoverSourcePreference): void {
    const first = !this.initialized
    this.initialized = true
    this.update({
      defaults: preference.sources,
      unavailable: preference.unavailable,
      failed: false,
      ...(first ? { sources: preference.sources } : {})
    })
  }

  private update(change: Partial<DiscoverSessionState>): void {
    this.state = { ...this.state, ...change }
    for (const listener of this.listeners) listener()
  }
}

const sessions = new WeakMap<object, WebDiscoverSession>()

/** One session per application bridge, i.e. per renderer lifetime. */
export function webDiscoverSession(api: SessionApi): WebDiscoverSession {
  let session = sessions.get(api)
  if (!session) {
    session = new WebDiscoverSession(api)
    sessions.set(api, session)
  }
  return session
}

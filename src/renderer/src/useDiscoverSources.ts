import { useEffect, useSyncExternalStore } from 'react'
import type { TheRSSApi } from '../../shared/api'
import type { DiscoverSource } from '../../shared/discover'
import {
  webDiscoverSession,
  type DiscoverSessionState,
  type WebDiscoverSession
} from './discoverSession'

export interface DiscoverSourcesState extends DiscoverSessionState {
  apply(sources: Iterable<DiscoverSource>): void
  retry(): void
}

/**
 * The next search's sources from the window session: they start from the stored default
 * (SQLite, via the main process), survive page changes, and are never set from a stored session.
 */
export function useDiscoverSources(
  api: Pick<TheRSSApi, 'getDiscoverSourcePreference' | 'saveDiscoverSourcePreference'>
): DiscoverSourcesState & { readonly session: WebDiscoverSession } {
  const session = webDiscoverSession(api)
  const state = useSyncExternalStore(session.subscribe, session.getState)
  useEffect(() => {
    void session.loadDefaults()
  }, [session])
  return {
    ...state,
    session,
    apply: (sources) => session.apply(sources),
    retry: () => void session.loadDefaults(true)
  }
}

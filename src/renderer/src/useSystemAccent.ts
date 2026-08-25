import { useEffect } from 'react'
import type { TheRSSApi } from '../../shared/api'

/**
 * Applies the macOS accent colour to the document root as `data-system-accent`.
 *
 * The stylesheet maps that attribute onto an already contrast-tuned palette token, so
 * the accent tints controls, text selection, and focus rings only. Per-view identity
 * accents stay under the stylesheet's own `[data-view]` rules.
 *
 * An unresolved or unavailable accent removes the attribute, which restores the
 * default blue rather than surfacing an appearance error.
 */
export function useSystemAccent(api: TheRSSApi): void {
  useEffect(() => {
    let isActive = true
    const applyAccent = (accent: string | null) => {
      if (!isActive) return
      if (accent) document.documentElement.dataset.systemAccent = accent
      else delete document.documentElement.dataset.systemAccent
    }

    void api
      .getSystemAccent()
      .then(applyAccent)
      .catch(() => applyAccent(null))
    const unsubscribe = api.onSystemAccentChange(applyAccent)

    return () => {
      isActive = false
      unsubscribe()
    }
  }, [api])
}

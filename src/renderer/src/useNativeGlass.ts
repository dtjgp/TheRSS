import { useEffect } from 'react'
import type { NativeGlassApi, NativeGlassEvent } from '../../shared/nativeGlass'
import {
  collectNativeProjection,
  focusableWebElements,
  nativeScrollContextNodes,
  scrollWebAncestors,
  type NativeProjection
} from './nativeGlassProjection'

export function useNativeGlass(api: NativeGlassApi | undefined): void {
  useEffect(() => {
    if (!api) return
    let disposed = false,
      available = false,
      pending = false,
      inFlight = false,
      frame = 0,
      revision = 0,
      rejected = 0,
      retryTimer = 0
    let scope: 'pilot' | 'full' = 'pilot'
    let signature = ''
    let rejectedViewport = ''
    let applied: NativeProjection | null = null
    let scrollProjection: NativeProjection | null = null
    let scrollSignature = '',
      scrollRevision = 0
    let scrollRoot: Element | null = null
    let scrollNodes: readonly HTMLElement[] = []
    const sameScrollNodes = (nodes: readonly HTMLElement[]) =>
      nodes.length === scrollNodes.length &&
      nodes.every((node, index) => node === scrollNodes[index])
    const currentScrollRoot = () =>
      document.querySelector('.signal-detail') ?? document.querySelector('.app-shell')
    const scrollContext = (projection: NativeProjection) =>
      JSON.stringify([
        projection.identity,
        projection.state.viewport,
        window.devicePixelRatio,
        projection.state.modal
      ])
    const hidden = new Map<HTMLElement, string | null>()
    const groups = new Set<HTMLElement>()
    const root = document.documentElement
    const invalidateScroll = () => {
      scrollProjection = null
      scrollSignature = ''
      scrollRoot = null
      scrollNodes = []
    }

    const restore = () => {
      for (const [element, aria] of hidden) {
        delete element.dataset.nativeControl
        if (aria === null) element.removeAttribute('aria-hidden')
        else element.setAttribute('aria-hidden', aria)
      }
      hidden.clear()
      for (const element of groups) delete element.dataset.nativeSurface
      groups.clear()
      applied = null
      invalidateScroll()
    }
    const mask = (projection: NativeProjection) => {
      for (const [element, aria] of hidden)
        if (!projection.masked.has(element)) {
          delete element.dataset.nativeControl
          if (aria === null) element.removeAttribute('aria-hidden')
          else element.setAttribute('aria-hidden', aria)
          hidden.delete(element)
        }
      for (const element of projection.masked) {
        if (!hidden.has(element)) hidden.set(element, element.getAttribute('aria-hidden'))
        element.dataset.nativeControl = 'true'
        element.setAttribute('aria-hidden', 'true')
      }
      for (const element of groups)
        if (!projection.groups.has(element)) {
          delete element.dataset.nativeSurface
          groups.delete(element)
        }
      for (const element of projection.groups) {
        groups.add(element)
        element.dataset.nativeSurface = 'true'
      }
    }
    const fallback = () => {
      available = false
      restore()
      root.dataset.nativeGlass = 'fallback'
      void api.release().catch(() => undefined)
    }
    const flush = async () => {
      if (disposed || !available || retryTimer) return
      if (inFlight) {
        pending = true
        return
      }
      pending = false
      const collected = collectNativeProjection(scope, revision + 1)
      const context = scrollContext(collected)
      const nextRoot = currentScrollRoot()
      const nextNodes = nativeScrollContextNodes(scope)
      if (context !== scrollSignature || nextRoot !== scrollRoot || !sameScrollNodes(nextNodes)) {
        scrollRevision = revision + 1
        scrollProjection = null
        scrollSignature = context
        scrollRoot = nextRoot
        scrollNodes = nextNodes
      }
      const projection = { ...collected, state: { ...collected.state, scrollRevision } }
      const nextSignature = JSON.stringify([
        projection.state.appearance,
        projection.state.contrast,
        projection.state.reduceTransparency,
        projection.state.viewport,
        window.devicePixelRatio,
        projection.state.modal,
        projection.state.surfaces,
        projection.identity,
        scrollRevision
      ])
      if (nextSignature === signature) return
      signature = nextSignature
      revision += 1
      applied = null
      inFlight = true
      try {
        const ack = await api.present(projection.state)
        if (disposed || !available) return
        if (ack.applied && ack.revision === revision) {
          rejected = 0
          rejectedViewport = ''
          mask(projection)
          applied = projection
          // An old acknowledgment cannot revalidate a replaced target or a
          // context that changed while this presentation was in transit.
          scrollProjection =
            scrollSignature === context &&
            scrollContext(collectNativeProjection(scope, revision)) === context &&
            currentScrollRoot() === nextRoot &&
            sameScrollNodes(nativeScrollContextNodes(scope))
              ? projection
              : null
          root.dataset.nativeGlass = 'native'
          delete root.dataset.nativeFailure
          delete root.dataset.nativeGeometry
          delete root.dataset.nativeStaleRevision
          root.dataset.nativeScope = scope
          root.dataset.nativeRevision = String(revision)
          if (ack.focusContent && !projection.state.modal) {
            const selected = document.querySelector<HTMLElement>(
              '.signal-row__select[aria-current="true"]'
            )
            ;(selected ?? focusableWebElements()[0])?.focus()
          }
        } else {
          restore()
          root.dataset.nativeGlass = 'recovering'
          // Only geometry lag keeps the host. A renderer restart can reset its
          // revision while an older presentation is still in transit.
          if (!ack.geometryMismatch) await api.release()
          if (ack.geometryMismatch)
            root.dataset.nativeGeometry = JSON.stringify(ack.geometryMismatch)
          if (ack.staleRevision !== undefined)
            root.dataset.nativeStaleRevision = JSON.stringify({
              requested: revision,
              accepted: ack.staleRevision
            })
          signature = ''
          const viewport = JSON.stringify([projection.state.viewport, window.devicePixelRatio])
          rejected = viewport === rejectedViewport ? rejected + 1 : 1
          rejectedViewport = viewport
          if (rejected >= 3) {
            root.dataset.nativeFailure = 'presentation-rejected'
            fallback()
          } else {
            // Resize/zoom can briefly leave Chromium's viewport behind the
            // native window. Re-measure after it settles; never relax bounds.
            retryTimer = window.setTimeout(() => {
              retryTimer = 0
              schedule()
            }, 100)
          }
        }
      } catch {
        if (!disposed) {
          root.dataset.nativeFailure = 'presentation-error'
          fallback()
        }
      } finally {
        inFlight = false
        if (pending) schedule()
      }
    }
    const schedule = () => {
      if (disposed || !available || frame || retryTimer) return
      frame = requestAnimationFrame(() => {
        frame = 0
        void flush()
      })
    }
    const event = (event: NativeGlassEvent) => {
      if (disposed) return
      if (event.kind === 'window-active') {
        if (available) root.dataset.windowActive = String(event.active)
        return
      }
      if (event.kind === 'fallback') {
        fallback()
        return
      }
      if (event.kind === 'scroll-reset') {
        if (available && event.revision >= scrollRevision && event.revision <= revision) {
          invalidateScroll()
          schedule()
        }
        return
      }
      if (event.kind === 'scroll') {
        if (!available) return
        const current = collectNativeProjection(scope, revision)
        if (
          current.state.modal ||
          scrollContext(current) !== scrollSignature ||
          currentScrollRoot() !== scrollRoot ||
          !sameScrollNodes(nativeScrollContextNodes(scope))
        ) {
          invalidateScroll()
          schedule()
          return
        }
        if (
          !scrollProjection ||
          event.revision < scrollProjection.state.scrollRevision ||
          event.revision > revision
        )
          return
        const button = scrollProjection.controls.get(event.id)
        if (button?.isConnected && current.controls.get(event.id) === button)
          scrollWebAncestors(button, event.deltaX, event.deltaY)
        return
      }
      if (
        !applied ||
        event.revision !== applied.state.revision ||
        document.querySelector('[role="dialog"][aria-modal="true"]')
      )
        return
      if (event.kind === 'activate' || event.kind === 'key') {
        if (collectNativeProjection(scope, revision).identity !== applied.identity) return
        const button = applied.controls.get(event.id)
        if (button?.isConnected && !button.disabled) {
          if (event.kind === 'activate') button.click()
          else
            button.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: event.key,
                metaKey: event.metaKey,
                shiftKey: event.shiftKey,
                repeat: event.repeat,
                bubbles: true,
                cancelable: true
              })
            )
        }
      } else {
        const targets = focusableWebElements()
        const target = event.edge === 'first' ? targets[0] : targets.at(-1)
        target?.focus()
      }
    }
    const keyDown = (event: KeyboardEvent) => {
      if (
        event.key !== 'Tab' ||
        event.defaultPrevented ||
        !applied ||
        applied.state.modal ||
        document.querySelector('[role="dialog"][aria-modal="true"]')
      )
        return
      const targets = focusableWebElements()
      const edge = event.shiftKey ? targets[0] : targets.at(-1)
      if (edge !== document.activeElement) return
      event.preventDefault()
      const reverse = event.shiftKey
      void api
        .focus(reverse ? 'last' : 'first', applied.state.revision)
        .then((focused) => {
          if (!focused) (reverse ? targets.at(-1) : targets[0])?.focus()
        })
        .catch(fallback)
    }
    const unsubscribe = api.onEvent(event)
    const observeContext = () => {
      if (
        scrollSignature &&
        (scrollContext(collectNativeProjection(scope, revision)) !== scrollSignature ||
          currentScrollRoot() !== scrollRoot ||
          !sameScrollNodes(nativeScrollContextNodes(scope)))
      )
        invalidateScroll()
      schedule()
    }
    const resize = () => {
      invalidateScroll()
      schedule()
    }
    const observer = new MutationObserver(observeContext)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true
    })
    const mediaQueries = [
      '(prefers-color-scheme: dark)',
      '(prefers-contrast: more)',
      '(prefers-reduced-transparency: reduce)'
    ]
      .map((query) => window.matchMedia?.(query))
      .filter((query) => query !== undefined)
    mediaQueries.forEach((query) => query.addEventListener('change', schedule))
    window.addEventListener('resize', resize)
    document.addEventListener('scroll', schedule, true)
    document.addEventListener('keydown', keyDown, true)
    void api
      .getStatus()
      .then((status) => {
        if (disposed) return
        available = status.available
        scope = status.scope
        if (available) {
          root.dataset.windowActive = String(status.windowActive)
          schedule()
        }
      })
      .catch(fallback)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      window.clearTimeout(retryTimer)
      observer.disconnect()
      mediaQueries.forEach((query) => query.removeEventListener('change', schedule))
      unsubscribe()
      window.removeEventListener('resize', resize)
      document.removeEventListener('scroll', schedule, true)
      document.removeEventListener('keydown', keyDown, true)
      restore()
      delete root.dataset.nativeGlass
      delete root.dataset.nativeScope
      delete root.dataset.nativeRevision
      delete root.dataset.nativeFailure
      delete root.dataset.nativeGeometry
      delete root.dataset.nativeStaleRevision
      void api.release().catch(() => undefined)
    }
  }, [api])
}

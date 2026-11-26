import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

const SIDEBAR_WIDTH_STORAGE_KEY = 'therss.sidebar-width'
export const SIDEBAR_MIN_WIDTH = 184
const SIDEBAR_MAX_WIDTH = 360
const SIDEBAR_KEYBOARD_STEP = 8
const SIDEBAR_CONSTRAINED_VIEWPORT_WIDTH = 760
const MAIN_CONTENT_MIN_WIDTH = 640

interface SidebarResizeDrag {
  readonly pointerId: number
  readonly startX: number
  readonly startWidth: number
  readonly startPreferredWidth: number
}

function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)))
}

function defaultSidebarWidth(viewportWidth: number): number {
  if (viewportWidth <= 920) return SIDEBAR_MIN_WIDTH
  if (viewportWidth <= 1120) return 196
  return 224
}

function maximumSidebarWidth(viewportWidth: number): number {
  return clampSidebarWidth(viewportWidth - MAIN_CONTENT_MIN_WIDTH)
}

function readSidebarWidth(): number {
  try {
    const storedWidth = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY))
    return Number.isFinite(storedWidth) && storedWidth > 0
      ? clampSidebarWidth(storedWidth)
      : defaultSidebarWidth(window.innerWidth)
  } catch {
    return defaultSidebarWidth(window.innerWidth)
  }
}

function persistSidebarWidth(width: number): void {
  try {
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(width))
  } catch {
    // Resizing remains available when renderer storage is unavailable.
  }
}

export function useSidebarResize() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [preferredSidebarWidth, setPreferredSidebarWidth] = useState(readSidebarWidth)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const [isSidebarResizing, setIsSidebarResizing] = useState(false)
  const preferredSidebarWidthRef = useRef(preferredSidebarWidth)
  const sidebarResizeDragRef = useRef<SidebarResizeDrag | null>(null)

  const sidebarMaximumWidth = maximumSidebarWidth(viewportWidth)
  const sidebarWidth = Math.min(preferredSidebarWidth, sidebarMaximumWidth)
  const isSidebarConstrained = viewportWidth <= SIDEBAR_CONSTRAINED_VIEWPORT_WIDTH
  const isSidebarEffectivelyCollapsed = isSidebarCollapsed || isSidebarConstrained

  const updateSidebarWidth = useCallback(
    (width: number, persist: boolean) => {
      const maximumWidth = maximumSidebarWidth(viewportWidth)
      const currentPreferredWidth = preferredSidebarWidthRef.current
      const currentWidth = Math.min(currentPreferredWidth, maximumWidth)
      const nextWidth = Math.min(clampSidebarWidth(width), maximumWidth)
      if (nextWidth === currentWidth && currentPreferredWidth !== currentWidth) return
      preferredSidebarWidthRef.current = nextWidth
      setPreferredSidebarWidth(nextWidth)
      if (persist) persistSidebarWidth(nextWidth)
    },
    [viewportWidth]
  )

  const startSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isSidebarEffectivelyCollapsed || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    sidebarResizeDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: sidebarWidth,
      startPreferredWidth: preferredSidebarWidthRef.current
    }
    setIsSidebarResizing(true)
  }

  const moveSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = sidebarResizeDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    updateSidebarWidth(drag.startWidth + event.clientX - drag.startX, false)
  }

  const finishSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = sidebarResizeDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    const finalWidth = Math.min(
      clampSidebarWidth(drag.startWidth + event.clientX - drag.startX),
      maximumSidebarWidth(viewportWidth)
    )
    if (finalWidth === drag.startWidth && drag.startPreferredWidth !== drag.startWidth) {
      preferredSidebarWidthRef.current = drag.startPreferredWidth
      setPreferredSidebarWidth(drag.startPreferredWidth)
    } else {
      updateSidebarWidth(finalWidth, true)
    }
    sidebarResizeDragRef.current = null
    setIsSidebarResizing(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const cancelSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = sidebarResizeDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    preferredSidebarWidthRef.current = drag.startPreferredWidth
    setPreferredSidebarWidth(drag.startPreferredWidth)
    sidebarResizeDragRef.current = null
    setIsSidebarResizing(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const resizeSidebarWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    let nextWidth: number | null = null
    const step = event.shiftKey ? SIDEBAR_KEYBOARD_STEP * 4 : SIDEBAR_KEYBOARD_STEP
    if (event.key === 'ArrowLeft') nextWidth = sidebarWidth - step
    if (event.key === 'ArrowRight') nextWidth = sidebarWidth + step
    if (event.key === 'Home') nextWidth = SIDEBAR_MIN_WIDTH
    if (event.key === 'End') nextWidth = SIDEBAR_MAX_WIDTH
    if (nextWidth === null) return
    event.preventDefault()
    updateSidebarWidth(nextWidth, true)
  }

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((current) => !current)
  }, [])

  const toggleSidebarIfUnconstrained = useCallback(() => {
    if (!isSidebarConstrained) setIsSidebarCollapsed((current) => !current)
  }, [isSidebarConstrained])

  useEffect(() => {
    const handleWindowResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [])

  return {
    sidebarWidth,
    sidebarMaximumWidth,
    isSidebarConstrained,
    isSidebarEffectivelyCollapsed,
    isSidebarResizing,
    toggleSidebar,
    toggleSidebarIfUnconstrained,
    startSidebarResize,
    moveSidebarResize,
    finishSidebarResize,
    cancelSidebarResize,
    resizeSidebarWithKeyboard
  }
}

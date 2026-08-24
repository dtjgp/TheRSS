import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject
} from 'react'

const DEFAULT_BEFORE_WIDTH = 320
const MIN_BEFORE_WIDTH = 260
const MAX_BEFORE_WIDTH = 520
const MIN_AFTER_WIDTH = 420
const SIDEBAR_ALLOWANCE = 196
const DIVIDER_WIDTH = 8
const STACKED_VIEWPORT_WIDTH = 920
const KEYBOARD_STEP = 8

interface ResizeDrag {
  readonly pointerId: number
  readonly startX: number
  readonly startWidth: number
  readonly startPreferredWidth: number
}

interface ResizableSplitPaneProps {
  readonly ariaLabel: string
  readonly storageKey: string
  readonly before: ReactNode
  readonly after: ReactNode
  readonly containerRef?: RefObject<HTMLDivElement | null>
  readonly className?: string
}

function clampWidth(width: number): number {
  return Math.min(MAX_BEFORE_WIDTH, Math.max(MIN_BEFORE_WIDTH, Math.round(width)))
}

function maximumWidth(viewportWidth: number): number {
  if (viewportWidth <= STACKED_VIEWPORT_WIDTH) return MIN_BEFORE_WIDTH
  return clampWidth(viewportWidth - SIDEBAR_ALLOWANCE - MIN_AFTER_WIDTH - DIVIDER_WIDTH)
}

function readPreferredWidth(storageKey: string): number {
  try {
    const value = Number(window.localStorage.getItem(storageKey))
    return Number.isFinite(value) && value > 0 ? clampWidth(value) : DEFAULT_BEFORE_WIDTH
  } catch {
    return DEFAULT_BEFORE_WIDTH
  }
}

function persistPreferredWidth(storageKey: string, width: number): void {
  try {
    window.localStorage.setItem(storageKey, String(width))
  } catch {
    // The split remains adjustable for this session when renderer storage is unavailable.
  }
}

export function ResizableSplitPane({
  ariaLabel,
  storageKey,
  before,
  after,
  containerRef,
  className = ''
}: ResizableSplitPaneProps) {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const [preferredWidth, setPreferredWidth] = useState(() => readPreferredWidth(storageKey))
  const [isResizing, setIsResizing] = useState(false)
  const preferredWidthRef = useRef(preferredWidth)
  const dragRef = useRef<ResizeDrag | null>(null)
  const currentMaximum = maximumWidth(viewportWidth)
  const effectiveWidth = Math.min(preferredWidth, currentMaximum)
  const isStacked = viewportWidth <= STACKED_VIEWPORT_WIDTH

  const updateWidth = useCallback(
    (width: number, persist: boolean) => {
      const maximum = maximumWidth(viewportWidth)
      const currentPreferred = preferredWidthRef.current
      const currentEffective = Math.min(currentPreferred, maximum)
      const nextWidth = Math.min(clampWidth(width), maximum)
      if (nextWidth === currentEffective && currentPreferred !== currentEffective) return
      preferredWidthRef.current = nextWidth
      setPreferredWidth(nextWidth)
      if (persist) persistPreferredWidth(storageKey, nextWidth)
    },
    [storageKey, viewportWidth]
  )

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isStacked) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: effectiveWidth,
      startPreferredWidth: preferredWidthRef.current
    }
    setIsResizing(true)
  }

  const moveResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    updateWidth(drag.startWidth + event.clientX - drag.startX, false)
  }

  const finishResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    const finalWidth = Math.min(
      clampWidth(drag.startWidth + event.clientX - drag.startX),
      currentMaximum
    )
    if (finalWidth === drag.startWidth && drag.startPreferredWidth !== drag.startWidth) {
      preferredWidthRef.current = drag.startPreferredWidth
      setPreferredWidth(drag.startPreferredWidth)
    } else {
      updateWidth(finalWidth, true)
    }
    dragRef.current = null
    setIsResizing(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const cancelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    preferredWidthRef.current = drag.startPreferredWidth
    setPreferredWidth(drag.startPreferredWidth)
    dragRef.current = null
    setIsResizing(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const resizeWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? KEYBOARD_STEP * 4 : KEYBOARD_STEP
    let nextWidth: number | null = null
    if (event.key === 'ArrowLeft') nextWidth = effectiveWidth - step
    if (event.key === 'ArrowRight') nextWidth = effectiveWidth + step
    if (event.key === 'Home') nextWidth = MIN_BEFORE_WIDTH
    if (event.key === 'End') nextWidth = MAX_BEFORE_WIDTH
    if (nextWidth === null) return
    event.preventDefault()
    updateWidth(nextWidth, true)
  }

  return (
    <div
      ref={containerRef}
      className={`resizable-split-pane ${className} ${isResizing ? 'resizable-split-pane--resizing' : ''}`}
      data-testid="resizable-split-pane"
      style={{ '--split-before-width': `${effectiveWidth}px` } as CSSProperties}
    >
      {before}
      <div
        className="split-pane-divider"
        role="separator"
        aria-label={ariaLabel}
        aria-orientation="vertical"
        aria-valuemin={MIN_BEFORE_WIDTH}
        aria-valuemax={currentMaximum}
        aria-valuenow={effectiveWidth}
        aria-valuetext={`${effectiveWidth} pixels`}
        hidden={isStacked}
        tabIndex={isStacked ? -1 : 0}
        title="Drag to resize"
        onPointerDown={startResize}
        onPointerMove={moveResize}
        onPointerUp={finishResize}
        onPointerCancel={cancelResize}
        onLostPointerCapture={cancelResize}
        onKeyDown={resizeWithKeyboard}
      />
      {after}
    </div>
  )
}

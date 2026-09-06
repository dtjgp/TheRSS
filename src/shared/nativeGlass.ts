export const NATIVE_CONTROL_IDS = [
  'discover',
  'saved',
  'analytics',
  'sources',
  'settings',
  'source-status',
  'sidebar-toggle',
  'save-item',
  'analyze-item',
  'promote-item',
  'dismiss-item',
  'undo'
] as const
export type NativeControlId = (typeof NATIVE_CONTROL_IDS)[number]
export type NativeSurfaceId = 'sidebar' | 'header' | 'actions' | 'toast'
export type NativeGlassScope = 'pilot' | 'full'
export interface NativeRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}
export interface NativeControl {
  readonly id: NativeControlId
  readonly label: string
  readonly rect: NativeRect
  readonly enabled: boolean
  readonly selected: boolean
  readonly iconOnly: boolean
}
export interface NativeLabel {
  readonly id: 'sidebar-title' | 'header-title' | 'header-date' | 'header-context' | 'toast-copy'
  readonly text: string
  readonly rect: NativeRect
  readonly fontSize: number
  readonly bold: boolean
  readonly tone: 'primary' | 'secondary' | 'error'
}
export interface NativeSurface {
  readonly id: NativeSurfaceId
  readonly rect: NativeRect
  readonly controls: readonly NativeControl[]
  readonly labels: readonly NativeLabel[]
}
export interface NativeGlassState {
  readonly appearance: 'light' | 'dark'
  readonly contrast: 'normal' | 'more'
  readonly reduceTransparency: boolean
  readonly revision: number
  readonly viewport: { readonly width: number; readonly height: number }
  readonly modal: boolean
  readonly surfaces: readonly NativeSurface[]
}
export interface NativeGlassStatus {
  readonly available: boolean
  readonly active: boolean
  readonly scope: NativeGlassScope
  readonly windowActive: boolean
  readonly reason:
    | 'disabled'
    | 'unsupported-platform'
    | 'unsupported-system'
    | 'module-unavailable'
    | 'native-failure'
    | null
}
export interface NativeGlassAck {
  readonly applied: boolean
  readonly revision: number
  readonly focusContent?: boolean
}
export type NativeGlassEvent =
  | { readonly kind: 'activate'; readonly id: NativeControlId; readonly revision: number }
  | {
      readonly kind: 'scroll'
      readonly id: NativeControlId
      readonly deltaX: number
      readonly deltaY: number
      readonly revision: number
    }
  | {
      readonly kind: 'key'
      readonly id: NativeControlId
      readonly key: string
      readonly metaKey: boolean
      readonly shiftKey: boolean
      readonly repeat: boolean
      readonly revision: number
    }
  | { readonly kind: 'focus-content'; readonly edge: 'first' | 'last'; readonly revision: number }
  | { readonly kind: 'window-active'; readonly active: boolean }
  | { readonly kind: 'fallback'; readonly reason: 'native-failure' }
export interface NativeGlassApi {
  getStatus(): Promise<NativeGlassStatus>
  present(state: NativeGlassState): Promise<NativeGlassAck>
  focus(edge: 'first' | 'last', revision: number): Promise<boolean>
  release(): Promise<void>
  onEvent(listener: (event: NativeGlassEvent) => void): () => void
}

export const CONTROL_SURFACE: Readonly<Record<NativeControlId, NativeSurfaceId>> = {
  discover: 'sidebar',
  saved: 'sidebar',
  analytics: 'sidebar',
  sources: 'sidebar',
  settings: 'sidebar',
  'source-status': 'sidebar',
  'sidebar-toggle': 'header',
  'save-item': 'actions',
  'analyze-item': 'actions',
  'promote-item': 'actions',
  'dismiss-item': 'actions',
  undo: 'toast'
}

function isRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2147483647
}
export function parseNativeGlassEvent(value: unknown): NativeGlassEvent | null {
  if (!value || typeof value !== 'object') return null
  const event = value as Record<string, unknown>
  if (event.kind === 'window-active' && typeof event.active === 'boolean')
    return { kind: event.kind, active: event.active }
  if (event.kind === 'fallback' && event.reason === 'native-failure')
    return { kind: event.kind, reason: event.reason }
  if (!isRevision(event.revision)) return null
  if (
    event.kind === 'activate' &&
    typeof event.id === 'string' &&
    NATIVE_CONTROL_IDS.some((id) => id === event.id)
  )
    return { kind: event.kind, id: event.id as NativeControlId, revision: event.revision }
  if (event.kind === 'focus-content' && (event.edge === 'first' || event.edge === 'last'))
    return { kind: event.kind, edge: event.edge, revision: event.revision }
  if (
    event.kind === 'scroll' &&
    NATIVE_CONTROL_IDS.some((id) => id === event.id) &&
    [event.deltaX, event.deltaY].every(
      (value) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 16384
    )
  )
    return {
      kind: 'scroll',
      id: event.id as NativeControlId,
      deltaX: event.deltaX as number,
      deltaY: event.deltaY as number,
      revision: event.revision
    }
  if (
    event.kind === 'key' &&
    NATIVE_CONTROL_IDS.some((id) => id === event.id) &&
    typeof event.metaKey === 'boolean' &&
    typeof event.shiftKey === 'boolean' &&
    typeof event.repeat === 'boolean' &&
    (event.metaKey
      ? event.key === 'z' && !event.shiftKey
      : ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 's', 'd', 'a'].includes(
          event.key as string
        ))
  )
    return {
      kind: 'key',
      id: event.id as NativeControlId,
      key: event.key as string,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      repeat: event.repeat,
      revision: event.revision
    }
  return null
}

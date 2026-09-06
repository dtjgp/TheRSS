import { nativeGlassStateSchema } from '../shared/nativeGlassSchema'
import { CONTROL_SURFACE, parseNativeGlassEvent } from '../shared/nativeGlass'
import type {
  NativeGlassAck,
  NativeGlassEvent,
  NativeGlassScope,
  NativeGlassState,
  NativeGlassStatus
} from '../shared/nativeGlass'

export interface NativeGlassBinding {
  attach(handle: Buffer, listener: (event: string) => void): void
  present(handle: Buffer, scene: string): boolean | void
  focus(handle: Buffer, edge: 'first' | 'last'): boolean
  suspend(handle: Buffer): boolean
  release(handle: Buffer): void
  inspect(handle: Buffer): string
}
export interface NativeWindowPort {
  getNativeWindowHandle(): Buffer
  getBounds(): { width: number; height: number }
  isDestroyed(): boolean
  isFocused(): boolean
  webContents: { getZoomFactor(): number; focus(): void }
}

export class NativeGlassSession {
  private state: NativeGlassState | null = null
  private active = false
  private suspended = false
  private failed = false
  private generation = 0
  constructor(
    private readonly window: NativeWindowPort,
    private readonly binding: NativeGlassBinding,
    private readonly scope: NativeGlassScope,
    private readonly emit: (event: NativeGlassEvent) => void
  ) {}

  status(): NativeGlassStatus {
    return {
      available: !this.failed && !this.window.isDestroyed(),
      active: this.active,
      scope: this.scope,
      windowActive: !this.window.isDestroyed() && this.window.isFocused(),
      reason: this.failed ? 'native-failure' : null
    }
  }
  present(input: unknown): NativeGlassAck {
    const parsed = nativeGlassStateSchema.safeParse(input)
    if (!parsed.success) throw new Error('Invalid native glass state')
    const state = parsed.data
    if (
      this.scope === 'pilot' &&
      state.surfaces.some((surface) => surface.id !== 'sidebar' && surface.id !== 'header')
    )
      throw new Error('Surface is outside the native pilot')
    const rejected = { applied: false, revision: state.revision }
    if (this.failed || this.window.isDestroyed()) return rejected
    if (state.revision <= (this.state?.revision ?? 0))
      return { ...rejected, staleRevision: this.state?.revision ?? 0 }
    const scale = this.window.webContents.getZoomFactor()
    const bounds = this.window.getBounds()
    if (
      Math.abs(state.viewport.width * scale - bounds.width) > 2 ||
      Math.abs(state.viewport.height * scale - bounds.height) > 2
    ) {
      if (this.active && !this.suspended) {
        try {
          this.suspended = true
          if (this.binding.suspend(this.window.getNativeWindowHandle()))
            this.window.webContents.focus()
        } catch {
          this.fail()
        }
      }
      return {
        ...rejected,
        geometryMismatch: {
          viewport: state.viewport,
          window: { width: bounds.width, height: bounds.height },
          scale
        }
      }
    }
    try {
      if (!this.active) {
        const generation = this.generation
        // Attach may change the native parent/material before throwing. Ensure
        // the failure path attempts release even after partial initialization.
        this.active = true
        this.binding.attach(this.window.getNativeWindowHandle(), (serialized) => {
          if (generation !== this.generation) return
          try {
            this.receive(JSON.parse(serialized))
          } catch {
            /* malformed native event is discarded */
          }
        })
      }
      const focusContent =
        this.binding.present(
          this.window.getNativeWindowHandle(),
          JSON.stringify({ ...state, scale })
        ) === true
      this.suspended = false
      if (focusContent || (state.modal && !this.state?.modal)) this.window.webContents.focus()
      this.state = state
      return {
        applied: true,
        revision: state.revision,
        ...(focusContent ? { focusContent: true } : {})
      }
    } catch {
      this.fail()
      return rejected
    }
  }
  private receive(input: unknown): void {
    const event = parseNativeGlassEvent(input)
    if (
      !event ||
      this.window.isDestroyed() ||
      !this.state ||
      this.suspended ||
      this.state.modal ||
      !('revision' in event) ||
      event.revision !== this.state.revision
    )
      return
    if (event.kind === 'activate' || event.kind === 'key' || event.kind === 'scroll') {
      const control = this.state.surfaces
        .flatMap((surface) => surface.controls)
        .find((control) => control.id === event.id)
      if (!control || (!control.enabled && event.kind !== 'scroll')) return
      if (
        event.kind === 'key' &&
        event.key.startsWith('Arrow') &&
        CONTROL_SURFACE[event.id] === 'actions'
      )
        this.window.webContents.focus()
    } else if (event.kind === 'focus-content') this.window.webContents.focus()
    this.emit(event)
  }
  focus(edge: 'first' | 'last', revision: number): boolean {
    if (
      !this.active ||
      !this.state ||
      this.suspended ||
      this.state.modal ||
      revision !== this.state.revision ||
      this.window.isDestroyed()
    )
      return false
    try {
      return this.binding.focus(this.window.getNativeWindowHandle(), edge)
    } catch {
      this.fail()
      return false
    }
  }
  release(): void {
    this.generation += 1
    if (this.active && !this.window.isDestroyed()) {
      try {
        this.binding.release(this.window.getNativeWindowHandle())
      } catch {
        this.failed = true
      }
    }
    this.active = false
    this.suspended = false
    this.state = null
  }
  private fail(): void {
    this.release()
    this.failed = true
    this.emit({ kind: 'fallback', reason: 'native-failure' })
  }
}

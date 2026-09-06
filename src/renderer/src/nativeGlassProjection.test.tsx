// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DiscoverResultWorkspace } from './DiscoverResultWorkspace'
import { createApi, createDiscoverSnapshot } from './App.testSupport'
import {
  collectNativeProjection,
  focusableWebElements,
  scrollWebAncestors
} from './nativeGlassProjection'
import { nativeGlassStateSchema } from '../../shared/nativeGlassSchema'

function geometry() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    width: 200,
    height: 40,
    top: 0,
    left: 0,
    right: 200,
    bottom: 40,
    toJSON: () => ({})
  })
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('native projection from product DOM', () => {
  it('keeps Discover Save and Analyze native before and after saving', () => {
    geometry()
    const items = createDiscoverSnapshot().items
    const props = {
      api: createApi(),
      items,
      analysis: null,
      analyzingItemId: null,
      savingItemId: null,
      isSaveDisabled: false,
      sessionId: 'test',
      onToggleSave: vi.fn(),
      onAnalyze: vi.fn()
    }
    const view = render(<DiscoverResultWorkspace {...props} />)
    const projected = () =>
      collectNativeProjection('full', 1).state.surfaces.find((s) => s.id === 'actions')!
    expect(projected().controls.map((c) => c.id)).toEqual(
      expect.arrayContaining(['save-item', 'analyze-item', 'promote-item'])
    )
    view.rerender(
      <DiscoverResultWorkspace {...props} items={items.map((item) => ({ ...item, saved: true }))} />
    )
    expect(projected().controls.find((c) => c.id === 'save-item')?.selected).toBe(true)
    expect(projected().controls.find((c) => c.id === 'analyze-item')).toBeDefined()
  })
  it('keeps long non-BMP feedback within the shared text boundary', () => {
    geometry()
    render(
      <div className="triage-toast">
        <span>{'𝛼🧪'.repeat(100)}</span>
        <button>Undo</button>
      </div>
    )
    const projection = collectNativeProjection('full', 1)
    expect(nativeGlassStateSchema.safeParse(projection.state).success).toBe(true)
    expect(projection.state.surfaces[0]!.labels[0]!.text).not.toMatch(/[\uD800-\uDBFF]$/u)
  })
  it('projects clipped action edges so the glass cannot cover an unprojected web button', () => {
    geometry()
    render(
      <div className="signal-detail__actions" style={{ overflow: 'auto' }}>
        <button data-native-action="analyze-item">Analyze</button>
        <button data-native-action="save-item">Save</button>
      </div>
    )
    const button = document.querySelector<HTMLButtonElement>('[data-native-action="save-item"]')!
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      x: 170,
      y: 0,
      width: 100,
      height: 40,
      top: 0,
      left: 170,
      right: 270,
      bottom: 40,
      toJSON: () => ({})
    })
    const projection = collectNativeProjection('full', 1)
    expect(projection.state.surfaces[0]!.controls.map((c) => c.id)).toEqual([
      'analyze-item',
      'save-item'
    ])
    expect(projection.state.surfaces[0]!.controls[1]!.rect.width).toBe(100)
    expect(projection.masked.has(button)).toBe(true)
  })
  it('projects only visible status text and preserves system appearance and collapsed navigation', () => {
    geometry()
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    render(
      <div className="app-shell app-shell--sidebar-collapsed" data-view="saved">
        <aside className="sidebar">
          <span className="sidebar__title">TheRSS</span>
          <button aria-label="02 Saved" className="nav-item--active">
            Saved
          </button>
          <button className="sidebar__footer" aria-label="Sources need attention">
            <svg />
            <kbd>F</kbd>
          </button>
        </aside>
        <header className="topbar">
          <button className="toolbar-button" title="Show sidebar" />
          <span className="profile-name" style={{ fontWeight: 600, fontSize: 48 }}>
            Saved
          </span>
          <time className="dateline">2026-09-06</time>
          <div className="topbar-context" data-tone="attention">
            <span>3 saved</span>
            <span style={{ display: 'none' }}>Hidden context</span>
            <span>Partial sources</span>
          </div>
        </header>
      </div>
    )
    const state = collectNativeProjection('full', 1).state
    expect(state).toMatchObject({ appearance: 'dark', contrast: 'more', reduceTransparency: true })
    expect(state.surfaces[0]!.controls.find((c) => c.id === 'saved')).toMatchObject({
      iconOnly: true,
      selected: true
    })
    expect(state.surfaces[0]!.controls.find((c) => c.id === 'source-status')?.label).toBe(
      'Sources need attention'
    )
    const labels = state.surfaces[1]!.labels
    expect(labels.find((l) => l.id === 'header-context')).toMatchObject({
      text: '3 saved · Partial sources',
      tone: 'error'
    })
    expect(labels.find((l) => l.id === 'header-title')).toMatchObject({
      fontSize: 36,
      bold: true,
      tone: 'primary'
    })
  })
  it('does not project offscreen controls or create empty native surfaces', () => {
    geometry()
    render(
      <>
        <aside className="sidebar">
          <button aria-label="01 Discover">Discover</button>
        </aside>
        <header className="topbar" />
      </>
    )
    const button = document.querySelector('button')!
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      x: 20000,
      y: 0,
      width: 10,
      height: 10,
      top: 0,
      left: 20000,
      right: 20010,
      bottom: 10,
      toJSON: () => ({})
    })
    expect(collectNativeProjection('full', 1).state.surfaces).toEqual([])
    expect(collectNativeProjection('pilot', 1).masked.size).toBe(0)
  })
  it('excludes disabled, hidden, inert and negative-tabindex web targets from native handoff', () => {
    render(
      <div>
        <button>Visible</button>
        <button disabled>Disabled</button>
        <button tabIndex={-1}>Negative</button>
        <div hidden>
          <button>Hidden</button>
        </div>
        <div inert>
          <button>Inert</button>
        </div>
        <button aria-hidden="true">AX hidden</button>
        <button style={{ display: 'none' }}>No display</button>
        <button style={{ visibility: 'hidden' }}>No visibility</button>
      </div>
    )
    expect(focusableWebElements().map((el) => el.textContent)).toEqual(['Visible'])
  })
  it('routes both scroll axes through the existing containers without crossing contained boundaries', () => {
    const view = render(
      <div data-testid="outer" style={{ overflowX: 'auto', overflowY: 'auto' }}>
        <div data-testid="inner" style={{ overflowX: 'auto', overflowY: 'auto' }}>
          <button>Action</button>
        </div>
      </div>
    )
    const outer = view.getByTestId('outer'),
      inner = view.getByTestId('inner'),
      button = view.getByRole('button')
    // JSDOM has no layout; model the browser clamping an exhausted inner pane.
    Object.defineProperty(outer, 'scrollLeft', { value: 0, writable: true, configurable: true })
    Object.defineProperty(outer, 'scrollTop', { value: 0, writable: true, configurable: true })
    Object.defineProperty(inner, 'scrollLeft', {
      get: () => 0,
      set: () => undefined,
      configurable: true
    })
    Object.defineProperty(inner, 'scrollTop', {
      get: () => 0,
      set: () => undefined,
      configurable: true
    })
    scrollWebAncestors(button, 60, 80)
    expect([outer.scrollLeft, outer.scrollTop]).toEqual([60, 80])
    inner.style.overscrollBehaviorX = 'contain'
    inner.style.overscrollBehaviorY = 'none'
    scrollWebAncestors(button, 60, 80)
    expect([outer.scrollLeft, outer.scrollTop]).toEqual([60, 80])
    scrollWebAncestors(button, 0, 0)
    expect([outer.scrollLeft, outer.scrollTop]).toEqual([60, 80])
  })
})

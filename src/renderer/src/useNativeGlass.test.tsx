// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useNativeGlass } from './useNativeGlass'
import type { NativeGlassApi, NativeGlassEvent } from '../../shared/nativeGlass'
import { App } from './App'
import { createApi, resetAppTestEnvironment } from './App.testSupport'
import { NativeGlassSession } from '../../main/nativeGlassSession'

function Surface({
  api,
  click,
  identity = 'one',
  disabled = false,
  modal = false,
  navigation = true
}: {
  api: NativeGlassApi
  click: () => void
  identity?: string
  disabled?: boolean
  modal?: boolean
  navigation?: boolean
}) {
  useNativeGlass(api)
  return (
    <div className="app-shell" data-view="discover">
      {navigation ? (
        <aside className="sidebar">
          <button aria-label="01 Discover" onClick={click} disabled={disabled}>
            Discover
          </button>
        </aside>
      ) : null}
      <main>
        <input aria-label="Content input" />
        <article className="signal-detail" data-native-context={identity} />
        {modal ? (
          <div role="dialog" aria-modal="true">
            Modal
          </div>
        ) : null}
      </main>
    </div>
  )
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function harness() {
  let listener: (event: NativeGlassEvent) => void = () => undefined
  const api: NativeGlassApi = {
    getStatus: vi.fn(async () => ({
      available: true,
      active: false,
      scope: 'pilot' as const,
      windowActive: true,
      reason: null
    })),
    present: vi.fn(async (state) => ({ applied: true, revision: state.revision })),
    focus: vi.fn(async () => true),
    release: vi.fn(async () => undefined),
    onEvent: vi.fn((callback) => {
      listener = callback
      return () => undefined
    })
  }
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    return {
      x: 0,
      y: 0,
      width: this.tagName === 'BUTTON' ? 180 : 200,
      height: this.tagName === 'BUTTON' ? 34 : 400,
      top: 0,
      left: 0,
      right: 200,
      bottom: 400,
      toJSON: () => ({})
    }
  })
  return { api, event: (event: NativeGlassEvent) => listener(event) }
}

describe('native material handoff', () => {
  it.each(['modal', 'item', 'root', 'zoom'] as const)(
    'does not revive scroll after an observed %s round trip while acknowledgment is pending',
    async (change) => {
      const h = harness()
      render(<Surface api={h.api} click={() => undefined} />)
      await waitFor(() => expect(document.documentElement.dataset.nativeGlass).toBe('native'))
      const sidebar = document.querySelector<HTMLElement>('.sidebar')!
      sidebar.style.overflowX = 'auto'
      let acknowledge: () => void = () => undefined
      vi.mocked(h.api.present).mockImplementationOnce(
        (state) =>
          new Promise((resolve) => {
            acknowledge = () => resolve({ applied: true, revision: state.revision })
          })
      )
      sidebar.querySelector('button')!.setAttribute('aria-pressed', 'true')
      await waitFor(() => expect(h.api.present).toHaveBeenCalledTimes(2))
      const modal = document.createElement('div')
      modal.setAttribute('role', 'dialog')
      modal.setAttribute('aria-modal', 'true')
      const article = document.querySelector('.signal-detail')!
      const replacement = article.cloneNode(true) as Element
      const dpr = window.devicePixelRatio
      act(() => {
        if (change === 'modal') document.body.append(modal)
        if (change === 'item') article.setAttribute('data-native-context', 'two')
        if (change === 'root') article.replaceWith(replacement)
        if (change === 'zoom') vi.stubGlobal('devicePixelRatio', dpr * 2)
        h.event({ kind: 'scroll', id: 'discover', revision: 1, deltaX: 1, deltaY: 0 })
        if (change === 'modal') modal.remove()
        if (change === 'item') article.setAttribute('data-native-context', 'one')
        if (change === 'root') replacement.replaceWith(article)
        if (change === 'zoom') vi.stubGlobal('devicePixelRatio', dpr)
      })
      await act(async () => acknowledge())
      act(() => h.event({ kind: 'scroll', id: 'discover', revision: 1, deltaX: 7, deltaY: 0 }))
      expect(sidebar.scrollLeft).toBe(0)
      await waitFor(() => expect(h.api.present).toHaveBeenCalledTimes(3))
      expect(vi.mocked(h.api.present).mock.calls[2]![0].scrollRevision).toBe(3)
    }
  )
  it('recovers a main-process zoom interruption through the real session/hook contract', async () => {
    const h = harness()
    let zoom = 1
    let receive: (value: string) => void = () => undefined
    const session = new NativeGlassSession(
      {
        getNativeWindowHandle: () => Buffer.alloc(8),
        getBounds: () => ({ width: window.innerWidth, height: window.innerHeight }),
        isDestroyed: () => false,
        isFocused: () => true,
        webContents: { getZoomFactor: () => zoom, focus: () => undefined }
      },
      {
        attach: (_handle, listener) => {
          receive = listener
        },
        present: () => undefined,
        suspend: () => false,
        focus: () => true,
        release: () => undefined,
        inspect: () => '{}'
      },
      'pilot',
      h.event
    )
    vi.mocked(h.api.present).mockImplementation(async (state) => session.present(state))
    vi.mocked(h.api.release).mockImplementation(async () => session.release())
    render(<Surface api={h.api} click={() => undefined} />)
    await waitFor(() => expect(document.documentElement.dataset.nativeGlass).toBe('native'))
    const sidebar = document.querySelector<HTMLElement>('.sidebar')!
    sidebar.style.overflowX = 'auto'
    act(() => {
      zoom = 2
      receive(JSON.stringify({ kind: 'scroll', id: 'discover', revision: 1, deltaX: 9, deltaY: 0 }))
      zoom = 1
    })
    await waitFor(() => expect(h.api.present).toHaveBeenCalledTimes(2))
    expect(vi.mocked(h.api.present).mock.calls[1]![0].scrollRevision).toBe(2)
    expect(sidebar.scrollLeft).toBe(0)
    act(() =>
      receive(JSON.stringify({ kind: 'scroll', id: 'discover', revision: 2, deltaX: 1, deltaY: 0 }))
    )
    expect(sidebar.scrollLeft).toBe(1)
  })
  it('renews an interrupted scroll context even when the final viewport has not changed', async () => {
    const h = harness()
    render(<Surface api={h.api} click={() => undefined} />)
    await waitFor(() => expect(document.documentElement.dataset.nativeGlass).toBe('native'))
    act(() => h.event({ kind: 'scroll-reset', revision: 1 }))
    await waitFor(() => expect(h.api.present).toHaveBeenCalledTimes(2))
    expect(vi.mocked(h.api.present).mock.calls[1]![0].scrollRevision).toBe(2)
  })
  it.each(['item', 'root', 'parent', 'viewport', 'zoom', 'modal'] as const)(
    'invalidates scroll on %s changes and cannot revive it with an old acknowledgment',
    async (change) => {
      const h = harness()
      const view = render(<Surface api={h.api} click={() => undefined} />)
      await waitFor(() => expect(document.documentElement.dataset.nativeGlass).toBe('native'))
      const sidebar = document.querySelector<HTMLElement>('.sidebar')!
      const button = sidebar.querySelector('button')!
      sidebar.style.overflowX = 'auto'
      let acknowledge: () => void = () => undefined
      vi.mocked(h.api.present).mockImplementationOnce(
        (state) =>
          new Promise((resolve) => {
            acknowledge = () => resolve({ applied: true, revision: state.revision })
          })
      )
      button.setAttribute('aria-pressed', 'true')
      await waitFor(() => expect(h.api.present).toHaveBeenCalledTimes(2))
      if (change === 'item')
        view.rerender(<Surface api={h.api} click={() => undefined} identity="two" />)
      if (change === 'modal') view.rerender(<Surface api={h.api} click={() => undefined} modal />)
      if (change === 'root') {
        const root = document.querySelector('.signal-detail')!
        root.replaceWith(root.cloneNode(true))
      }
      if (change === 'parent') {
        const wrapper = document.createElement('div')
        sidebar.append(wrapper)
        wrapper.append(button)
      }
      if (change === 'viewport') vi.stubGlobal('innerWidth', window.innerWidth + 10)
      if (change === 'zoom') vi.stubGlobal('devicePixelRatio', window.devicePixelRatio * 2)
      act(() => h.event({ kind: 'scroll', id: 'discover', revision: 1, deltaX: 1, deltaY: 0 }))
      expect(sidebar.scrollLeft).toBe(0)
      await act(async () => {
        acknowledge()
        await Promise.resolve()
        h.event({ kind: 'scroll', id: 'discover', revision: 2, deltaX: 1, deltaY: 0 })
      })
      expect(sidebar.scrollLeft).toBe(0)
      fireEvent.resize(window)
      await waitFor(() => expect(h.api.present).toHaveBeenCalledTimes(3))
      expect(vi.mocked(h.api.present).mock.calls[2]![0].scrollRevision).toBe(3)
      act(() => h.event({ kind: 'scroll', id: 'discover', revision: 2, deltaX: 1, deltaY: 0 }))
      expect(sidebar.scrollLeft).toBe(0)
      act(() => h.event({ kind: 'scroll', id: 'discover', revision: 3, deltaX: 1, deltaY: 0 }))
      expect(sidebar.scrollLeft).toBe(change === 'modal' ? 0 : 1)
    }
  )
  it('conserves scroll during and after same-context layout acknowledgment without accepting clicks', async () => {
    const h = harness(),
      click = vi.fn()
    render(<Surface api={h.api} click={click} />)
    await waitFor(() => expect(document.documentElement.dataset.nativeGlass).toBe('native'))
    const sidebar = document.querySelector<HTMLElement>('.sidebar')!
    const button = sidebar.querySelector('button')!
    sidebar.style.overflowX = 'auto'
    let acknowledge: () => void = () => undefined
    vi.mocked(h.api.present).mockImplementationOnce(
      (state) =>
        new Promise((resolve) => {
          acknowledge = () => resolve({ applied: true, revision: state.revision })
        })
    )
    button.setAttribute('aria-pressed', 'true')
    await waitFor(() => expect(h.api.present).toHaveBeenCalledTimes(2))
    act(() => {
      h.event({ kind: 'scroll', id: 'discover', revision: 1, deltaX: 1, deltaY: 0 })
      h.event({ kind: 'scroll', id: 'discover', revision: 2, deltaX: 2, deltaY: 0 })
      h.event({ kind: 'scroll', id: 'discover', revision: 3, deltaX: 100, deltaY: 0 })
      h.event({ kind: 'activate', id: 'discover', revision: 1 })
    })
    expect(sidebar.scrollLeft).toBe(3)
    expect(click).not.toHaveBeenCalled()
    await act(async () => acknowledge())
    act(() => h.event({ kind: 'scroll', id: 'discover', revision: 1, deltaX: 4, deltaY: 0 }))
    expect(sidebar.scrollLeft).toBe(7)
  })
  it('never replays scroll from a rejected layout after recovery or after unmount', async () => {
    const h = harness()
    const view = render(<Surface api={h.api} click={() => undefined} />)
    await waitFor(() => expect(document.documentElement.dataset.nativeGlass).toBe('native'))
    const sidebar = document.querySelector<HTMLElement>('.sidebar')!
    sidebar.style.overflowX = 'auto'
    vi.mocked(h.api.present).mockResolvedValueOnce({ applied: false, revision: 2 })
    sidebar.querySelector('button')!.setAttribute('aria-pressed', 'true')
    await waitFor(() => expect(h.api.release).toHaveBeenCalledOnce())
    act(() => h.event({ kind: 'scroll', id: 'discover', revision: 1, deltaX: 9, deltaY: 0 }))
    expect(sidebar.scrollLeft).toBe(0)
    await waitFor(() => expect(h.api.present).toHaveBeenCalledTimes(3))
    expect(vi.mocked(h.api.present).mock.calls[2]![0].scrollRevision).toBe(3)
    act(() => {
      h.event({ kind: 'scroll', id: 'discover', revision: 1, deltaX: 9, deltaY: 0 })
      h.event({ kind: 'scroll', id: 'discover', revision: 3, deltaX: 1, deltaY: 0 })
    })
    expect(sidebar.scrollLeft).toBe(1)
    view.unmount()
    act(() => h.event({ kind: 'scroll', id: 'discover', revision: 3, deltaX: 9, deltaY: 0 }))
    expect(sidebar.scrollLeft).toBe(1)
  })
  it('allows geometry to settle while the viewport changes during resize and zoom', async () => {
    const h = harness()
    let attempts = 0
    vi.mocked(h.api.present).mockImplementation(async (state) => {
      attempts += 1
      if (attempts <= 3) {
        vi.stubGlobal('innerWidth', window.innerWidth + 10)
        return {
          applied: false,
          revision: state.revision,
          geometryMismatch: {
            viewport: state.viewport,
            window: { width: state.viewport.width + 10, height: state.viewport.height },
            scale: 1
          }
        }
      }
      return { applied: true, revision: state.revision }
    })
    render(<Surface api={h.api} click={() => undefined} />)
    await waitFor(() => expect(document.documentElement.dataset.nativeGlass).toBe('native'))
    expect(h.api.present).toHaveBeenCalledTimes(4)
    expect(h.api.release).not.toHaveBeenCalled()
  })
  it('masks a web control only after native acknowledgment and reuses its action', async () => {
    const h = harness(),
      click = vi.fn()
    let acknowledge: (value: { applied: boolean; revision: number }) => void = () => undefined
    vi.mocked(h.api.present).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          acknowledge = resolve
        })
    )
    const rendered = render(<Surface api={h.api} click={click} />)
    await waitFor(() => expect(h.api.present).toHaveBeenCalled())
    const button = screen.getByRole('button', { name: '01 Discover' })
    expect(button).not.toHaveAttribute('data-native-control')
    await act(async () => acknowledge({ applied: true, revision: 1 }))
    await waitFor(() => expect(button).toHaveAttribute('data-native-control', 'true'))
    act(() => h.event({ kind: 'activate', id: 'discover', revision: 1 }))
    expect(click).toHaveBeenCalledTimes(1)
    act(() => h.event({ kind: 'activate', id: 'discover', revision: 999 }))
    expect(click).toHaveBeenCalledTimes(1)
    act(() => h.event({ kind: 'fallback', reason: 'native-failure' }))
    expect(button).not.toHaveAttribute('data-native-control')
    expect(button).not.toHaveAttribute('aria-hidden')
    rendered.unmount()
  })
  it('leaves web controls untouched when native support is absent', async () => {
    const h = harness()
    vi.mocked(h.api.getStatus).mockResolvedValue({
      available: false,
      active: false,
      scope: 'pilot',
      windowActive: true,
      reason: 'unsupported-system'
    })
    render(<Surface api={h.api} click={() => undefined} />)
    await waitFor(() => expect(h.api.getStatus).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: '01 Discover' })).not.toHaveAttribute(
      'data-native-control'
    )
    expect(h.api.present).not.toHaveBeenCalled()
  })
  it('rejects a callback when selection changes before the next native acknowledgment', async () => {
    const h = harness(),
      click = vi.fn()
    const view = render(<Surface api={h.api} click={click} />)
    await waitFor(() => expect(document.querySelector('[data-native-control]')).not.toBeNull())
    view.rerender(<Surface api={h.api} click={click} identity="two" />)
    act(() => h.event({ kind: 'activate', id: 'discover', revision: 1 }))
    expect(click).not.toHaveBeenCalled()
  })
  it('routes keyboard events through the existing button target and modal guard', async () => {
    const h = harness(),
      click = vi.fn(),
      key = vi.fn()
    const view = render(<Surface api={h.api} click={click} />)
    await waitFor(() => expect(document.querySelector('[data-native-control]')).not.toBeNull())
    const button = document.querySelector<HTMLButtonElement>('.sidebar button')!
    button.addEventListener('keydown', key)
    const event = {
      kind: 'key' as const,
      id: 'discover' as const,
      key: 'z',
      metaKey: true,
      shiftKey: false,
      repeat: false,
      revision: 1
    }
    act(() => h.event(event))
    expect(key).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'z', metaKey: true, target: button })
    )
    expect(click).not.toHaveBeenCalled()
    view.rerender(<Surface api={h.api} click={click} modal />)
    act(() => h.event(event))
    expect(key).toHaveBeenCalledOnce()
  })
  it('hands focus in both directions across the web/native Tab boundary', async () => {
    const h = harness()
    render(<Surface api={h.api} click={() => undefined} />)
    await waitFor(() => expect(document.querySelector('[data-native-control]')).not.toBeNull())
    const input = screen.getByRole('textbox', { name: 'Content input' })
    act(() => h.event({ kind: 'focus-content', edge: 'first', revision: 1 }))
    expect(input).toHaveFocus()
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(h.api.focus).toHaveBeenLastCalledWith('first', 1)
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })
    expect(h.api.focus).toHaveBeenLastCalledWith('last', 1)
  })
  it('restores web controls after repeated geometry rejection or IPC failure', async () => {
    const h = harness()
    vi.mocked(h.api.present).mockImplementation(async (state) => ({
      applied: false,
      revision: state.revision,
      geometryMismatch: {
        viewport: state.viewport,
        window: { width: state.viewport.width + 10, height: state.viewport.height },
        scale: 1
      }
    }))
    const view = render(<Surface api={h.api} click={() => undefined} />)
    await waitFor(() => expect(document.documentElement.dataset.nativeGlass).toBe('fallback'))
    expect(h.api.present).toHaveBeenCalledTimes(3)
    expect(h.api.release).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '01 Discover' })).not.toHaveAttribute(
      'data-native-control'
    )
    view.unmount()
    const failed = harness()
    vi.mocked(failed.api.present).mockRejectedValue(new Error('IPC unavailable'))
    render(<Surface api={failed.api} click={() => undefined} />)
    await waitFor(() => expect(document.documentElement.dataset.nativeGlass).toBe('fallback'))
    expect(screen.getByRole('button', { name: '01 Discover' })).not.toHaveAttribute('aria-hidden')
  })
  it('uses acknowledgment to recover focus when a native control becomes unavailable', async () => {
    const h = harness()
    vi.mocked(h.api.present).mockImplementation(async (state) => ({
      applied: true,
      revision: state.revision,
      focusContent: true
    }))
    render(<Surface api={h.api} click={() => undefined} />)
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Content input' })).toHaveFocus()
    )
    const button = document.querySelector<HTMLButtonElement>('.sidebar button')!
    button.disabled = true
    act(() => h.event({ kind: 'activate', id: 'discover', revision: 1 }))
    expect(button).toBeDisabled()
  })
  it('retains the Settings dirty guard when navigation originates in AppKit', async () => {
    resetAppTestEnvironment()
    const h = harness()
    const api = { ...createApi(), nativeGlass: h.api }
    vi.mocked(api.confirmDiscardSettings).mockResolvedValue(false)
    render(<App api={api} />)
    const revision = () => vi.mocked(h.api.present).mock.calls.at(-1)![0].revision
    await waitFor(() => expect(document.documentElement.dataset.nativeGlass).toBe('native'))
    act(() => h.event({ kind: 'activate', id: 'settings', revision: revision() }))
    await screen.findByRole('heading', { name: 'Settings' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Personal Discover prompt' }), {
      target: { value: 'Unsaved fixture preference' }
    })
    await waitFor(() => expect(api.setSettingsDirty).toHaveBeenLastCalledWith(true))
    await waitFor(() =>
      expect(
        vi
          .mocked(h.api.present)
          .mock.calls.at(-1)![0]
          .surfaces.flatMap((s) => s.controls)
          .find((c) => c.id === 'settings')?.selected
      ).toBe(true)
    )
    act(() => h.event({ kind: 'activate', id: 'discover', revision: revision() }))
    await waitFor(() => expect(api.confirmDiscardSettings).toHaveBeenCalledOnce())
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Personal Discover prompt' })).toHaveValue(
      'Unsaved fixture preference'
    )
    expect(api.refresh).not.toHaveBeenCalled()
    expect(api.searchDiscover).not.toHaveBeenCalled()
  })
  it('releases masks for removed surfaces and preserves pre-existing ARIA values', async () => {
    const h = harness()
    const view = render(<Surface api={h.api} click={() => undefined} />)
    const button = document.querySelector<HTMLButtonElement>('.sidebar button')!
    button.setAttribute('aria-hidden', 'false')
    await waitFor(() => expect(button).toHaveAttribute('data-native-control'))
    view.rerender(<Surface api={h.api} click={() => undefined} navigation={false} />)
    await waitFor(() => expect(button).not.toHaveAttribute('data-native-control'))
    expect(button).toHaveAttribute('aria-hidden', 'false')
    expect(vi.mocked(h.api.present).mock.calls.at(-1)![0].surfaces).toEqual([])
  })
  it('publishes the latest selection after a layout update arrives during native presentation', async () => {
    const h = harness()
    let acknowledge: (value: { applied: boolean; revision: number }) => void = () => undefined
    vi.mocked(h.api.present).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          acknowledge = resolve
        })
    )
    const view = render(<Surface api={h.api} click={() => undefined} />)
    await waitFor(() => expect(h.api.present).toHaveBeenCalledOnce())
    view.rerender(<Surface api={h.api} click={() => undefined} identity="new-selection" />)
    await act(
      async () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    )
    await act(async () => acknowledge({ applied: true, revision: 1 }))
    await waitFor(() => expect(h.api.present).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(document.documentElement.dataset.nativeRevision).toBe('2'))
  })
  it('reflects native window activation and recovers when native focus fails', async () => {
    const h = harness()
    const view = render(<Surface api={h.api} click={() => undefined} />)
    await waitFor(() => expect(document.documentElement.dataset.nativeGlass).toBe('native'))
    act(() => h.event({ kind: 'window-active', active: false }))
    expect(document.documentElement.dataset.windowActive).toBe('false')
    vi.mocked(h.api.focus).mockResolvedValueOnce(false)
    const input = screen.getByRole('textbox', { name: 'Content input' })
    input.focus()
    fireEvent.keyDown(input, { key: 'Tab' })
    await waitFor(() => expect(h.api.focus).toHaveBeenCalledOnce())
    expect(input).toHaveFocus()
    vi.mocked(h.api.focus).mockRejectedValueOnce(new Error('native focus failed'))
    vi.mocked(h.api.release).mockRejectedValue(new Error('native already closed'))
    fireEvent.keyDown(input, { key: 'Tab' })
    await waitFor(() => expect(document.documentElement.dataset.nativeGlass).toBe('fallback'))
    view.unmount()
    await act(async () => undefined)
  })
})

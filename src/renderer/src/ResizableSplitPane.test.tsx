// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResizableSplitPane } from './ResizableSplitPane'

describe('ResizableSplitPane', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1180
    })
  })

  it('supports pointer and keyboard resizing and restores the preferred width', () => {
    const first = render(
      <ResizableSplitPane
        ariaLabel="Resize saved signal list"
        storageKey="therss.saved-list-width"
        before={<aside>List</aside>}
        after={<article>Detail</article>}
      />
    )
    const pane = screen.getByTestId('resizable-split-pane')
    const separator = screen.getByRole('separator', { name: 'Resize saved signal list' })
    expect(pane).toHaveStyle({ '--split-before-width': '320px' })

    fireEvent.pointerDown(separator, { pointerId: 7, clientX: 320 })
    fireEvent.pointerMove(separator, { pointerId: 7, clientX: 400 })
    fireEvent.pointerUp(separator, { pointerId: 7, clientX: 400 })
    expect(pane).toHaveStyle({ '--split-before-width': '400px' })
    expect(window.localStorage.getItem('therss.saved-list-width')).toBe('400')

    fireEvent.keyDown(separator, { key: 'ArrowLeft' })
    expect(pane).toHaveStyle({ '--split-before-width': '392px' })
    first.unmount()

    render(
      <ResizableSplitPane
        ariaLabel="Resize saved signal list"
        storageKey="therss.saved-list-width"
        before={<aside>List</aside>}
        after={<article>Detail</article>}
      />
    )
    expect(screen.getByTestId('resizable-split-pane')).toHaveStyle({
      '--split-before-width': '392px'
    })
  })

  it('caps the effective width at narrow sizes without overwriting the wider preference', () => {
    window.localStorage.setItem('therss.saved-list-width', '460')
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 920 })
    render(
      <ResizableSplitPane
        ariaLabel="Resize saved signal list"
        storageKey="therss.saved-list-width"
        before={<aside>List</aside>}
        after={<article>Detail</article>}
      />
    )

    expect(screen.getByTestId('resizable-split-pane')).toHaveStyle({
      '--split-before-width': '260px'
    })
    expect(
      screen.queryByRole('separator', { name: 'Resize saved signal list' })
    ).not.toBeInTheDocument()
    expect(window.localStorage.getItem('therss.saved-list-width')).toBe('460')

    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1360 })
    fireEvent(window, new Event('resize'))
    expect(screen.getByTestId('resizable-split-pane')).toHaveStyle({
      '--split-before-width': '460px'
    })
  })

  it('rolls back interrupted pointer movement and tolerates unavailable storage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    render(
      <ResizableSplitPane
        ariaLabel="Resize saved signal list"
        storageKey="therss.saved-list-width"
        before={<aside>List</aside>}
        after={<article>Detail</article>}
      />
    )
    const pane = screen.getByTestId('resizable-split-pane')
    const separator = screen.getByRole('separator', { name: 'Resize saved signal list' })

    fireEvent.pointerDown(separator, { pointerId: 3, clientX: 320 })
    fireEvent.pointerMove(separator, { pointerId: 3, clientX: 380 })
    expect(pane).toHaveStyle({ '--split-before-width': '380px' })
    fireEvent.pointerCancel(separator, { pointerId: 3 })
    expect(pane).toHaveStyle({ '--split-before-width': '320px' })
    expect(() => fireEvent.keyDown(separator, { key: 'ArrowRight' })).not.toThrow()
    setItem.mockRestore()
  })
})

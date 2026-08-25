import { describe, expect, it, vi } from 'vitest'
import type { MenuItemConstructorOptions } from 'electron'
import { createApplicationMenuTemplate } from './applicationMenu'

function submenuFor(
  template: readonly MenuItemConstructorOptions[],
  label: string
): readonly MenuItemConstructorOptions[] {
  const item = template.find((candidate) => candidate.label === label)
  return Array.isArray(item?.submenu) ? item.submenu : []
}

describe('createApplicationMenuTemplate', () => {
  it('exposes the native Close Window role for the macOS Command+W shortcut', () => {
    const template = createApplicationMenuTemplate(vi.fn(), true)

    expect(submenuFor(template, 'File')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'close-window',
          role: 'close',
          accelerator: 'CommandOrControl+W'
        })
      ])
    )
  })

  it('provides macOS settings, navigation, sidebar, refresh, and signal commands', () => {
    const send = vi.fn()
    const template = createApplicationMenuTemplate(send, true)

    const appMenu = submenuFor(template, 'TheRSS')
    expect(appMenu).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Settings…', accelerator: 'CommandOrControl+,' })
      ])
    )

    const viewMenu = submenuFor(template, 'View')
    expect(viewMenu).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Discover', accelerator: 'CommandOrControl+1' }),
        expect.objectContaining({ label: 'Show or Hide Sidebar' }),
        expect.objectContaining({ label: 'Saved', accelerator: 'CommandOrControl+2' })
      ])
    )

    const signalMenu = submenuFor(template, 'Signal')
    const dismiss = signalMenu.find((item) => item.label === 'Dismiss Selected')
    dismiss?.click?.({} as never, undefined as never, {} as never)
    expect(send).toHaveBeenCalledWith('dismiss-selected')
  })

  it('makes Discover the first view and keeps removed Today and Interests surfaces out of menus', () => {
    const send = vi.fn()
    const template = createApplicationMenuTemplate(send, true)
    const appMenu = submenuFor(template, 'TheRSS')
    const settings = appMenu.find((item) => item.label === 'Settings…')
    const viewMenu = submenuFor(template, 'View')

    expect(viewMenu).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Discover', accelerator: 'CommandOrControl+1' }),
        expect.objectContaining({ label: 'Saved', accelerator: 'CommandOrControl+2' })
      ])
    )
    expect(viewMenu.map((item) => item.label)).not.toContain('Today')
    expect(viewMenu.map((item) => item.label)).not.toContain('Interests')

    settings?.click?.({} as never, undefined as never, {} as never)
    expect(send).toHaveBeenCalledWith('open-settings')
  })
})

describe('createApplicationMenuTemplate macOS command completeness', () => {
  it('exposes a Help menu so macOS can inject its Help search field', () => {
    const send = vi.fn()
    const template = createApplicationMenuTemplate(send, true)

    const help = template.find((item) => item.role === 'help')
    expect(help).toBeDefined()
    expect(help?.label).toBe('Help')

    const helpSubmenu = Array.isArray(help?.submenu) ? help.submenu : []
    const helpItem = helpSubmenu.find((item) => item.label === 'TheRSS Help')
    expect(helpItem).toBeDefined()

    helpItem?.click?.({} as never, undefined as never, {} as never)
    expect(send).toHaveBeenCalledWith('open-help')
  })

  it('provides the standard View zoom commands', () => {
    const viewMenu = submenuFor(createApplicationMenuTemplate(vi.fn(), true), 'View')

    expect(viewMenu.map((item) => item.role)).toEqual(
      expect.arrayContaining(['resetZoom', 'zoomIn', 'zoomOut'])
    )
  })

  it('gives Dismiss Selected the macOS Command+Backspace accelerator', () => {
    const signalMenu = submenuFor(createApplicationMenuTemplate(vi.fn(), true), 'Signal')

    expect(signalMenu).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Dismiss Selected',
          accelerator: 'CommandOrControl+Backspace'
        })
      ])
    )
  })

  it('frees Command+S so it keeps its universal Save meaning', () => {
    const template = createApplicationMenuTemplate(vi.fn(), true)
    const everyAccelerator = template.flatMap((item) =>
      (Array.isArray(item.submenu) ? item.submenu : []).map((entry) => entry.accelerator)
    )

    expect(everyAccelerator).not.toContain('CommandOrControl+S')

    const signalMenu = submenuFor(template, 'Signal')
    expect(signalMenu).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Save Selected',
          accelerator: 'Shift+CommandOrControl+D'
        })
      ])
    )
  })
})

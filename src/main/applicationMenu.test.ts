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

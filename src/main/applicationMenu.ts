import type { MenuItemConstructorOptions } from 'electron'
import type { AppCommand } from '../shared/ipc'

export function createApplicationMenuTemplate(
  send: (command: AppCommand) => void,
  isMac: boolean,
  nativeAction?: (command: string) => void
): MenuItemConstructorOptions[] {
  const appMenu: MenuItemConstructorOptions = {
    label: 'TheRSS',
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      {
        label: 'Settings…',
        accelerator: 'CommandOrControl+,',
        click: () => send('open-settings')
      },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }

  const fileMenu: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      {
        id: 'close-window',
        role: 'close',
        accelerator: 'CommandOrControl+W'
      }
    ]
  }

  const editMenu: MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
      { type: 'separator' },
      {
        label: 'Find Local Research',
        accelerator: 'CommandOrControl+F',
        click: () => send('open-local-search')
      }
    ]
  }

  const viewMenu: MenuItemConstructorOptions = {
    label: 'View',
    submenu: [
      {
        label: 'Discover',
        accelerator: 'CommandOrControl+1',
        click: () => send('show-discover')
      },
      {
        label: 'Saved',
        accelerator: 'CommandOrControl+2',
        click: () => send('show-saved')
      },
      { type: 'separator' },
      {
        label: 'Show or Hide Sidebar',
        accelerator: isMac ? 'Control+Command+S' : 'CommandOrControl+Shift+S',
        click: () => send('toggle-sidebar')
      },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }

  const signalMenu: MenuItemConstructorOptions = {
    label: 'Signal',
    submenu: [
      {
        // Command+S keeps its universal Save meaning; Shift+Command+D is the
        // add-to-shelf idiom used by Mac reading and bookmarking apps.
        label: 'Save Selected',
        accelerator: 'Shift+CommandOrControl+D',
        click: () => send('save-selected')
      },
      {
        label: 'Dismiss Selected',
        accelerator: 'CommandOrControl+Backspace',
        click: () => send('dismiss-selected')
      },
      {
        label: 'Analyze Selected',
        accelerator: 'CommandOrControl+Shift+A',
        click: () => send('analyze-selected')
      },
      { type: 'separator' },
      { label: 'Undo Last Triage', click: () => send('undo-triage') }
    ]
  }

  const windowMenu: MenuItemConstructorOptions = {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      ...(isMac ? [{ role: 'front' as const }] : [])
    ]
  }

  const helpMenu: MenuItemConstructorOptions = {
    label: 'Help',
    role: 'help',
    submenu: [
      {
        label: 'TheRSS Help',
        click: () => send('open-help')
      }
    ]
  }

  const menus = [appMenu, fileMenu, editMenu, viewMenu, signalMenu, windowMenu, helpMenu]
  if (nativeAction) {
    const actions: Readonly<
      Record<string, { label: string; command: string; accelerator: string }>
    > = {
      undo: { label: 'Undo', command: 'undo', accelerator: 'CommandOrControl+Z' },
      redo: { label: 'Redo', command: 'redo', accelerator: 'CommandOrControl+Shift+Z' },
      cut: { label: 'Cut', command: 'cut', accelerator: 'CommandOrControl+X' },
      copy: { label: 'Copy', command: 'copy', accelerator: 'CommandOrControl+C' },
      paste: { label: 'Paste', command: 'paste', accelerator: 'CommandOrControl+V' },
      selectAll: { label: 'Select All', command: 'selectAll', accelerator: 'CommandOrControl+A' },
      resetZoom: { label: 'Actual Size', command: 'zoom-reset', accelerator: 'CommandOrControl+0' },
      zoomIn: { label: 'Zoom In', command: 'zoom-in', accelerator: 'CommandOrControl+Plus' },
      zoomOut: { label: 'Zoom Out', command: 'zoom-out', accelerator: 'CommandOrControl+-' }
    }
    for (const menu of menus)
      if (Array.isArray(menu.submenu))
        menu.submenu = menu.submenu.map((item) => {
          const action = item.role ? actions[item.role] : undefined
          return action
            ? {
                label: action.label,
                accelerator: action.accelerator,
                click: () => nativeAction(action.command)
              }
            : item
        })
  }
  return menus
}

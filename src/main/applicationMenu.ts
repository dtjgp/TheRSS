import type { MenuItemConstructorOptions } from 'electron'
import type { AppCommand } from '../shared/ipc'

export function createApplicationMenuTemplate(
  send: (command: AppCommand) => void,
  isMac: boolean
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

  const editMenu: MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  }

  const viewMenu: MenuItemConstructorOptions = {
    label: 'View',
    submenu: [
      {
        label: 'Today',
        accelerator: 'CommandOrControl+1',
        click: () => send('show-today')
      },
      {
        label: 'Saved',
        accelerator: 'CommandOrControl+2',
        click: () => send('show-saved')
      },
      {
        label: 'Discover',
        accelerator: 'CommandOrControl+3',
        click: () => send('show-discover')
      },
      { type: 'separator' },
      {
        label: 'Show or Hide Sidebar',
        accelerator: isMac ? 'Control+Command+S' : 'CommandOrControl+Shift+S',
        click: () => send('toggle-sidebar')
      },
      {
        label: 'Refresh Sources',
        accelerator: 'CommandOrControl+R',
        click: () => send('refresh-sources')
      },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }

  const signalMenu: MenuItemConstructorOptions = {
    label: 'Signal',
    submenu: [
      {
        label: 'Save Selected',
        accelerator: 'CommandOrControl+S',
        click: () => send('save-selected')
      },
      { label: 'Dismiss Selected', click: () => send('dismiss-selected') },
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

  return [appMenu, editMenu, viewMenu, signalMenu, windowMenu]
}

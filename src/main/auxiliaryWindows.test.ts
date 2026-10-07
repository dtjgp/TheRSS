import { describe, expect, it } from 'vitest'
import { AuxiliaryWindows } from './auxiliaryWindows'
import { routeAppCommand } from './recordWindowRouting'

describe('record and Settings windows', () => {
  const main = { id: 'main' },
    record = { id: 'record' },
    settings = { id: 'settings' }

  it('treats record and Settings windows as auxiliary, never the main window', () => {
    const windows = new AuxiliaryWindows<typeof main>()
    windows.records.set('discover:s:1', record)
    windows.settings = { window: settings, ready: true }
    expect(windows.isAuxiliary(record)).toBe(true)
    expect(windows.isAuxiliary(settings)).toBe(true)
    expect(windows.isAuxiliary(main)).toBe(false)
    // A focused Settings window forwards view commands and drops item commands.
    expect(routeAppCommand('show-saved', windows.isAuxiliary(settings))).toBe('main')
    expect(routeAppCommand('save-selected', windows.isAuxiliary(settings))).toBe('drop')
    expect(routeAppCommand('save-selected', windows.isAuxiliary(main))).toBe('focused')
  })
  it('recreates the main window on activation when only auxiliary windows remain', () => {
    const windows = new AuxiliaryWindows<typeof main>()
    expect(windows.needsMainWindow([])).toBe(true)
    windows.settings = { window: settings, ready: true }
    expect(windows.needsMainWindow([settings])).toBe(true)
    windows.records.set('saved::1', record)
    expect(windows.needsMainWindow([settings, record])).toBe(true)
    expect(windows.needsMainWindow([settings, record, main])).toBe(false)
    windows.settings = null
    expect(windows.isAuxiliary(settings)).toBe(false)
  })
})

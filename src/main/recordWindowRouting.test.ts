import { describe, expect, it } from 'vitest'
import { routeAppCommand } from './recordWindowRouting'

describe('app commands while a record window is focused', () => {
  it('keeps every command in a focused main window', () => {
    for (const command of ['save-selected', 'show-saved', 'undo-triage', 'open-help'])
      expect(routeAppCommand(command, false)).toBe('focused')
  })
  it('sends navigation, Find, Settings and Help to the main window', () => {
    for (const command of [
      'show-discover',
      'show-saved',
      'show-analytics',
      'show-sources',
      'toggle-sidebar',
      'open-local-search',
      'open-settings',
      'open-help'
    ])
      expect(routeAppCommand(command, true)).toBe('main')
  })
  it('never applies an item or triage command to a record the user is not looking at', () => {
    for (const command of [
      'save-selected',
      'dismiss-selected',
      'analyze-selected',
      'undo-triage',
      'unknown'
    ])
      expect(routeAppCommand(command, true)).toBe('drop')
  })
})

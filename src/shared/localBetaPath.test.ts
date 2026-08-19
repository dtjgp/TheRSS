import { describe, expect, it } from 'vitest'
import { macDatabasePath } from '../../scripts/local-beta-paths.mjs'

describe('macDatabasePath', () => {
  it('uses the packaged Electron app name instead of the display name', () => {
    expect(macDatabasePath('/Users/researcher', 'therss')).toBe(
      '/Users/researcher/Library/Application Support/therss/therss.sqlite'
    )
  })

  it('rejects names that could escape the application-support directory', () => {
    expect(() => macDatabasePath('/Users/researcher', '../TheRSS')).toThrow(
      'Invalid packaged application name'
    )
  })
})

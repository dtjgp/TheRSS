import { describe, expect, it } from 'vitest'
import { defaultDatabasePath } from './databasePath'

describe('defaultDatabasePath', () => {
  it('matches the packaged macOS Electron user-data directory', () => {
    expect(
      defaultDatabasePath({
        platformName: 'darwin',
        homeDirectory: '/Users/researcher',
        environment: {}
      })
    ).toBe('/Users/researcher/Library/Application Support/therss/therss.sqlite')
  })
})

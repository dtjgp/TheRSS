import { join } from 'node:path'

const APPLICATION_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u

export function macDatabasePath(homeDirectory, applicationName) {
  if (!APPLICATION_NAME_PATTERN.test(applicationName)) {
    throw new Error('Invalid packaged application name')
  }
  return join(homeDirectory, 'Library', 'Application Support', applicationName, 'therss.sqlite')
}

import { homedir } from 'node:os'
import { join } from 'node:path'
import { env, platform } from 'node:process'

interface DatabasePathOptions {
  readonly platformName?: NodeJS.Platform
  readonly homeDirectory?: string
  readonly environment?: NodeJS.ProcessEnv
}

const PACKAGED_APPLICATION_NAME = 'therss'

export function defaultDatabasePath(options: DatabasePathOptions = {}): string {
  const platformName = options.platformName ?? platform
  const homeDirectory = options.homeDirectory ?? homedir()
  const environment = options.environment ?? env
  if (platformName === 'darwin') {
    return join(
      homeDirectory,
      'Library',
      'Application Support',
      PACKAGED_APPLICATION_NAME,
      'therss.sqlite'
    )
  }
  if (platformName === 'win32') {
    return join(environment.APPDATA ?? homeDirectory, PACKAGED_APPLICATION_NAME, 'therss.sqlite')
  }
  return join(
    environment.XDG_CONFIG_HOME ?? join(homeDirectory, '.config'),
    PACKAGED_APPLICATION_NAME,
    'therss.sqlite'
  )
}

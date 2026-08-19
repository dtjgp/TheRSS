import { log } from 'node:console'
import { execFileSync } from 'node:child_process'
import { lstat, mkdir, readFile, readlink, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir, arch } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { pid, platform } from 'node:process'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { macDatabasePath } from './local-beta-paths.mjs'

if (platform !== 'darwin') {
  throw new Error('The local beta installer currently supports macOS only')
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageMetadata = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
if (typeof packageMetadata.name !== 'string') {
  throw new Error('The package metadata has no application name')
}
const packageArchitecture = arch() === 'arm64' ? 'arm64' : 'x64'
const sourceApp = join(projectRoot, 'release', `mac-${packageArchitecture}`, 'TheRSS.app')
const applicationsDirectory = join(homedir(), 'Applications')
const targetApp = join(applicationsDirectory, 'TheRSS Dev.app')
const temporaryApp = join(applicationsDirectory, `TheRSS Dev.app.installing-${pid}`)
const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-')

if (dirname(targetApp) !== applicationsDirectory || basename(targetApp) !== 'TheRSS Dev.app') {
  throw new Error('Refusing to install outside the exact TheRSS Dev.app target')
}
if (!existsSync(sourceApp) || !(await lstat(sourceApp)).isDirectory()) {
  throw new Error(`Packaged application is missing: ${sourceApp}`)
}
if ((await lstat(sourceApp)).isSymbolicLink()) {
  throw new Error('Refusing to install a symbolic-link application source')
}
if (existsSync(temporaryApp)) {
  throw new Error(`A previous temporary install remains: ${temporaryApp}`)
}
if (existsSync(targetApp)) {
  const targetStat = await lstat(targetApp)
  if (!targetStat.isDirectory() || targetStat.isSymbolicLink()) {
    throw new Error('Refusing to replace a non-directory or symbolic-link target')
  }
}

await mkdir(applicationsDirectory, { recursive: true })

const databasePath = macDatabasePath(homedir(), packageMetadata.name)
if (existsSync(databasePath)) {
  const backupDirectory = join(dirname(databasePath), 'backups')
  const backupPath = join(backupDirectory, `therss-${timestamp}.sqlite`)
  await mkdir(backupDirectory, { recursive: true })
  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    await database.backup(backupPath)
    log(`Database backup: ${backupPath}`)
  } finally {
    database.close()
  }
}

execFileSync('/usr/bin/ditto', ['--rsrc', '--extattr', '--acl', sourceApp, temporaryApp])

const frameworkDirectory = join(
  temporaryApp,
  'Contents',
  'Frameworks',
  'Electron Framework.framework'
)
const currentVersionLink = await readlink(join(frameworkDirectory, 'Versions', 'Current'))
const resourcesLink = await readlink(join(frameworkDirectory, 'Resources'))
const icuData = join(frameworkDirectory, 'Versions', 'A', 'Resources', 'icudtl.dat')
if (
  currentVersionLink !== 'A' ||
  resourcesLink !== 'Versions/Current/Resources' ||
  !existsSync(icuData)
) {
  throw new Error('Copied app failed the Electron framework bundle integrity check')
}

let previousApp = null
if (existsSync(targetApp)) {
  previousApp = join(applicationsDirectory, `TheRSS Dev.backup-${timestamp}.app`)
  await rename(targetApp, previousApp)
}

try {
  await rename(temporaryApp, targetApp)
} catch (error) {
  if (previousApp && !existsSync(targetApp)) {
    await rename(previousApp, targetApp)
  }
  throw error
}

log(`Installed: ${targetApp}`)
if (previousApp) log(`Previous app retained: ${previousApp}`)
log('Open TheRSS Dev.app from ~/Applications. No Apple Developer membership is required.')

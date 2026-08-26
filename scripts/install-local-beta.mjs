import { log } from 'node:console'
import { readFile } from 'node:fs/promises'
import { homedir, arch } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { argv, pid, platform } from 'node:process'
import { fileURLToPath } from 'node:url'
import { installLocalBeta } from './local-beta-installer.mjs'
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
const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-')
const cliArguments = argv.slice(2)
if (cliArguments.some((argument) => argument !== '--force')) {
  throw new Error(`Unsupported installer argument: ${cliArguments.join(' ')}`)
}
const force = cliArguments.includes('--force')

const databasePath = macDatabasePath(homedir(), packageMetadata.name)
const receipt = await installLocalBeta({
  applicationsDirectory,
  applicationVersion: packageMetadata.version,
  databasePath,
  force,
  processId: pid,
  sourceApp,
  timestamp
})

log(`Installed: ${receipt.targetApp}`)
if (receipt.previousApp) log(`Previous app retained: ${receipt.previousApp}`)
if (receipt.databaseBackup) log(`Database backup: ${receipt.databaseBackup}`)
log(`Install receipt: ${receipt.receiptPath}`)
log('Open TheRSS Dev.app from ~/Applications. No Apple Developer membership is required.')

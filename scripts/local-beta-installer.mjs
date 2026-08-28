import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createReadStream, existsSync } from 'node:fs'
import { lstat, mkdir, open, readlink, rename, rm, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import Database from 'better-sqlite3'

function asarPath(applicationPath) {
  return join(applicationPath, 'Contents', 'Resources', 'app.asar')
}

async function sha256File(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function assertDirectoryApplication(path, label) {
  if (!existsSync(path)) throw new Error(`${label} is missing: ${path}`)
  const stat = await lstat(path)
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a non-symbolic-link directory`)
  }
  if (!existsSync(asarPath(path))) throw new Error(`${label} has no app.asar: ${path}`)
}

async function assertFrameworkIntegrity(applicationPath) {
  const frameworkDirectory = join(
    applicationPath,
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
}

function assertDatabase(databasePath, databaseWasPresent) {
  if (!databaseWasPresent) return
  if (!existsSync(databasePath)) {
    throw new Error('The existing TheRSS database disappeared during installation')
  }
  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    if (database.pragma('integrity_check', { simple: true }) !== 'ok') {
      throw new Error('The existing TheRSS database failed its installation integrity check')
    }
  } finally {
    database.close()
  }
}

async function backupDatabase(databasePath, timestamp, databaseWasPresent) {
  if (!databaseWasPresent) return null
  const backupDirectory = join(dirname(databasePath), 'backups')
  const backupPath = join(backupDirectory, `therss-${timestamp}.sqlite`)
  await mkdir(backupDirectory, { recursive: true })
  const database = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    await database.backup(backupPath)
  } finally {
    database.close()
  }
  return backupPath
}

function defaultCopyApp(sourceApp, temporaryApp) {
  execFileSync('/usr/bin/ditto', ['--rsrc', '--extattr', '--acl', sourceApp, temporaryApp])
}

async function acquireInstallLock(lockPath, processId, timestamp) {
  let handle
  try {
    handle = await open(lockPath, 'wx')
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
      throw new Error(`Another TheRSS installation is already in progress: ${lockPath}`, {
        cause: error
      })
    }
    throw error
  }
  try {
    await handle.writeFile(`${JSON.stringify({ pid: processId, startedAt: timestamp })}\n`)
    return handle
  } catch (error) {
    await handle.close()
    await unlink(lockPath)
    throw error
  }
}

async function rollbackReplacement({ applicationsDirectory, previousApp, targetApp, timestamp }) {
  if (!existsSync(targetApp)) return
  const failedApp = join(applicationsDirectory, `TheRSS Dev.failed-${timestamp}.app`)
  await rename(targetApp, failedApp)
  if (previousApp && existsSync(previousApp)) await rename(previousApp, targetApp)
}

export async function installLocalBeta({
  applicationsDirectory,
  applicationVersion,
  copyApp = defaultCopyApp,
  databasePath,
  force = false,
  processId,
  sourceApp,
  timestamp
}) {
  const targetApp = join(applicationsDirectory, 'TheRSS Dev.app')
  const temporaryApp = join(applicationsDirectory, `TheRSS Dev.app.installing-${processId}`)
  if (dirname(targetApp) !== applicationsDirectory || basename(targetApp) !== 'TheRSS Dev.app') {
    throw new Error('Refusing to install outside the exact TheRSS Dev.app target')
  }
  await assertDirectoryApplication(sourceApp, 'Packaged application')
  if (existsSync(temporaryApp)) {
    throw new Error(`A previous temporary install remains: ${temporaryApp}`)
  }
  if (existsSync(targetApp)) await assertDirectoryApplication(targetApp, 'Installed application')

  await mkdir(applicationsDirectory, { recursive: true })
  const supportDirectory = dirname(databasePath)
  await mkdir(supportDirectory, { recursive: true })
  const lockPath = join(supportDirectory, 'install.lock')
  const lockHandle = await acquireInstallLock(lockPath, processId, timestamp)

  let previousApp = null
  let targetReplaced = false
  try {
    const sourceAsarSha256 = await sha256File(asarPath(sourceApp))
    if (existsSync(targetApp)) {
      const installedBeforeSha256 = await sha256File(asarPath(targetApp))
      if (!force && sourceAsarSha256 === installedBeforeSha256) {
        throw new Error(
          'The installed TheRSS Dev.app already matches the packaged release; use --force to reinstall'
        )
      }
    }

    const databaseWasPresent = existsSync(databasePath)
    assertDatabase(databasePath, databaseWasPresent)
    const databaseBackup = await backupDatabase(databasePath, timestamp, databaseWasPresent)

    await copyApp(sourceApp, temporaryApp)
    await assertDirectoryApplication(temporaryApp, 'Copied application')
    await assertFrameworkIntegrity(temporaryApp)
    assertDatabase(databasePath, databaseWasPresent)

    if (existsSync(targetApp)) {
      previousApp = join(applicationsDirectory, `TheRSS Dev.backup-${timestamp}.app`)
      if (existsSync(previousApp)) throw new Error(`App backup already exists: ${previousApp}`)
      await rename(targetApp, previousApp)
    }

    await rename(temporaryApp, targetApp)
    targetReplaced = true
    const installedAsarSha256 = await sha256File(asarPath(targetApp))
    if (installedAsarSha256 !== sourceAsarSha256) {
      throw new Error('Installed app.asar does not match the packaged release')
    }
    assertDatabase(databasePath, databaseWasPresent)

    const receiptDirectory = join(supportDirectory, 'install-receipts')
    const receiptPath = join(receiptDirectory, `install-${timestamp}.json`)
    await mkdir(receiptDirectory, { recursive: true })
    const receipt = {
      schemaVersion: 1,
      status: 'completed',
      applicationVersion,
      completedAt: timestamp,
      targetApp,
      previousApp,
      databasePath,
      databaseBackup,
      databasePreserved: databaseWasPresent,
      sourceAsarSha256,
      installedAsarSha256,
      receiptPath
    }
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' })
    return receipt
  } catch (error) {
    if (targetReplaced) {
      await rollbackReplacement({ applicationsDirectory, previousApp, targetApp, timestamp })
    }
    if (existsSync(temporaryApp)) await rm(temporaryApp, { recursive: true })
    throw error
  } finally {
    await lockHandle.close()
    await unlink(lockPath)
  }
}

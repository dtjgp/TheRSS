import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { installLocalBeta } from '../../scripts/local-beta-installer.mjs'

const roots: string[] = []

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'therss-installer-test-'))
  roots.push(root)
  return root
}

async function makeApp(path: string, asarContents: string): Promise<void> {
  const framework = join(path, 'Contents', 'Frameworks', 'Electron Framework.framework')
  await mkdir(join(framework, 'Versions', 'A', 'Resources'), { recursive: true })
  await mkdir(join(path, 'Contents', 'Resources'), { recursive: true })
  await writeFile(join(framework, 'Versions', 'A', 'Resources', 'icudtl.dat'), 'icu')
  await symlink('A', join(framework, 'Versions', 'Current'))
  await symlink('Versions/Current/Resources', join(framework, 'Resources'))
  await writeFile(join(path, 'Contents', 'Resources', 'app.asar'), asarContents)
}

async function copyFixture(source: string, destination: string): Promise<void> {
  await cp(source, destination, { recursive: true, verbatimSymlinks: true })
}

function makeDatabase(path: string): void {
  const database = new Database(path)
  try {
    database.exec('CREATE TABLE evidence (id TEXT PRIMARY KEY)')
    database.prepare('INSERT INTO evidence(id) VALUES (?)').run('retained-research-record')
  } finally {
    database.close()
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('installLocalBeta', () => {
  it('installs changed native payloads even when app.asar is identical', async () => {
    const root = await makeRoot(),
      applicationsDirectory = join(root, 'Applications')
    const sourceApp = join(root, 'release', 'TheRSS.app'),
      targetApp = join(applicationsDirectory, 'TheRSS Dev.app')
    await makeApp(sourceApp, 'same-asar')
    await makeApp(targetApp, 'same-asar')
    await writeFile(join(sourceApp, 'Contents', 'Resources', 'native.node'), 'new native bytes')
    await writeFile(join(targetApp, 'Contents', 'Resources', 'native.node'), 'old native bytes')
    const receipt = await installLocalBeta({
      applicationsDirectory,
      sourceApp,
      databasePath: join(root, 'data', 'therss.sqlite'),
      applicationVersion: '0.3.0',
      processId: 105,
      timestamp: '2026-09-07-native-change',
      copyApp: copyFixture,
      isAppRunning: () => false
    })
    expect(receipt.sourceBundleSha256).toBe(receipt.installedBundleSha256)
    expect(await readFile(join(targetApp, 'Contents', 'Resources', 'native.node'), 'utf8')).toBe(
      'new native bytes'
    )
  })
  it('does not replace a running installed application', async () => {
    const root = await makeRoot(),
      applicationsDirectory = join(root, 'Applications')
    const sourceApp = join(root, 'release', 'TheRSS.app'),
      targetApp = join(applicationsDirectory, 'TheRSS Dev.app')
    await makeApp(sourceApp, 'new')
    await makeApp(targetApp, 'old')
    await expect(
      installLocalBeta({
        applicationsDirectory,
        sourceApp,
        databasePath: join(root, 'data', 'therss.sqlite'),
        applicationVersion: '0.3.0',
        processId: 106,
        timestamp: '2026-09-07-running',
        copyApp: copyFixture,
        isAppRunning: () => true
      })
    ).rejects.toThrow(/Quit TheRSS/)
    expect(await readFile(join(targetApp, 'Contents', 'Resources', 'app.asar'), 'utf8')).toBe('old')
  })
  it('refuses an identical release without creating duplicate backups or a receipt', async () => {
    const root = await makeRoot()
    const applicationsDirectory = join(root, 'Applications')
    const sourceApp = join(root, 'release', 'TheRSS.app')
    const targetApp = join(applicationsDirectory, 'TheRSS Dev.app')
    const databasePath = join(root, 'Library', 'Application Support', 'therss', 'therss.sqlite')
    await makeApp(sourceApp, 'same-release')
    await makeApp(targetApp, 'same-release')
    await mkdir(join(databasePath, '..'), { recursive: true })
    makeDatabase(databasePath)

    await expect(
      installLocalBeta({
        applicationsDirectory,
        applicationVersion: '0.2.0',
        copyApp: copyFixture,
        isAppRunning: () => false,
        databasePath,
        processId: 101,
        sourceApp,
        timestamp: '2026-08-26T18-00-00-000Z'
      })
    ).rejects.toThrow('already matches the packaged release')

    expect(await readdir(applicationsDirectory)).toEqual(['TheRSS Dev.app'])
    expect(await readdir(join(root, 'Library', 'Application Support', 'therss'))).toEqual([
      'therss.sqlite'
    ])
  })

  it('creates one recoverable app/database backup and a completed receipt', async () => {
    const root = await makeRoot()
    const applicationsDirectory = join(root, 'Applications')
    const sourceApp = join(root, 'release', 'TheRSS.app')
    const targetApp = join(applicationsDirectory, 'TheRSS Dev.app')
    const databasePath = join(root, 'Library', 'Application Support', 'therss', 'therss.sqlite')
    const timestamp = '2026-08-26T18-01-00-000Z'
    await makeApp(sourceApp, 'new-release')
    await makeApp(targetApp, 'old-release')
    await mkdir(join(databasePath, '..'), { recursive: true })
    makeDatabase(databasePath)

    const result = await installLocalBeta({
      applicationsDirectory,
      applicationVersion: '0.2.0',
      copyApp: copyFixture,
      isAppRunning: () => false,
      databasePath,
      processId: 102,
      sourceApp,
      timestamp
    })

    expect(result.status).toBe('completed')
    expect(result.previousApp).toBe(
      join(applicationsDirectory, `TheRSS Dev.backup-${timestamp}.app`)
    )
    expect(result.databaseBackup).toBe(
      join(databasePath, '..', 'backups', `therss-${timestamp}.sqlite`)
    )
    expect(result.sourceAsarSha256).toBe(result.installedAsarSha256)
    expect(result.sourceBundleSha256).toBe(result.installedBundleSha256)
    expect(await readFile(result.receiptPath, 'utf8')).toContain('"status": "completed"')
    expect(await readFile(join(targetApp, 'Contents', 'Resources', 'app.asar'), 'utf8')).toBe(
      'new-release'
    )

    const liveDatabase = new Database(databasePath, { readonly: true, fileMustExist: true })
    try {
      expect(liveDatabase.pragma('integrity_check', { simple: true })).toBe('ok')
      expect(liveDatabase.prepare('SELECT id FROM evidence').all()).toEqual([
        { id: 'retained-research-record' }
      ])
    } finally {
      liveDatabase.close()
    }
  })

  it('refuses a concurrent installation while the scoped lock exists', async () => {
    const root = await makeRoot()
    const applicationsDirectory = join(root, 'Applications')
    const sourceApp = join(root, 'release', 'TheRSS.app')
    const supportDirectory = join(root, 'Library', 'Application Support', 'therss')
    const databasePath = join(supportDirectory, 'therss.sqlite')
    await makeApp(sourceApp, 'new-release')
    await mkdir(supportDirectory, { recursive: true })
    await writeFile(join(supportDirectory, 'install.lock'), '{"pid":99}')

    await expect(
      installLocalBeta({
        applicationsDirectory,
        applicationVersion: '0.2.0',
        copyApp: copyFixture,
        isAppRunning: () => false,
        databasePath,
        processId: 103,
        sourceApp,
        timestamp: '2026-08-26T18-02-00-000Z'
      })
    ).rejects.toThrow('Another TheRSS installation is already in progress')
  })

  it('rejects a corrupt copied native file before replacing the installed application', async () => {
    const root = await makeRoot(),
      applicationsDirectory = join(root, 'Applications')
    const sourceApp = join(root, 'release', 'TheRSS.app'),
      targetApp = join(applicationsDirectory, 'TheRSS Dev.app')
    await makeApp(sourceApp, 'new')
    await makeApp(targetApp, 'old')
    await writeFile(join(sourceApp, 'Contents', 'Resources', 'native.node'), 'verified bytes')
    await expect(
      installLocalBeta({
        applicationsDirectory,
        sourceApp,
        databasePath: join(root, 'data', 'therss.sqlite'),
        applicationVersion: '0.3.0',
        processId: 107,
        timestamp: '2026-09-07-corrupt',
        isAppRunning: () => false,
        copyApp: async (source, destination) => {
          await copyFixture(source, destination)
          await writeFile(
            join(destination, 'Contents', 'Resources', 'native.node'),
            'corrupted bytes'
          )
        }
      })
    ).rejects.toThrow('Copied application bundle does not match')
    expect(await readFile(join(targetApp, 'Contents', 'Resources', 'app.asar'), 'utf8')).toBe('old')
  })

  it('restores the previous application when the final receipt cannot be written', async () => {
    const root = await makeRoot(),
      applicationsDirectory = join(root, 'Applications')
    const sourceApp = join(root, 'release', 'TheRSS.app'),
      targetApp = join(applicationsDirectory, 'TheRSS Dev.app')
    const support = join(root, 'data'),
      timestamp = '2026-09-07-receipt-collision'
    await makeApp(sourceApp, 'new')
    await makeApp(targetApp, 'old')
    await mkdir(join(support, 'install-receipts'), { recursive: true })
    await writeFile(
      join(support, 'install-receipts', `install-${timestamp}.json`),
      'Existing receipt'
    )
    await expect(
      installLocalBeta({
        applicationsDirectory,
        sourceApp,
        databasePath: join(support, 'therss.sqlite'),
        applicationVersion: '0.3.0',
        processId: 108,
        timestamp,
        copyApp: copyFixture,
        isAppRunning: () => false
      })
    ).rejects.toThrow()
    expect(await readFile(join(targetApp, 'Contents', 'Resources', 'app.asar'), 'utf8')).toBe('old')
  })

  it('fails before app replacement when an existing database disappears during copying', async () => {
    const root = await makeRoot()
    const applicationsDirectory = join(root, 'Applications')
    const sourceApp = join(root, 'release', 'TheRSS.app')
    const targetApp = join(applicationsDirectory, 'TheRSS Dev.app')
    const databasePath = join(root, 'Library', 'Application Support', 'therss', 'therss.sqlite')
    await makeApp(sourceApp, 'new-release')
    await makeApp(targetApp, 'old-release')
    await mkdir(join(databasePath, '..'), { recursive: true })
    makeDatabase(databasePath)

    await expect(
      installLocalBeta({
        applicationsDirectory,
        applicationVersion: '0.2.0',
        isAppRunning: () => false,
        copyApp: async (source, destination) => {
          await copyFixture(source, destination)
          await rm(databasePath)
        },
        databasePath,
        processId: 104,
        sourceApp,
        timestamp: '2026-08-26T18-03-00-000Z'
      })
    ).rejects.toThrow('The existing TheRSS database disappeared during installation')

    expect(await readFile(join(targetApp, 'Contents', 'Resources', 'app.asar'), 'utf8')).toBe(
      'old-release'
    )
  })
})

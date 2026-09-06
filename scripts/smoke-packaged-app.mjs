import { error as logError, log } from 'node:console'
import { execFileSync } from 'node:child_process'
import { lstat, mkdtemp, rm } from 'node:fs/promises'
import { release, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { arch, cwd, env, execPath, platform } from 'node:process'
import { _electron as electron } from '@playwright/test'

if (platform !== 'darwin') {
  throw new Error('The packaged-app smoke check currently supports macOS only')
}

const executablePath = resolve(
  env.THERSS_APP_EXECUTABLE ??
    join(
      cwd(),
      'release',
      arch === 'arm64' ? 'mac-arm64' : 'mac',
      'TheRSS.app',
      'Contents',
      'MacOS',
      'TheRSS'
    )
)
const executableStat = await lstat(executablePath)
if (!executableStat.isFile() || executableStat.isSymbolicLink()) {
  throw new Error(`Packaged TheRSS executable is invalid: ${executablePath}`)
}

const userDataDirectory = await mkdtemp(join(tmpdir(), 'therss-package-smoke-'))
let application
try {
  application = await electron.launch({
    executablePath,
    args: [`--user-data-dir=${userDataDirectory}`],
    env: { ...env, THERSS_E2E_FIXTURES: '1', THERSS_UI: 'web' }
  })
  const page = await application.firstWindow()
  await page.getByRole('heading', { name: 'Discover research' }).waitFor({
    state: 'visible',
    timeout: 15_000
  })
  if (!(await page.evaluate(() => Boolean(globalThis.therss)))) {
    throw new Error('Packaged preload API was not exposed')
  }
  const nativeStatus = await page.evaluate(() => globalThis.therss.nativeGlass?.getStatus())
  if (!nativeStatus) throw new Error('Packaged native UI API was not exposed')
  if (nativeStatus.available) {
    await page.waitForFunction(
      () => globalThis.document.documentElement.dataset.nativeGlass === 'native'
    )
    log('Packaged AppKit material host is active.')
  } else if (
    !['unsupported-system', 'unsupported-platform', 'disabled'].includes(nativeStatus.reason)
  ) {
    throw new Error(`Packaged native UI failed: ${nativeStatus.reason}`)
  }
  log(`Packaged app smoke passed: ${executablePath}`)
} finally {
  await application?.close()
  try {
    const temporaryStat = await lstat(userDataDirectory)
    if (temporaryStat.isDirectory() && !temporaryStat.isSymbolicLink()) {
      await rm(userDataDirectory, { recursive: true })
    } else {
      logError(`Refusing to clean an unexpected smoke directory: ${userDataDirectory}`)
    }
  } catch (error) {
    logError(`Could not clean the packaged smoke directory: ${String(error)}`)
  }
}

if (Number.parseInt(release(), 10) >= 25) {
  execFileSync(execPath, ['scripts/smoke-native-appkit.mjs'], {
    stdio: 'inherit',
    env: {
      ...env,
      THERSS_NATIVE_APP_EXECUTABLE: executablePath,
      THERSS_NATIVE_DEFAULT_ONLY: '1',
      THERSS_NATIVE_EVIDENCE_DIR: resolve('test-results/appkit-package')
    }
  })
}

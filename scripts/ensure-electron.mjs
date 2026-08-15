import { existsSync } from 'node:fs'
import { log } from 'node:console'
import { dirname, join } from 'node:path'
import { execPath } from 'node:process'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const electronDirectory = join(projectRoot, 'node_modules', 'electron')
const binaryMarker = join(electronDirectory, 'path.txt')

if (!existsSync(binaryMarker)) {
  const installer = join(electronDirectory, 'install.js')
  if (!existsSync(installer)) {
    throw new Error('Electron package is missing. Run npm install again.')
  }

  log('Installing the pinned Electron desktop runtime…')
  execFileSync(execPath, [installer], {
    cwd: projectRoot,
    stdio: 'inherit'
  })
}

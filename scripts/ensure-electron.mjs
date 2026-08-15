import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
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

  console.log('Installing the pinned Electron desktop runtime…')
  execFileSync(process.execPath, [installer], {
    cwd: projectRoot,
    stdio: 'inherit'
  })
}

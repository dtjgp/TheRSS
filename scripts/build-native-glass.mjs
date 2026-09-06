import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { arch, platform } from 'node:process'
import { fileURLToPath } from 'node:url'
import { log } from 'node:console'

if (platform !== 'darwin') {
  log('Native glass: non-macOS build uses the web fallback.')
} else {
  const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const require = createRequire(import.meta.url)
  const headers = join(dirname(require.resolve('node-api-headers/package.json')), 'include')
  const sdk = execFileSync('/usr/bin/xcrun', ['--sdk', 'macosx', '--show-sdk-path'], {
    encoding: 'utf8'
  }).trim()
  const compiler = execFileSync('/usr/bin/xcrun', ['--find', 'clang++'], {
    encoding: 'utf8'
  }).trim()
  if (
    !existsSync(join(sdk, 'System/Library/Frameworks/AppKit.framework/Headers/NSGlassEffectView.h'))
  )
    throw new Error('Native glass build requires a macOS26+ SDK')
  const output = join(project, 'out/native-glass')
  mkdirSync(output, { recursive: true })
  execFileSync(
    compiler,
    [
      '-std=c++17',
      '-fobjc-arc',
      '-dynamiclib',
      '-undefined',
      'dynamic_lookup',
      '-DNAPI_VERSION=8',
      '-DNODE_GYP_MODULE_NAME=therss_glass',
      '-I' + headers,
      '-framework',
      'AppKit',
      '-framework',
      'CoreGraphics',
      '-isysroot',
      sdk,
      '-mmacosx-version-min=26.0',
      '-arch',
      arch === 'arm64' ? 'arm64' : 'x86_64',
      join(project, 'native/glass/bridge.mm'),
      '-o',
      join(output, 'therss-glass.node')
    ],
    { stdio: 'inherit' }
  )
  const digest = createHash('sha256')
    .update(readFileSync(join(output, 'therss-glass.node')))
    .digest('hex')
  writeFileSync(
    join(output, 'manifest.json'),
    JSON.stringify({ interfaceVersion: 1, architecture: arch, sha256: digest }) + '\n'
  )
  log('Native glass: built public AppKit/Node-API adapter for ' + arch + '.')
}

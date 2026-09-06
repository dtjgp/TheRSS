import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { arch, platform } from 'node:process'
import { fileURLToPath } from 'node:url'
import { log } from 'node:console'

if (platform !== 'darwin') {
  log('Native AppKit: non-macOS build uses the web fallback.')
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
    throw new Error('Native AppKit build requires a macOS26+ SDK')
  const renderer = join(project, 'out/renderer')
  mkdirSync(renderer, { recursive: true })
  writeFileSync(
    join(renderer, 'native-host.html'),
    `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'"><title>TheRSS</title></head><body></body></html>`
  )
  const output = join(project, 'out/native-appkit')
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
      '-DNODE_GYP_MODULE_NAME=therss_ui',
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
      join(project, 'native/appkit/bridge.mm'),
      join(project, 'native/appkit/host.mm'),
      join(project, 'native/appkit/node.mm'),
      join(project, 'native/appkit/researchText.mm'),
      '-o',
      join(output, 'therss-ui.node')
    ],
    { stdio: 'inherit' }
  )
  const digest = createHash('sha256')
    .update(readFileSync(join(output, 'therss-ui.node')))
    .digest('hex')
  writeFileSync(
    join(output, 'manifest.json'),
    JSON.stringify({ interfaceVersion: 1, architecture: arch, sha256: digest }) + '\n'
  )
  log('Native AppKit: built public AppKit/Node-API adapter for ' + arch + '.')
}

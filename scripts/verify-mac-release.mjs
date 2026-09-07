import { spawnSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import { parseArgs } from 'node:util'
import { realpath } from 'node:fs/promises'
import process from 'node:process'
import {
  parseDeveloperIdentities,
  verifyReleaseIdentity
} from '../src/core/distribution/releasePolicy.ts'

const { values } = parseArgs({
  options: {
    preflight: { type: 'boolean' },
    app: { type: 'string' },
    previous: { type: 'string' },
    identity: { type: 'string' },
    'notary-profile': { type: 'string' }
  }
})
function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 2_000_000
  })
  return { passed: result.status === 0, text: `${result.stdout ?? ''}\n${result.stderr ?? ''}` }
}
function readArtifact(path) {
  const app = resolve(path)
  const signature = run('/usr/bin/codesign', ['-d', '--verbose=4', app])
  const verification = run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app])
  const ticket = run('/usr/bin/xcrun', ['stapler', 'validate', app])
  const gatekeeper = run('/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=4', app])
  const version = run('/usr/bin/plutil', [
    '-extract',
    'CFBundleShortVersionString',
    'raw',
    '-o',
    '-',
    join(app, 'Contents/Info.plist')
  ])
  const entitlements = run('/usr/bin/codesign', ['-d', '--entitlements', ':-', app])
  return {
    signature: signature.text,
    version: version.text.trim(),
    signatureValid: signature.passed && verification.passed,
    notarized: ticket.passed,
    gatekeeperAccepted: gatekeeper.passed && /\baccepted\b/.test(gatekeeper.text),
    developmentEntitlement: /<key>com\.apple\.security\.get-task-allow<\/key>\s*<true\s*\/>/.test(
      entitlements.text
    )
  }
}

let report
if (process.platform !== 'darwin') {
  report = {
    ready: false,
    blockers: ['macOS is required for signing and Gatekeeper verification.']
  }
} else if (values.preflight) {
  const identities = parseDeveloperIdentities(
    run('/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning']).text
  )
  const wanted = values.identity ?? process.env.CSC_NAME
  const identity = wanted
    ? identities.find((entry) => entry.name === wanted || entry.hash === wanted)
    : identities.length === 1
      ? identities[0]
      : undefined
  const profile = values['notary-profile'] ?? process.env.THERSS_NOTARY_PROFILE
  const authenticated =
    identity && profile
      ? run('/usr/bin/xcrun', [
          'notarytool',
          'history',
          '--keychain-profile',
          profile,
          '--output-format',
          'json'
        ]).passed
      : false
  const blockers = []
  if (!identity)
    blockers.push(
      'Configure or select a valid Developer ID Application identity in the local keychain.'
    )
  if (!profile)
    blockers.push(
      'Provide an existing notarytool keychain profile with --notary-profile or THERSS_NOTARY_PROFILE.'
    )
  else if (!authenticated) blockers.push('Notary profile authentication has not passed.')
  report = {
    scope: 'Signing prerequisites only',
    ready: blockers.length === 0,
    identityCount: identities.length,
    team: identity?.team ?? null,
    blockers
  }
} else if (values.app) {
  const app = await realpath(values.app)
  const previous = values.previous ? await realpath(values.previous) : null
  if (previous === app)
    throw new Error('The baseline and successor must be different application bundles.')
  const candidate = readArtifact(app),
    baseline = previous ? readArtifact(previous) : undefined
  report = {
    scope: previous
      ? 'Signed successor identity and distribution checks'
      : 'Signed baseline distribution checks',
    app,
    previous,
    version: candidate.version,
    checkedAt: new Date().toISOString(),
    ...verifyReleaseIdentity(candidate, baseline)
  }
} else {
  throw new Error(
    'Use --preflight, or --app <TheRSS.app> with an optional --previous <baseline.app>.'
  )
}
process.stdout.write(JSON.stringify(report, null, 2) + '\n')
if (!report.ready) process.exitCode = 1

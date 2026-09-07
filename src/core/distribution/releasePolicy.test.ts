import { describe, expect, it } from 'vitest'
import { parseDeveloperIdentities, verifyReleaseIdentity } from './releasePolicy'

const signature =
  'Identifier=dev.dtjgp.therss\nAuthority=Developer ID Application: Fixture (ABCDEFGHIJ)\nTeamIdentifier=ABCDEFGHIJ\nCodeDirectory flags=0x10000(runtime)'
const candidate = {
  signature,
  version: '0.3.0',
  signatureValid: true,
  notarized: true,
  gatekeeperAccepted: true,
  developmentEntitlement: false
}

describe('public macOS release identity gate', () => {
  it('does not accept unsigned, development or unnotarized artifacts as market distributions', () => {
    expect(verifyReleaseIdentity(candidate).ready).toBe(true)
    expect(
      verifyReleaseIdentity({
        ...candidate,
        signature: 'Signature=adhoc\nIdentifier=dev.dtjgp.therss'
      }).ready
    ).toBe(false)
    expect(
      verifyReleaseIdentity({
        ...candidate,
        signature: signature.replace('Developer ID Application', 'Apple Development')
      }).ready
    ).toBe(false)
    expect(verifyReleaseIdentity({ ...candidate, notarized: false }).ready).toBe(false)
    expect(verifyReleaseIdentity({ ...candidate, developmentEntitlement: true }).ready).toBe(false)
  })
  it('requires a newer version from the same signing team for a successor', () => {
    expect(verifyReleaseIdentity(candidate, { ...candidate, version: '0.2.0' }).ready).toBe(true)
    expect(verifyReleaseIdentity(candidate, candidate).ready).toBe(false)
    expect(verifyReleaseIdentity(candidate, { ...candidate, version: '0.4.0' }).ready).toBe(false)
    expect(
      verifyReleaseIdentity(candidate, {
        ...candidate,
        signature: signature.replaceAll('ABCDEFGHIJ', 'KLMNOPQRST'),
        version: '0.2.0'
      }).ready
    ).toBe(false)
  })
  it('recognizes valid Developer ID keychain identities without accepting development certificates', () => {
    const output = `1) ${'A'.repeat(40)} "Developer ID Application: Fixture (ABCDEFGHIJ)"\n2) ${'B'.repeat(40)} "Apple Development: Fixture (ABCDEFGHIJ)"`
    expect(parseDeveloperIdentities(output)).toEqual([
      {
        hash: 'A'.repeat(40),
        name: 'Developer ID Application: Fixture (ABCDEFGHIJ)',
        team: 'ABCDEFGHIJ'
      }
    ])
  })
})

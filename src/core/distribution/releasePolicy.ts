export interface ReleaseIdentity {
  readonly signature: string
  readonly version: string
  readonly signatureValid: boolean
  readonly notarized: boolean
  readonly gatekeeperAccepted: boolean
  readonly developmentEntitlement: boolean
}

export function parseDeveloperIdentities(
  output: string
): { hash: string; name: string; team: string }[] {
  return [
    ...output.matchAll(
      /\b([A-Fa-f0-9]{40}) "(Developer ID Application: [^"\n]+ \(([A-Z0-9]{10})\))"/g
    )
  ].map((match) => ({ hash: match[1]!, name: match[2]!, team: match[3]! }))
}

function newer(version: string, baseline: string): boolean {
  if (
    ![version, baseline].every((value) => /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value))
  )
    return false
  const next = version.split('.').map(Number),
    old = baseline.split('.').map(Number)
  if (![...next, ...old].every(Number.isSafeInteger)) return false
  const index = next.findIndex((value, index) => value !== old[index])
  return index >= 0 && next[index]! > old[index]!
}

export function verifyReleaseIdentity(
  candidate: ReleaseIdentity,
  previous?: ReleaseIdentity
): { ready: boolean; blockers: string[]; team: string | null } {
  const blockers: string[] = []
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(candidate.version) ||
    !candidate.version.split('.').map(Number).every(Number.isSafeInteger)
  )
    blockers.push('A valid stable release version is required.')
  const team = candidate.signature.match(/^TeamIdentifier=([A-Z0-9]{10})$/m)?.[1] ?? null
  if (
    !candidate.signatureValid ||
    !/^Authority=Developer ID Application:/m.test(candidate.signature) ||
    !team
  )
    blockers.push('A valid Developer ID Application signature is required.')
  if (!/^Identifier=dev\.dtjgp\.therss$/m.test(candidate.signature))
    blockers.push('A matching signed TheRSS application identifier is required.')
  if (!/flags=.*\bruntime\b/.test(candidate.signature) || candidate.developmentEntitlement)
    blockers.push('Hardened runtime without a development debugging entitlement is required.')
  if (!candidate.notarized) blockers.push('A valid stapled notarization ticket is required.')
  if (!candidate.gatekeeperAccepted)
    blockers.push('Gatekeeper must accept the artifact under the current system policy.')
  if (previous) {
    const baseline = verifyReleaseIdentity(previous)
    if (!baseline.ready || baseline.team !== team)
      blockers.push(
        'The previous signed baseline must use the same application and Developer ID team.'
      )
    if (!newer(candidate.version, previous.version))
      blockers.push('The successor must have a newer stable release version.')
  }
  return { ready: blockers.length === 0, blockers, team }
}

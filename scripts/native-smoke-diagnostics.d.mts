export function classifyNativeSmokeStderr(chunks: readonly string[]): {
  applicationErrors: string[]
  platformDiagnostics: string[]
}

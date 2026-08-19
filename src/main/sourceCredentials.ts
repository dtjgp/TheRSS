type SourceEnvironment = Readonly<Record<string, string | undefined>>

export function githubTokenFromEnvironment(environment: SourceEnvironment): string | undefined {
  const token = environment.THERSS_GITHUB_TOKEN?.trim()
  if (!token) return undefined
  if (token.length > 512) throw new Error('THERSS_GITHUB_TOKEN exceeds 512 characters')
  return token
}

export function huggingFaceTokenFromEnvironment(
  environment: SourceEnvironment
): string | undefined {
  const token = environment.THERSS_HUGGINGFACE_TOKEN?.trim()
  if (!token) return undefined
  if (token.length > 512) throw new Error('THERSS_HUGGINGFACE_TOKEN exceeds 512 characters')
  return token
}

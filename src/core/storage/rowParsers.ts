/**
 * Parses a JSON array column into a string list.
 *
 * Throws on malformed data rather than coercing it: a corrupt local index should fail
 * loudly instead of silently degrading a record.
 *
 * Shared by the storage facade and the artifact store, so it lives here rather than in
 * either one; importing it back from the facade would create a cycle.
 */
export function parseStringList(value: string): string[] {
  const parsed: unknown = JSON.parse(value)
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error('The local index contains an invalid string list')
  }
  return [...parsed]
}

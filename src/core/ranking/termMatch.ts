const CJK_SCRIPT_PATTERN =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
const TERM_BOUNDARY = String.raw`[^\p{L}\p{N}]|${CJK_SCRIPT_PATTERN.source}`
const ENDS_IN_LATIN_LETTER = /(?=\p{L})\p{Script=Latin}$/u
const INTERNAL_SEPARATORS = /(?<=[^\s‐–-])[\s‐–-]+(?=[^\s‐–-])/gu
const FLEXIBLE_SEPARATOR = String.raw`[\s\-‐–]+`

function buildTermPattern(trimmed: string): string {
  const pattern = trimmed
    .replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    .replace(INTERNAL_SEPARATORS, FLEXIBLE_SEPARATOR)
  const pluralSuffix = ENDS_IN_LATIN_LETTER.test(trimmed) ? '(?:s|es)?' : ''
  return `${pattern}${pluralSuffix}`
}

export function includesWholeTerm(value: string, term: string): boolean {
  const trimmed = term.trim()
  if (!trimmed) return false
  if (CJK_SCRIPT_PATTERN.test(trimmed)) {
    return value.toLocaleLowerCase().includes(trimmed.toLocaleLowerCase())
  }
  return new RegExp(
    `(?:^|${TERM_BOUNDARY})${buildTermPattern(trimmed)}(?=$|${TERM_BOUNDARY})`,
    'iu'
  ).test(value)
}

function matchesEntireSurface(value: string, term: string): boolean {
  const candidate = value.trim()
  const trimmed = term.trim()
  if (!candidate || !trimmed) return false
  if (CJK_SCRIPT_PATTERN.test(trimmed) || CJK_SCRIPT_PATTERN.test(candidate)) {
    return candidate.toLowerCase() === trimmed.toLowerCase()
  }
  return new RegExp(`^(?:${buildTermPattern(trimmed)})$`, 'iu').test(candidate)
}

export function termsShareWholeCue(left: string, right: string): boolean {
  return matchesEntireSurface(left, right) || matchesEntireSurface(right, left)
}

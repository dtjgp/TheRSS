/**
 * Palette names the renderer stylesheet defines a contrast-tuned `-text` variant for.
 * The macOS accent colour is resolved onto this set rather than applied as raw hex so
 * the Phase 19 N7 contrast contract cannot be broken by an arbitrary system accent.
 */
export const SYSTEM_ACCENT_NAMES = [
  'blue',
  'purple',
  'red',
  'orange',
  'green',
  'teal',
  'cyan',
  'indigo',
  'gray'
] as const

export type SystemAccentName = (typeof SYSTEM_ACCENT_NAMES)[number]

export function isSystemAccentName(value: unknown): value is SystemAccentName {
  return typeof value === 'string' && SYSTEM_ACCENT_NAMES.some((name) => name === value)
}

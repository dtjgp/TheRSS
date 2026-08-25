import { describe, expect, it } from 'vitest'
import { SYSTEM_ACCENT_NAMES } from '../../shared/appearance'
import { resolveSystemAccentName } from './systemAccent'

/**
 * The macOS accent values a stock system reports. Exact hex drifts between macOS
 * releases and users can pick a custom color, so the resolver must map by nearest
 * palette anchor rather than by table lookup.
 */
const MACOS_STOCK_ACCENTS = [
  { label: 'blue', hex: '0A84FF', expected: 'blue' },
  { label: 'purple', hex: 'A550A7', expected: 'purple' },
  { label: 'pink', hex: 'F74F9E', expected: 'purple' },
  { label: 'red', hex: 'FF5257', expected: 'red' },
  { label: 'orange', hex: 'F7821B', expected: 'orange' },
  { label: 'yellow', hex: 'FFC600', expected: 'orange' },
  { label: 'green', hex: '62BA46', expected: 'green' },
  { label: 'graphite', hex: '8C8C8C', expected: 'gray' }
] as const

describe('resolveSystemAccentName', () => {
  it.each(MACOS_STOCK_ACCENTS)(
    'maps the macOS $label accent to the tuned $expected palette entry',
    ({ hex, expected }) => {
      expect(resolveSystemAccentName(hex)).toBe(expected)
    }
  )

  it('accepts the macOS RRGGBBAA form that getAccentColor returns', () => {
    expect(resolveSystemAccentName('0a84ffff')).toBe('blue')
  })

  it('accepts a leading hash and mixed case', () => {
    expect(resolveSystemAccentName('#0A84FF')).toBe('blue')
    expect(resolveSystemAccentName('#ff5257ff')).toBe('red')
  })

  it('only ever returns a name that the tuned palette defines', () => {
    for (const { hex } of MACOS_STOCK_ACCENTS) {
      const resolved = resolveSystemAccentName(hex)
      expect(resolved).not.toBeNull()
      expect(SYSTEM_ACCENT_NAMES).toContain(resolved)
    }
  })

  it.each([
    ['an empty string', ''],
    ['whitespace', '   '],
    ['a short hex', '0A8'],
    ['a non-hex string', 'accentcolor'],
    ['a CSS color name', 'rebeccapurple'],
    ['an rgb() function', 'rgb(10, 132, 255)'],
    ['an over-long value', '0A84FFFFFF']
  ])('returns null for %s so the renderer keeps its default blue', (_label, value) => {
    expect(resolveSystemAccentName(value)).toBeNull()
  })

  it('returns null rather than throwing for non-string input', () => {
    expect(resolveSystemAccentName(undefined)).toBeNull()
    expect(resolveSystemAccentName(null)).toBeNull()
  })

  it('resolves a custom accent to its nearest tuned neighbour', () => {
    // macOS 14+ lets the user pick an arbitrary custom accent colour.
    expect(resolveSystemAccentName('00E5FF')).toBe('cyan')
    expect(resolveSystemAccentName('4B49C8')).toBe('indigo')
    expect(resolveSystemAccentName('1FA8A0')).toBe('teal')
  })
})

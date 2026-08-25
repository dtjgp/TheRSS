import type { SystemAccentName } from '../../shared/appearance'

type Rgb = readonly [number, number, number]

/** Anchors mirror the tuned `--system-*` tokens in the renderer stylesheet. */
const PALETTE_ANCHORS: ReadonlyArray<readonly [SystemAccentName, Rgb]> = [
  ['blue', [0x00, 0x7a, 0xff]],
  ['purple', [0xaf, 0x52, 0xde]],
  ['red', [0xff, 0x3b, 0x30]],
  ['orange', [0xff, 0x95, 0x00]],
  ['green', [0x34, 0xc7, 0x59]],
  ['teal', [0x30, 0xb0, 0xc7]],
  ['cyan', [0x32, 0xad, 0xe6]],
  ['indigo', [0x58, 0x56, 0xd6]],
  ['gray', [0x8e, 0x8e, 0x93]]
]

/** macOS reports `RRGGBB` or `RRGGBBAA`; the alpha byte is ignored. */
const HEX_PATTERN = /^[0-9a-f]{6}(?:[0-9a-f]{2})?$/

function parseHex(value: unknown): Rgb | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/^#/, '').toLowerCase()
  if (!HEX_PATTERN.test(normalized)) return null
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ]
}

/**
 * Redmean distance. It tracks perceived difference far better than plain Euclidean
 * RGB while staying deterministic and dependency-free, which matters because macOS
 * accent hex values drift between releases and users can pick a custom colour.
 *
 * https://en.wikipedia.org/wiki/Color_difference#sRGB
 */
function redmeanDistance(left: Rgb, right: Rgb): number {
  const meanRed = (left[0] + right[0]) / 2
  const deltaRed = left[0] - right[0]
  const deltaGreen = left[1] - right[1]
  const deltaBlue = left[2] - right[2]
  return (
    (2 + meanRed / 256) * deltaRed * deltaRed +
    4 * deltaGreen * deltaGreen +
    (2 + (255 - meanRed) / 256) * deltaBlue * deltaBlue
  )
}

/**
 * Resolve a macOS accent colour to the nearest tuned palette name.
 * Returns `null` for anything unparseable so the renderer keeps its default blue.
 */
export function resolveSystemAccentName(value: unknown): SystemAccentName | null {
  const rgb = parseHex(value)
  if (!rgb) return null

  // 'blue' is the documented default, so it is also the safe starting point.
  let nearest: SystemAccentName = 'blue'
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const [name, anchor] of PALETTE_ANCHORS) {
    const distance = redmeanDistance(rgb, anchor)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = name
    }
  }
  return nearest
}

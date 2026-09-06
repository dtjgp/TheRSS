import { describe, expect, it } from 'vitest'
import { nativeGlassStateSchema } from './nativeGlassSchema'
import { parseNativeGlassEvent } from './nativeGlass'

const state = {
  appearance: 'light',
  contrast: 'normal',
  reduceTransparency: false,
  revision: 1,
  viewport: { width: 1360, height: 880 },
  modal: false,
  surfaces: [
    {
      id: 'sidebar',
      rect: { x: 0, y: 0, width: 224, height: 880 },
      controls: [
        {
          id: 'discover',
          label: 'Discover',
          rect: { x: 12, y: 80, width: 200, height: 34 },
          enabled: true,
          selected: true,
          iconOnly: false
        }
      ],
      labels: []
    }
  ]
}

describe('native glass boundary', () => {
  it('accepts bounded fixed controls and rejects handles or arbitrary native commands', () => {
    expect(nativeGlassStateSchema.parse(state)).toEqual(state)
    expect(nativeGlassStateSchema.safeParse({ ...state, handle: 'pointer' }).success).toBe(false)
    expect(
      nativeGlassStateSchema.safeParse({
        ...state,
        surfaces: [
          {
            ...state.surfaces[0],
            controls: [{ ...state.surfaces[0]!.controls[0], id: 'run-selector' }]
          }
        ]
      }).success
    ).toBe(false)
  })
  it('rejects duplicate IDs, wrong surfaces, invalid geometry and unbounded text', () => {
    const surface = state.surfaces[0]!
    for (const invalid of [
      { ...state, surfaces: [surface, surface] },
      {
        ...state,
        surfaces: [{ ...surface, controls: [...surface.controls, ...surface.controls] }]
      },
      { ...state, surfaces: [{ ...surface, id: 'toast' }] },
      { ...state, viewport: { width: Number.NaN, height: 880 } },
      { ...state, surfaces: [{ ...surface, rect: { ...surface.rect, width: 20000 } }] },
      {
        ...state,
        surfaces: [{ ...surface, controls: [{ ...surface.controls[0], label: 'x'.repeat(161) }] }]
      }
    ])
      expect(nativeGlassStateSchema.safeParse(invalid).success).toBe(false)
  })
  it('parses only the fixed native event protocol', () => {
    expect(parseNativeGlassEvent({ kind: 'activate', id: 'discover', revision: 1 })).toEqual({
      kind: 'activate',
      id: 'discover',
      revision: 1
    })
    expect(
      parseNativeGlassEvent({ kind: 'focus-content', edge: 'first', revision: 2 })
    ).not.toBeNull()
    expect(parseNativeGlassEvent({ kind: 'window-active', active: true })).not.toBeNull()
    expect(parseNativeGlassEvent({ kind: 'fallback', reason: 'native-failure' })).not.toBeNull()
    for (const value of [
      null,
      '',
      {},
      { kind: 'activate', id: 'exec', revision: 1 },
      { kind: 'activate', id: 'discover', revision: -1 },
      { kind: 'focus-content', edge: 'bad', revision: 1 },
      { kind: 'window-active', active: 'yes' },
      { kind: 'fallback', reason: 'arbitrary' }
    ])
      expect(parseNativeGlassEvent(value)).toBeNull()
  })
  it('accepts only bounded keyboard handoff from named native controls', () => {
    const key = {
      kind: 'key',
      id: 'save-item',
      key: 'ArrowDown',
      metaKey: false,
      shiftKey: false,
      repeat: false,
      revision: 1
    }
    expect(parseNativeGlassEvent(key)).toEqual(key)
    expect(parseNativeGlassEvent({ ...key, key: 'z', metaKey: true })).not.toBeNull()
    for (const invalid of [
      { ...key, key: 'v' },
      { ...key, key: 'z' },
      { ...key, key: 's', metaKey: true },
      { ...key, id: 'exec' },
      { ...key, repeat: 'yes' }
    ])
      expect(parseNativeGlassEvent(invalid)).toBeNull()
  })
  it('bounds scroll deltas and fixes the target to a native control', () => {
    const event = { kind: 'scroll', id: 'analyze-item', deltaX: 80, deltaY: 0, revision: 1 }
    expect(parseNativeGlassEvent(event)).toEqual(event)
    for (const invalid of [
      { ...event, deltaX: Infinity },
      { ...event, deltaY: 16385 },
      { ...event, deltaY: '1' },
      { ...event, id: 'arbitrary' }
    ])
      expect(parseNativeGlassEvent(invalid)).toBeNull()
  })
})

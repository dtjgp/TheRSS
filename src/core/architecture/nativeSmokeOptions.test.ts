import { describe, expect, it } from 'vitest'
import { nativeSmokeAppKitOptions } from '../../../scripts/native-smoke-options.mjs'

describe('native smoke AppKit options', () => {
  it('keeps the system scroller style by default', () => {
    expect(nativeSmokeAppKitOptions({})).toEqual({ legacyScrollers: false, args: [] })
    expect(nativeSmokeAppKitOptions({ THERSS_NATIVE_LEGACY_SCROLLERS: '0' }).args).toEqual([])
  })
  it('forces legacy scroll bars for the app process only', () => {
    expect(nativeSmokeAppKitOptions({ THERSS_NATIVE_LEGACY_SCROLLERS: '1' })).toEqual({
      legacyScrollers: true,
      args: ['-AppleShowScrollBars', 'Always']
    })
  })
})

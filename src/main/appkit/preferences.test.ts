import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { readNativePreferences, writeNativePreferences } from './preferences'

describe('native UI preferences', () => {
  it('serializes overlapping writes from closing and reopening windows', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'therss-native-prefs-')), 'ui.json')
    const baseline = await readNativePreferences(path)
    await Promise.all(
      Array.from({ length: 30 }, (_, index) =>
        writeNativePreferences(path, { ...baseline, sidebar: 184 + index })
      )
    )
    expect(await readNativePreferences(path)).toEqual({ ...baseline, sidebar: 213 })
  })
  it('reads the latest accepted write when a window immediately reopens', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'therss-native-prefs-')), 'ui.json')
    const baseline = await readNativePreferences(path)
    await writeNativePreferences(path, baseline)
    const saving = writeNativePreferences(path, { ...baseline, sidebar: 300 })
    expect((await readNativePreferences(path)).sidebar).toBe(300)
    await saving
  })
  it('migrates known legacy widths once and clamps invalid values', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'therss-native-prefs-')), 'ui.json')
    const prefs = await readNativePreferences(path, {
      sidebar: '256',
      discover: '420',
      saved: 'NaN'
    })
    expect(prefs).toEqual({
      version: 1,
      sidebar: 256,
      discover: 420,
      saved: 320,
      collapsed: false,
      zoom: 1
    })
    await writeNativePreferences(path, prefs)
    expect(await readNativePreferences(path, { sidebar: '300', saved: '500' })).toEqual(prefs)
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(prefs)
  })
  it('recovers safely from corrupted preferences without touching window bounds or research data', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'therss-native-prefs-')), 'ui.json')
    await writeFile(path, 'not json')
    expect(await readNativePreferences(path, { sidebar: '99999', discover: '-20' })).toEqual({
      version: 1,
      sidebar: 224,
      discover: 320,
      saved: 320,
      collapsed: false,
      zoom: 1
    })
  })
  it('skips the lazy legacy reader when a valid preferences file already exists', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'therss-native-prefs-')), 'ui.json')
    const saved = {
      version: 1 as const,
      sidebar: 248,
      discover: 350,
      saved: 320,
      collapsed: false,
      zoom: 1
    }
    await writeNativePreferences(path, saved)
    const readLegacy = vi.fn(async () => ({ sidebar: '300' }))
    expect(await readNativePreferences(path, readLegacy)).toEqual(saved)
    expect(readLegacy).not.toHaveBeenCalled()
  })
  it('migrates from a lazy legacy reader when missing and recovers from rejection or timeout', async () => {
    const missing = join(await mkdtemp(join(tmpdir(), 'therss-native-prefs-')), 'ui.json')
    const readLegacy = vi.fn(async () => ({ sidebar: '264', discover: '380' }))
    expect(await readNativePreferences(missing, readLegacy)).toEqual({
      version: 1,
      sidebar: 264,
      discover: 380,
      saved: 320,
      collapsed: false,
      zoom: 1
    })
    expect(readLegacy).toHaveBeenCalledTimes(1)

    const rejecting = vi.fn(async () => {
      throw new Error('renderer detached')
    })
    expect(await readNativePreferences(missing, rejecting)).toEqual({
      version: 1,
      sidebar: 224,
      discover: 320,
      saved: 320,
      collapsed: false,
      zoom: 1
    })

    const stalled = vi.fn(() => new Promise<Record<string, string | null>>(() => undefined))
    expect(await readNativePreferences(missing, stalled, { legacyTimeoutMs: 25 })).toEqual({
      version: 1,
      sidebar: 224,
      discover: 320,
      saved: 320,
      collapsed: false,
      zoom: 1
    })
  })
})

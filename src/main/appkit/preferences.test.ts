import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
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
})

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  readWindowState,
  writeWindowState,
  type PersistedWindowState,
  type WindowBounds
} from './windowState'

const temporaryDirectories: string[] = []
const fallback: WindowBounds = { x: 80, y: 60, width: 1360, height: 880 }
const workAreas: readonly WindowBounds[] = [
  { x: 0, y: 0, width: 1728, height: 1080 },
  { x: 1728, y: 0, width: 1440, height: 900 }
]

async function temporaryStatePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'therss-window-state-test-'))
  temporaryDirectories.push(directory)
  return join(directory, 'window-state.json')
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
  )
})

describe('windowState', () => {
  it('round-trips validated bounds and maximized state atomically', async () => {
    const path = await temporaryStatePath()
    const state: PersistedWindowState = {
      bounds: { x: 1840, y: 40, width: 1180, height: 780 },
      maximized: true
    }

    await writeWindowState(path, state)

    expect(await readWindowState(path, fallback, workAreas)).toEqual(state)
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(state)
  })

  it('falls back for corrupt, off-screen, or implausible saved state', async () => {
    const path = await temporaryStatePath()
    await writeFile(path, '{not-json', 'utf8')
    await expect(readWindowState(path, fallback, workAreas)).resolves.toEqual({
      bounds: fallback,
      maximized: false
    })

    await writeFile(
      path,
      JSON.stringify({ bounds: { x: 9000, y: 9000, width: 400, height: 300 }, maximized: true }),
      'utf8'
    )
    await expect(readWindowState(path, fallback, workAreas)).resolves.toEqual({
      bounds: fallback,
      maximized: false
    })
  })

  it('clamps oversized saved bounds to the containing display work area', async () => {
    const path = await temporaryStatePath()
    await writeFile(
      path,
      JSON.stringify({ bounds: { x: 40, y: 20, width: 5000, height: 3000 }, maximized: false }),
      'utf8'
    )

    await expect(readWindowState(path, fallback, workAreas)).resolves.toEqual({
      bounds: { x: 40, y: 20, width: 1688, height: 1060 },
      maximized: false
    })
  })

  it('falls back when the saved origin leaves less than the minimum visible window', async () => {
    const path = await temporaryStatePath()
    await writeFile(
      path,
      JSON.stringify({
        bounds: { x: 1700, y: 100, width: 900, height: 700 },
        maximized: false
      }),
      'utf8'
    )

    await expect(readWindowState(path, fallback, workAreas)).resolves.toEqual({
      bounds: fallback,
      maximized: false
    })
  })
})

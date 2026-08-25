import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { countSourceLines, findOversizedSourceFiles } from './sourceFilePolicy'

const temporaryDirectories: string[] = []

async function temporarySourceRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'therss-source-policy-'))
  temporaryDirectories.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('source file architecture policy', () => {
  it('counts logical source lines without inventing a trailing blank line', () => {
    expect(countSourceLines('first\nsecond\n')).toBe(2)
    expect(countSourceLines('first\nsecond')).toBe(2)
    expect(countSourceLines('')).toBe(0)
  })

  it('reports oversized TypeScript source and tests while ignoring declarations', async () => {
    const root = await temporarySourceRoot()
    await mkdir(join(root, 'nested'), { recursive: true })
    await writeFile(join(root, 'within-limit.ts'), `${'line\n'.repeat(799)}line\n`)
    await writeFile(join(root, 'oversized.test.ts'), 'line\n'.repeat(801))
    await writeFile(join(root, 'nested', 'oversized.tsx'), 'line\n'.repeat(802))
    await writeFile(join(root, 'generated.d.ts'), 'line\n'.repeat(900))
    await writeFile(join(root, 'not-source.js'), 'line\n'.repeat(900))

    await expect(findOversizedSourceFiles(root, 800)).resolves.toEqual([
      { path: 'nested/oversized.tsx', lines: 802 },
      { path: 'oversized.test.ts', lines: 801 }
    ])
  })
})

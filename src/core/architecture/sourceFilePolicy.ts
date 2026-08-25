import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

export interface OversizedSourceFile {
  readonly path: string
  readonly lines: number
}

export function countSourceLines(source: string): number {
  if (source.length === 0) return 0
  const newlineCount = source.match(/\n/gu)?.length ?? 0
  return newlineCount + (source.endsWith('\n') ? 0 : 1)
}

function isOwnedTypeScriptSource(path: string): boolean {
  return (path.endsWith('.ts') || path.endsWith('.tsx')) && !path.endsWith('.d.ts')
}

function portableRelativePath(root: string, path: string): string {
  return relative(root, path).split(sep).join('/')
}

export async function findOversizedSourceFiles(
  root: string,
  maxLines: number
): Promise<OversizedSourceFile[]> {
  if (!Number.isInteger(maxLines) || maxLines < 1) {
    throw new Error('The source line limit must be a positive integer')
  }

  const violations: OversizedSourceFile[] = []
  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.isSymbolicLink()) continue
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(path)
        continue
      }
      if (!entry.isFile() || !isOwnedTypeScriptSource(entry.name)) continue
      const lines = countSourceLines(await readFile(path, 'utf8'))
      if (lines > maxLines) {
        violations.push({ path: portableRelativePath(root, path), lines })
      }
    }
  }

  await visit(root)
  return violations.sort((left, right) => left.path.localeCompare(right.path))
}

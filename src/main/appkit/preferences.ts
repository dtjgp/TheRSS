import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

const schema = z
  .object({
    version: z.literal(1),
    sidebar: z.number().min(184).max(360),
    discover: z.number().min(260).max(520),
    saved: z.number().min(260).max(520),
    collapsed: z.boolean(),
    zoom: z.number().min(0.8).max(1.5)
  })
  .strict()
export type NativePreferences = z.infer<typeof schema>
export const defaultNativePreferences: NativePreferences = {
  version: 1,
  sidebar: 224,
  discover: 320,
  saved: 320,
  collapsed: false,
  zoom: 1
}
const pendingByPath = new Map<string, Promise<void>>()

export async function readNativePreferences(
  path: string,
  legacy: Readonly<Partial<Record<'sidebar' | 'discover' | 'saved', string | null>>> = {}
): Promise<NativePreferences> {
  await pendingByPath.get(path)?.catch(() => undefined)
  try {
    const raw = await readFile(path, 'utf8')
    if (raw.length <= 4096) return schema.parse(JSON.parse(raw))
  } catch {
    /* Missing/corrupt UI preferences never prevent opening the research index. */
  }
  const width = (key: 'sidebar' | 'discover' | 'saved', min: number, max: number) => {
    const value = Number(legacy[key])
    return Number.isFinite(value) && value >= min && value <= max
      ? value
      : defaultNativePreferences[key]
  }
  return {
    ...defaultNativePreferences,
    sidebar: width('sidebar', 184, 360),
    discover: width('discover', 260, 520),
    saved: width('saved', 260, 520)
  }
}
export async function writeNativePreferences(
  path: string,
  preferences: NativePreferences
): Promise<void> {
  const validated = schema.parse(preferences)
  const operation = (pendingByPath.get(path) ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
      try {
        await writeFile(temporary, JSON.stringify(validated) + '\n', { mode: 0o600 })
        await rename(temporary, path)
      } catch (error) {
        await rm(temporary, { force: true })
        throw error
      }
    })
  pendingByPath.set(path, operation)
  try {
    await operation
  } finally {
    if (pendingByPath.get(path) === operation) pendingByPath.delete(path)
  }
}

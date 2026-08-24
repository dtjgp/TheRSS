import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pid } from 'node:process'

export interface WindowBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface PersistedWindowState {
  readonly bounds: WindowBounds
  readonly maximized: boolean
}

const MIN_WINDOW_WIDTH = 820
const MIN_WINDOW_HEIGHT = 600

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseWindowState(value: unknown): PersistedWindowState | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<PersistedWindowState>
  if (!candidate.bounds || typeof candidate.maximized !== 'boolean') return null
  const { x, y, width, height } = candidate.bounds
  if (![x, y, width, height].every(isFiniteNumber)) return null
  if (width < MIN_WINDOW_WIDTH || height < MIN_WINDOW_HEIGHT) return null
  return {
    bounds: {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height)
    },
    maximized: candidate.maximized
  }
}

function containsPoint(area: WindowBounds, x: number, y: number): boolean {
  return x >= area.x && x < area.x + area.width && y >= area.y && y < area.y + area.height
}

function fitToWorkArea(
  state: PersistedWindowState,
  workAreas: readonly WindowBounds[]
): PersistedWindowState | null {
  const area = workAreas.find((candidate) =>
    containsPoint(candidate, state.bounds.x, state.bounds.y)
  )
  if (!area) return null
  const availableWidth = area.x + area.width - state.bounds.x
  const availableHeight = area.y + area.height - state.bounds.y
  if (availableWidth < MIN_WINDOW_WIDTH || availableHeight < MIN_WINDOW_HEIGHT) return null
  return {
    bounds: {
      x: state.bounds.x,
      y: state.bounds.y,
      width: Math.min(state.bounds.width, availableWidth),
      height: Math.min(state.bounds.height, availableHeight)
    },
    maximized: state.maximized
  }
}

export async function readWindowState(
  path: string,
  fallback: WindowBounds,
  workAreas: readonly WindowBounds[]
): Promise<PersistedWindowState> {
  try {
    const parsed = parseWindowState(JSON.parse(await readFile(path, 'utf8')))
    const fitted = parsed ? fitToWorkArea(parsed, workAreas) : null
    return fitted ?? { bounds: fallback, maximized: false }
  } catch {
    return { bounds: fallback, maximized: false }
  }
}

export async function writeWindowState(path: string, state: PersistedWindowState): Promise<void> {
  const parsed = parseWindowState(state)
  if (!parsed) throw new Error('Refusing to persist invalid window state')
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.tmp-${pid}-${Date.now()}`
  await writeFile(temporaryPath, `${JSON.stringify(parsed)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporaryPath, path)
}

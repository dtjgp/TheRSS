import { z } from 'zod'
import { CONTROL_SURFACE, NATIVE_CONTROL_IDS } from './nativeGlass'

const coordinate = z.number().finite().min(-16384).max(16384)
const dimension = z.number().finite().min(0).max(16384)
const rect = z
  .object({ x: coordinate, y: coordinate, width: dimension, height: dimension })
  .strict()
const text = z
  .string()
  .max(160)
  .refine((value) =>
    Array.from(value).every(
      (character) => character.charCodeAt(0) >= 32 || '\t\n\r'.includes(character)
    )
  )
const control = z
  .object({
    id: z.enum(NATIVE_CONTROL_IDS),
    label: text,
    rect,
    enabled: z.boolean(),
    selected: z.boolean(),
    iconOnly: z.boolean()
  })
  .strict()
const label = z
  .object({
    id: z.enum(['sidebar-title', 'header-title', 'header-date', 'header-context', 'toast-copy']),
    text,
    rect,
    fontSize: z.number().finite().min(8).max(36),
    bold: z.boolean(),
    tone: z.enum(['primary', 'secondary', 'error'])
  })
  .strict()
const surface = z
  .object({
    id: z.enum(['sidebar', 'header', 'actions', 'toast']),
    rect,
    controls: z.array(control).max(12),
    labels: z.array(label).max(5)
  })
  .strict()

export const nativeGlassStateSchema = z
  .object({
    appearance: z.enum(['light', 'dark']),
    contrast: z.enum(['normal', 'more']),
    reduceTransparency: z.boolean(),
    revision: z.number().int().min(1).max(2147483647),
    scrollRevision: z.number().int().min(1).max(2147483647),
    viewport: z.object({ width: dimension.min(1), height: dimension.min(1) }).strict(),
    modal: z.boolean(),
    surfaces: z.array(surface).max(4)
  })
  .strict()
  .superRefine((state, context) => {
    if (state.scrollRevision > state.revision)
      context.addIssue({ code: 'custom', message: 'Scroll context starts after this layout' })
    const ids = new Set<string>()
    for (const group of state.surfaces) {
      if (ids.has(group.id))
        context.addIssue({ code: 'custom', message: 'Duplicate native surface' })
      ids.add(group.id)
      for (const item of [...group.controls, ...group.labels]) {
        if (ids.has(item.id)) context.addIssue({ code: 'custom', message: 'Duplicate native item' })
        ids.add(item.id)
      }
      if (group.controls.some((item) => CONTROL_SURFACE[item.id] !== group.id))
        context.addIssue({ code: 'custom', message: 'Control does not belong to this surface' })
    }
  })

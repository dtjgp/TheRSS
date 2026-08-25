import { z } from 'zod'

/** Every action a context menu entry can carry. */
export const CONTEXT_MENU_ACTIONS = [
  'open-external',
  'copy-link',
  'copy-title',
  'copy-citation',
  'save',
  'unsave',
  'analyze',
  'promote'
] as const

export type ContextMenuAction = (typeof CONTEXT_MENU_ACTIONS)[number]

/**
 * Actions the main process cannot complete alone. They are returned to the renderer so
 * the existing save/analyze/promote flows stay the single implementation of each.
 */
export const RENDERER_CONTEXT_MENU_ACTIONS = ['save', 'unsave', 'analyze', 'promote'] as const

export type RendererContextMenuAction = (typeof RENDERER_CONTEXT_MENU_ACTIONS)[number]

/**
 * A typed description of the right-clicked item. The renderer sends data only; the main
 * process derives every label and behaviour from this, so no renderer-supplied string
 * can become a menu command.
 */
export const contextMenuTargetSchema = z.object({
  kind: z.enum(['discover-result', 'saved-item']),
  itemId: z.string().min(1).max(512),
  sessionId: z.string().min(1).max(512).optional(),
  title: z.string().max(1000),
  url: z.string().max(2048),
  sourceLabel: z.string().max(200),
  publishedAt: z.string().max(64),
  isSaved: z.boolean(),
  canAnalyze: z.boolean(),
  canPromote: z.boolean()
})

export type ContextMenuTarget = z.infer<typeof contextMenuTargetSchema>

export type ContextMenuOutcome =
  | { readonly action: 'none' }
  | {
      readonly action: RendererContextMenuAction
      readonly itemId: string
      readonly sessionId?: string
    }

export function isRendererContextMenuAction(
  value: ContextMenuAction
): value is RendererContextMenuAction {
  return RENDERER_CONTEXT_MENU_ACTIONS.some((action) => action === value)
}

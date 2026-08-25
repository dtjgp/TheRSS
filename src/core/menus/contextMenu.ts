import type { ContextMenuAction, ContextMenuTarget } from '../../shared/contextMenu'

export interface ContextMenuSeparator {
  readonly type: 'separator'
}

export interface ContextMenuItem {
  readonly type: 'item'
  readonly action: ContextMenuAction
  readonly label: string
}

export type ContextMenuEntry = ContextMenuSeparator | ContextMenuItem

/**
 * Only `https:` targets may be opened or copied as links. This mirrors the main
 * process' `isSafeExternalUrl` so a feed-supplied `javascript:` or `file:` URL can
 * never reach `shell.openExternal` or the clipboard.
 */
function isSafeLink(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/** ISO calendar day, or null when the source supplied an unparseable timestamp. */
function isoDay(value: string): string | null {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function item(action: ContextMenuAction, label: string): ContextMenuItem {
  return { type: 'item', action, label }
}

/**
 * Derive the context menu for one item. Groups are assembled independently and then
 * joined, so an absent group cannot leave a leading, trailing, or doubled separator.
 */
export function buildContextMenuTemplate(target: ContextMenuTarget): readonly ContextMenuEntry[] {
  const navigation: ContextMenuItem[] = []
  if (isSafeLink(target.url)) {
    navigation.push(item('open-external', 'Open in Browser'), item('copy-link', 'Copy Link'))
  }

  const copy: ContextMenuItem[] = [
    item('copy-title', 'Copy Title'),
    item('copy-citation', 'Copy Citation')
  ]

  const actions: ContextMenuItem[] = [
    target.isSaved ? item('unsave', 'Remove from Saved') : item('save', 'Save to Saved')
  ]
  if (target.canAnalyze) actions.push(item('analyze', 'Analyze…'))
  if (target.canPromote) actions.push(item('promote', 'Promote to llm-wiki…'))

  const groups = [navigation, copy, actions].filter((group) => group.length > 0)
  return groups.flatMap((group, index) =>
    index === 0 ? group : [{ type: 'separator' as const }, ...group]
  )
}

/**
 * The exact text an entry places on the clipboard, or null when the entry copies
 * nothing. Citations are built from discovery metadata only and are therefore
 * discovery evidence, not a verified bibliographic record.
 */
export function buildCopyPayload(
  target: ContextMenuTarget,
  action: ContextMenuAction
): string | null {
  const link = isSafeLink(target.url) ? target.url : null

  if (action === 'copy-link') return link
  if (action === 'copy-title') return target.title
  if (action !== 'copy-citation') return null

  const day = isoDay(target.publishedAt)
  return [target.title, target.sourceLabel, day, link].filter((part) => Boolean(part)).join('. ')
}

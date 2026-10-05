/** Commands that only change the main window's view: safe to forward from another window. */
const MAIN_WINDOW_COMMANDS = new Set([
  'show-discover',
  'show-saved',
  'show-analytics',
  'show-sources',
  'toggle-sidebar',
  'open-local-search',
  'open-settings',
  'open-help'
])

/**
 * Where an application-menu command goes when a record or Settings window is focused. Item and
 * triage commands (save, dismiss, analyze, undo) would act on the main window's selection, a
 * record the user is not looking at, so they are dropped; view commands go to the main window.
 */
export function routeAppCommand(
  command: string,
  auxiliaryWindowFocused: boolean
): 'focused' | 'main' | 'drop' {
  if (!auxiliaryWindowFocused) return 'focused'
  return MAIN_WINDOW_COMMANDS.has(command) ? 'main' : 'drop'
}

/** Whether a control can take keyboard focus now (enabled, rendered and not hidden). */
export function isTabbable(element: HTMLElement): boolean {
  if (element.tabIndex < 0 || element.matches(':disabled')) return false
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false
  if (getComputedStyle(element).visibility !== 'visible') return false
  for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
    if (getComputedStyle(ancestor).display === 'none') return false
  }
  return true
}

/**
 * Moves focus to the next or previous focusable control inside a modal container, wrapping at
 * both ends. With no focusable control the container itself keeps focus.
 */
export function cycleFocus(container: HTMLElement, backwards: boolean): void {
  const controls = Array.from(
    container.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')
  ).filter(isTabbable)
  const currentIndex = controls.findIndex((control) => control === document.activeElement)
  const nextIndex = backwards
    ? currentIndex <= 0
      ? controls.length - 1
      : currentIndex - 1
    : (currentIndex + 1) % controls.length
  ;(controls[nextIndex] ?? container).focus()
}

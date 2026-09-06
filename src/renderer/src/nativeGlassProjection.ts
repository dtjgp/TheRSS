import type {
  NativeControl,
  NativeControlId,
  NativeGlassScope,
  NativeGlassState,
  NativeLabel,
  NativeRect,
  NativeSurface,
  NativeSurfaceId
} from '../../shared/nativeGlass'

const controlDefinitions: readonly [NativeControlId, NativeSurfaceId, string, string?][] = [
  ['discover', 'sidebar', '.sidebar [aria-label="01 Discover"]', 'Discover'],
  ['saved', 'sidebar', '.sidebar [aria-label="02 Saved"]', 'Saved'],
  ['analytics', 'sidebar', '.sidebar [aria-label="03 Data Analytics"]', 'Data Analytics'],
  ['sources', 'sidebar', '.sidebar [aria-label="04 Sources"]', 'Sources'],
  ['settings', 'sidebar', '.sidebar button[aria-label="Settings"]', 'Settings'],
  ['source-status', 'sidebar', '.sidebar__footer'],
  ['sidebar-toggle', 'header', '.topbar .toolbar-button'],
  ['save-item', 'actions', '.signal-detail__actions [data-native-action="save-item"]'],
  ['analyze-item', 'actions', '.signal-detail__actions [data-native-action="analyze-item"]'],
  ['promote-item', 'actions', '.signal-detail__actions .paper-promotion-action > button'],
  ['dismiss-item', 'actions', '.signal-detail__actions [aria-label="Dismiss signal"]'],
  ['undo', 'toast', '.triage-toast > button']
]
const groupSelectors: Readonly<Record<NativeSurfaceId, string>> = {
  sidebar: '.sidebar',
  header: '.topbar',
  actions: '.signal-detail__actions',
  toast: '.triage-toast'
}
const labelDefinitions: readonly [NativeLabel['id'], NativeSurfaceId, string][] = [
  ['sidebar-title', 'sidebar', '.sidebar__title'],
  ['header-title', 'header', '.profile-name'],
  ['header-date', 'header', '.dateline'],
  ['header-context', 'header', '.topbar-context'],
  ['toast-copy', 'toast', '.triage-toast > span']
]
function plainText(value: string): string {
  return Array.from(value.replace(/\s+/gu, ' ').trim()).slice(0, 160).join('')
}
export function intersectRect(a: NativeRect, b: NativeRect): NativeRect | null {
  const x = Math.max(a.x, b.x),
    y = Math.max(a.y, b.y)
  const width = Math.min(a.x + a.width, b.x + b.width) - x,
    height = Math.min(a.y + a.height, b.y + b.height) - y
  return width > 0 && height > 0 ? { x, y, width, height } : null
}
function rectOf(element: HTMLElement): NativeRect {
  const { x, y, width, height } = element.getBoundingClientRect()
  return { x, y, width, height }
}
function clippedRect(element: HTMLElement, viewport: NativeRect): NativeRect | null {
  let rect = intersectRect(rectOf(element), viewport)
  for (let parent = element.parentElement; rect && parent; parent = parent.parentElement) {
    if (
      /(auto|scroll|hidden|clip)/u.test(
        getComputedStyle(parent).overflow +
          getComputedStyle(parent).overflowX +
          getComputedStyle(parent).overflowY
      )
    )
      rect = intersectRect(rect, rectOf(parent))
  }
  return rect
}
function buttonLabel(element: HTMLButtonElement): string {
  const clone = element.cloneNode(true) as HTMLElement
  clone.querySelectorAll('svg,kbd').forEach((node) => node.remove())
  return plainText(clone.textContent || element.getAttribute('aria-label') || element.title)
}
export interface NativeProjection {
  readonly state: NativeGlassState
  readonly controls: ReadonlyMap<NativeControlId, HTMLButtonElement>
  readonly masked: ReadonlySet<HTMLElement>
  readonly groups: ReadonlySet<HTMLElement>
  readonly identity: string
}
export function collectNativeProjection(
  scope: NativeGlassScope,
  revision: number
): NativeProjection {
  const viewport = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }
  const controls = new Map<NativeControlId, HTMLButtonElement>()
  const masked = new Set<HTMLElement>(),
    groups = new Set<HTMLElement>()
  const surfaces: NativeSurface[] = []
  const modal = Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'))
  for (const [id, selector] of Object.entries(groupSelectors) as [NativeSurfaceId, string][]) {
    if (scope === 'pilot' && id !== 'sidebar' && id !== 'header') continue
    const element = document.querySelector<HTMLElement>(selector)
    if (!element) continue
    const rect = clippedRect(element, viewport)
    if (!rect) continue
    const nativeControls: NativeControl[] = [],
      labels: NativeLabel[] = []
    for (const [controlId, group, query, fixedLabel] of controlDefinitions) {
      if (group !== id) continue
      const button = document.querySelector<HTMLButtonElement>(query)
      if (!button) continue
      const box = clippedRect(button, viewport)
      const original = rectOf(button)
      if (!box) continue
      nativeControls.push({
        id: controlId,
        label: fixedLabel ?? buttonLabel(button),
        rect: original,
        enabled: !button.disabled,
        selected:
          button.getAttribute('aria-pressed') === 'true' ||
          button.classList.contains('nav-item--active'),
        iconOnly:
          controlId === 'sidebar-toggle' ||
          controlId === 'save-item' ||
          (id === 'sidebar' && document.querySelector('.app-shell--sidebar-collapsed') !== null)
      })
      controls.set(controlId, button)
      masked.add(button)
    }
    for (const [labelId, group, query] of labelDefinitions) {
      if (group !== id) continue
      const label = document.querySelector<HTMLElement>(query)
      if (!label) continue
      const box = intersectRect(rectOf(label), rect)
      if (!box) continue
      const style = getComputedStyle(label)
      const raw =
        labelId === 'header-context'
          ? Array.from(label.children)
              .filter((child) => getComputedStyle(child).display !== 'none')
              .map((child) => child.textContent)
              .join(' · ')
          : (label.textContent ?? '')
      labels.push({
        id: labelId,
        text: plainText(raw),
        rect: box,
        fontSize: Math.max(8, Math.min(36, Number.parseFloat(style.fontSize) || 12)),
        bold: Number.parseInt(style.fontWeight, 10) >= 600,
        tone:
          label.dataset.tone === 'attention'
            ? 'error'
            : labelId === 'header-title'
              ? 'primary'
              : 'secondary'
      })
      masked.add(label)
    }
    if (nativeControls.length === 0 && labels.length === 0) continue
    nativeControls.sort((left, right) =>
      controls.get(left.id)!.compareDocumentPosition(controls.get(right.id)!) &
      Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1
    )
    surfaces.push({ id, rect, controls: nativeControls, labels })
    groups.add(element)
  }
  const identity = JSON.stringify([
    document.querySelector<HTMLElement>('.app-shell')?.dataset.view,
    document.querySelector('.signal-detail')?.getAttribute('data-native-context')
  ])
  return {
    state: {
      appearance: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      contrast: window.matchMedia?.('(prefers-contrast: more)').matches ? 'more' : 'normal',
      reduceTransparency:
        window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches ?? false,
      revision,
      viewport: { width: viewport.width, height: viewport.height },
      modal,
      surfaces
    },
    controls,
    masked,
    groups,
    identity
  }
}
export function focusableWebElements(root: ParentNode = document): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]')
  ).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(':disabled') &&
      !element.closest('[inert],[hidden],[aria-hidden="true"]') &&
      getComputedStyle(element).display !== 'none' &&
      getComputedStyle(element).visibility !== 'hidden'
  )
}

/** Native foreground owns pointer input; DOM owns the existing scroll containers. */
export function scrollWebAncestors(button: HTMLElement, deltaX: number, deltaY: number): void {
  let x = deltaX,
    y = deltaY
  for (let parent = button.parentElement; parent && (x || y); parent = parent.parentElement) {
    const style = getComputedStyle(parent)
    if (x && /(auto|scroll)/u.test(style.overflowX || style.overflow)) {
      const before = parent.scrollLeft
      parent.scrollLeft += x
      x -= parent.scrollLeft - before
      if (style.overscrollBehaviorX === 'contain' || style.overscrollBehaviorX === 'none') x = 0
    }
    if (y && /(auto|scroll)/u.test(style.overflowY || style.overflow)) {
      const before = parent.scrollTop
      parent.scrollTop += y
      y -= parent.scrollTop - before
      if (style.overscrollBehaviorY === 'contain' || style.overscrollBehaviorY === 'none') y = 0
    }
  }
}

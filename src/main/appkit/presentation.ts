import { z } from 'zod'

const nativeSymbols = [
  'sparkle.magnifyingglass',
  'star',
  'star.fill',
  'chart.bar',
  'square.stack',
  'gearshape',
  'magnifyingglass',
  'arrow.uturn.backward',
  'sidebar.left',
  'arrow.up.right',
  'exclamationmark.circle',
  'sparkles',
  'chevron.backward',
  'doc.text',
  'chevron.left.forwardslash.chevron.right',
  'newspaper',
  'cpu',
  'tablecells',
  'text.bubble',
  'square.and.arrow.up',
  'person.crop.circle'
] as const
export type NativeSymbol = (typeof nativeSymbols)[number]

export interface NativeRow {
  readonly id: string
  readonly title: string
  readonly subtitle?: string | undefined
  readonly symbol?: NativeSymbol | undefined
  /** Accessible name of a research row's kind glyph, e.g. "Paper". */
  readonly symbolLabel?: string | undefined
  /** Research rows: the item is saved (trailing star). */
  readonly saved?: boolean | undefined
  /** Research rows: what a drag to another app carries (https link, title, citation text). */
  readonly drag?:
    { readonly url: string; readonly title: string; readonly text: string } | undefined
  readonly cells?: Readonly<Record<string, string>> | undefined
}
/** Window-level commands shown in the AppKit toolbar; never part of the content tree. */
export interface NativeToolbarItem {
  readonly id: string
  readonly title: string
  readonly symbol: NativeSymbol
  readonly help?: string | undefined
  readonly enabled?: boolean | undefined
  readonly action?: string | undefined
  /** Items placed in the sidebar section, before the toolbar's sidebar tracking separator. */
  readonly placement?: 'sidebar' | undefined
  /** A toolbar search field: `action` receives committed text, `activate` receives Return. */
  readonly kind?: 'search' | undefined
  readonly placeholder?: string | undefined
  readonly value?: string | undefined
  readonly activate?: string | undefined
}
export interface NativeToolbar {
  readonly title: string
  readonly items: readonly NativeToolbarItem[]
  /** `preference`: a Settings window toolbar of selectable panes (centered, with labels). */
  readonly style?: 'preference' | undefined
  /** The selected pane item of a preference toolbar. */
  readonly selected?: string | undefined
}
/** Transient content shown in an NSPopover below the `anchor` node of the scene root. */
export interface NativePopover {
  readonly anchor: string
  /** Emitted when the user dismisses the popover (outside click or Escape). */
  readonly close: string
  readonly root: NativeNode
}
export interface NativeColumn {
  readonly id: string
  readonly title: string
  readonly width: number
  readonly alignment?: 'left' | 'right' | undefined
}
export interface NativeOption {
  readonly id: string
  readonly title: string
  readonly enabled?: boolean | undefined
}
export type NativeKind =
  | 'column'
  | 'row'
  | 'split'
  | 'scroll'
  | 'label'
  | 'text'
  | 'input'
  | 'secure'
  | 'button'
  | 'select'
  | 'check'
  | 'table'
  | 'chart'
  | 'sidebar'
  | 'progress'
  | 'segmented'
  | 'symbol'
export interface NativeNode {
  readonly compactPane?: 'list' | 'detail' | undefined
  readonly wrap?: boolean | undefined
  readonly help?: string | undefined
  readonly destructive?: boolean | undefined
  readonly id: string
  readonly kind: NativeKind
  readonly maxLines?: number | undefined
  readonly points?: readonly { readonly date: string; readonly value: number }[] | undefined
  readonly emphasis?: 'primary' | 'navigation' | 'quiet' | undefined
  readonly symbol?: NativeSymbol | undefined
  readonly surface?: 'panel' | 'inset' | 'reading' | undefined
  readonly title?: string | undefined
  readonly text?: string | undefined
  readonly value?: string | undefined
  readonly placeholder?: string | undefined
  readonly action?: string | undefined
  readonly activate?: string | undefined
  readonly context?: string | undefined
  /** Tables: double-click opens the row in its own window. */
  readonly openWindow?: string | undefined
  readonly checked?: boolean | undefined
  readonly enabled?: boolean | undefined
  readonly selected?: string | undefined
  readonly rows?: readonly NativeRow[] | undefined
  readonly columns?: readonly NativeColumn[] | undefined
  readonly options?: readonly NativeOption[] | undefined
  readonly children?: readonly NativeNode[] | undefined
  readonly width?: number | undefined
  readonly height?: number | undefined
  readonly minHeight?: number | undefined
  readonly flex?: number | undefined
  readonly gap?: number | undefined
  readonly padding?: number | undefined
  readonly size?: number | undefined
  readonly weight?: 'regular' | 'bold' | 'secondary' | 'title' | undefined
  /** macOS text style (system sizes); `size` is kept only for reading text and symbols. */
  readonly textStyle?:
    | 'title1'
    | 'title2'
    | 'title3'
    | 'headline'
    | 'body'
    | 'callout'
    | 'subheadline'
    | 'footnote'
    | undefined
  readonly glass?: boolean | undefined
  readonly adaptiveScroll?: boolean | undefined
  /** A scroll node whose content height a preference window takes when its pane changes. */
  readonly fitWindow?: boolean | undefined
  readonly multiline?: boolean | undefined
  readonly maxLength?: number | undefined
  readonly clearRevision?: number | undefined
  readonly minWidth?: number | undefined
  readonly minContentWidth?: number | undefined
  readonly maxWidth?: number | undefined
  readonly collapseAt?: number | undefined
  /** Starts content below the window toolbar while the column background reaches the top. */
  readonly safeArea?: boolean | undefined
  /** Determinate progress (progress nodes only); omit both for indeterminate progress. */
  readonly completed?: number | undefined
  readonly total?: number | undefined
  /** Button only: opens the system sharing picker for this https link instead of an action. */
  readonly share?: { readonly url: string } | undefined
  /** The window's sidebar split: hosted so the toolbar title sits over the content column. */
  readonly windowSidebar?: boolean | undefined
  /** Centered columns center their stack and children; centered labels center their text. */
  readonly align?: 'center' | undefined
  /** Button key equivalent: Return (default button) or Command-Return. */
  readonly shortcut?: 'return' | 'command-return' | undefined
}

const short = z.string().max(4096)
// Only https links may reach the pasteboard or a sharing service (as for Open in Browser).
const httpsUrl = z
  .string()
  .max(4096)
  .refine((value) => {
    try {
      return new URL(value).protocol === 'https:'
    } catch {
      return false
    }
  }, 'Only https links can be shared or dragged')
const positive = z.number().finite().min(0).max(100000)
const nodeSchema: z.ZodType<NativeNode> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1).max(300),
      kind: z.enum([
        'column',
        'row',
        'split',
        'scroll',
        'label',
        'text',
        'input',
        'secure',
        'button',
        'select',
        'check',
        'table',
        'chart',
        'sidebar',
        'progress',
        'segmented',
        'symbol'
      ]),
      compactPane: z.enum(['list', 'detail']).optional(),
      wrap: z.boolean().optional(),
      help: short.optional(),
      destructive: z.boolean().optional(),
      emphasis: z.enum(['primary', 'navigation', 'quiet']).optional(),
      symbol: z.enum(nativeSymbols).optional(),
      surface: z.enum(['panel', 'inset', 'reading']).optional(),
      maxLines: z.number().int().min(1).max(6).optional(),
      points: z
        .array(
          z
            .object({
              date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
              value: z.number().int().min(0).max(1_000_000_000_000)
            })
            .strict()
        )
        .max(90)
        .optional(),
      title: short.optional(),
      text: z.string().max(4_000_000).optional(),
      value: z.string().max(20_000).optional(),
      placeholder: short.optional(),
      action: short.optional(),
      activate: short.optional(),
      context: short.optional(),
      openWindow: short.optional(),
      checked: z.boolean().optional(),
      enabled: z.boolean().optional(),
      selected: short.optional(),
      rows: z
        .array(
          z
            .object({
              id: short,
              title: short,
              subtitle: short.optional(),
              symbol: z.enum(nativeSymbols).optional(),
              symbolLabel: z.string().min(1).max(40).optional(),
              saved: z.boolean().optional(),
              drag: z
                .object({ url: httpsUrl, title: z.string().max(4000), text: z.string().max(4000) })
                .strict()
                .optional(),
              cells: z.record(z.string().min(1).max(40), z.string().max(300)).optional()
            })
            .strict()
        )
        .max(10000)
        .optional(),
      columns: z
        .array(
          z
            .object({
              id: z.string().min(1).max(40),
              title: short,
              width: z.number().min(40).max(400),
              alignment: z.enum(['left', 'right']).optional()
            })
            .strict()
        )
        .min(1)
        .max(8)
        .optional(),
      options: z
        .array(z.object({ id: short, title: short, enabled: z.boolean().optional() }).strict())
        .max(100)
        .optional(),
      children: z.array(nodeSchema).max(200).optional(),
      width: positive.optional(),
      height: positive.optional(),
      minHeight: positive.optional(),
      flex: positive.optional(),
      gap: positive.optional(),
      padding: positive.optional(),
      size: z.number().min(8).max(48).optional(),
      weight: z.enum(['regular', 'bold', 'secondary', 'title']).optional(),
      textStyle: z
        .enum([
          'title1',
          'title2',
          'title3',
          'headline',
          'body',
          'callout',
          'subheadline',
          'footnote'
        ])
        .optional(),
      glass: z.boolean().optional(),
      adaptiveScroll: z.boolean().optional(),
      fitWindow: z.boolean().optional(),
      multiline: z.boolean().optional(),
      maxLength: z.number().int().min(1).max(20000).optional(),
      clearRevision: z.number().int().nonnegative().optional(),
      minWidth: positive.optional(),
      minContentWidth: positive.optional(),
      maxWidth: positive.optional(),
      collapseAt: positive.optional(),
      safeArea: z.boolean().optional(),
      completed: z.number().int().min(0).max(100000).optional(),
      total: z.number().int().min(1).max(100000).optional(),
      shortcut: z.enum(['return', 'command-return']).optional(),
      align: z.literal('center').optional(),
      windowSidebar: z.boolean().optional(),
      share: z.object({ url: httpsUrl }).strict().optional()
    })
    .strict()
    .superRefine((node, context) => {
      if (node.columns) {
        const ids = new Set(node.columns.map((column) => column.id))
        if (
          node.kind !== 'table' ||
          ids.size !== node.columns.length ||
          node.rows?.some(
            (row) =>
              !row.cells ||
              Object.keys(row.cells).length !== ids.size ||
              [...ids].some((id) => !(id in row.cells!))
          )
        )
          context.addIssue({
            code: 'custom',
            message: 'Native table cells must match the unique declared columns'
          })
      }
      if (
        (node.completed !== undefined || node.total !== undefined) &&
        (node.kind !== 'progress' ||
          node.completed === undefined ||
          node.total === undefined ||
          node.completed > node.total)
      )
        context.addIssue({
          code: 'custom',
          message: 'Native progress needs completed <= total on a progress node'
        })
      if (node.options !== undefined && node.kind !== 'select' && node.kind !== 'segmented')
        context.addIssue({ code: 'custom', message: 'Only native choice controls carry options' })
      if (
        node.kind === 'segmented' &&
        (!node.options ||
          node.options.length < 2 ||
          node.options.length > 6 ||
          !node.options.some((option) => option.id === node.selected))
      )
        context.addIssue({
          code: 'custom',
          message: 'Native segmented controls need 2-6 options including the selected one'
        })
      if (node.size !== undefined && node.kind !== 'text' && node.kind !== 'symbol')
        context.addIssue({
          code: 'custom',
          message: 'Point sizes are for reading text and symbols; other nodes use a text style'
        })
      if (node.share !== undefined && node.kind !== 'button')
        context.addIssue({ code: 'custom', message: 'Only native buttons share a link' })
      if (node.fitWindow !== undefined && node.kind !== 'scroll')
        context.addIssue({ code: 'custom', message: 'Only a scroll node fits its window' })
      if (node.windowSidebar !== undefined && node.kind !== 'split')
        context.addIssue({ code: 'custom', message: 'Only a split hosts the window sidebar' })
      if (node.align !== undefined && node.kind !== 'column' && node.kind !== 'label')
        context.addIssue({ code: 'custom', message: 'Only columns and labels are centered' })
      if (node.kind === 'symbol' && (!node.symbol || (node.size !== undefined && node.size < 16)))
        context.addIssue({
          code: 'custom',
          message: 'Native symbols need an allowlisted symbol and a 16-48 pt size'
        })
      if (node.shortcut !== undefined && node.kind !== 'button')
        context.addIssue({ code: 'custom', message: 'Only native buttons carry a shortcut' })
      if (node.kind === 'secure' && (node.value !== undefined || node.text !== undefined))
        context.addIssue({
          code: 'custom',
          message: 'Secure controls never receive a plaintext value'
        })
    })
)

const toolbarSchema: z.ZodType<NativeToolbar> = z
  .object({
    title: z.string().min(1).max(200),
    items: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            title: z.string().min(1).max(200),
            symbol: z.enum(nativeSymbols),
            help: short.optional(),
            enabled: z.boolean().optional(),
            action: short.optional(),
            placement: z.literal('sidebar').optional(),
            kind: z.literal('search').optional(),
            placeholder: z.string().max(200).optional(),
            value: z.string().max(200).optional(),
            activate: short.optional()
          })
          .strict()
      )
      .max(8)
      .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
        message: 'Toolbar item identities must be unique'
      }),
    style: z.literal('preference').optional(),
    selected: z.string().min(1).max(100).optional()
  })
  .strict()
  .refine(
    (toolbar) =>
      toolbar.selected === undefined ||
      (toolbar.style === 'preference' &&
        toolbar.items.some((item) => item.id === toolbar.selected && item.kind !== 'search')),
    { message: 'A selected toolbar item must be a pane of a preference toolbar' }
  )
  .refine(
    (toolbar) =>
      toolbar.style !== 'preference' ||
      toolbar.items.every((item) => item.kind === undefined && item.placement === undefined),
    { message: 'A preference toolbar contains only selectable panes' }
  )

type Value = string | boolean | number | undefined
type Rule =
  | { readonly type: 'none' }
  | { readonly type: 'text' | 'secret'; readonly max: number }
  | { readonly type: 'choice'; readonly values: readonly string[] }
  | { readonly type: 'boolean' }
  | { readonly type: 'number'; readonly min: number; readonly max: number }
interface Binding {
  readonly id: string
  readonly receive: (value: Value) => void | Promise<void>
  readonly rule: Rule
}
const eventSchema = z
  .object({
    action: z.string().min(1).max(100),
    value: z.union([z.string().max(20000), z.boolean(), z.number().finite()]).optional()
  })
  .strict()

/** Callbacks are scoped to live control semantics, never remote metadata or selectors. */
export interface NativeAnnouncement {
  readonly id: number
  readonly message: string
}

export class NativePresentation {
  private active = new Map<string, Binding>()
  private next = new Map<string, Binding>()
  private nextId = 0
  private revision = 0
  private closed = false
  private readonly secureResets = new Set<string>()

  clearSecure(id: string): void {
    this.secureResets.add(z.string().min(1).max(300).parse(id))
  }

  begin(): void {
    this.next = new Map()
  }

  action(
    key: string,
    receive: (value: Value) => void | Promise<void>,
    rule: Rule = { type: 'none' }
  ): string {
    const id = this.next.get(key)?.id ?? this.active.get(key)?.id ?? `a${++this.nextId}`
    this.next.set(key, { id, receive, rule })
    return id
  }

  finish(
    root: NativeNode,
    modal?: NativeNode,
    focus?: string,
    zoom = 1,
    announcement?: NativeAnnouncement,
    toolbar?: NativeToolbar,
    popover?: NativePopover
  ): string {
    const ids = new Set<string>()
    const check = (node: NativeNode, depth: number) => {
      if (depth > 24 || ids.size > 2000 || ids.has(node.id))
        throw new Error('Invalid native tree identity or depth')
      ids.add(node.id)
      node.children?.forEach((child) => check(child, depth + 1))
    }
    check(root, 0)
    if (modal) check(modal, 0)
    if (popover) {
      // A sheet is window-modal, so a popover cannot share the scene with it.
      if (modal || !ids.has(popover.anchor)) throw new Error('Invalid native popover anchor')
      check(popover.root, 0)
    }
    const validated = {
      version: 1,
      revision: ++this.revision,
      root: nodeSchema.parse(root),
      ...(modal ? { modal: nodeSchema.parse(modal) } : {}),
      ...(toolbar ? { toolbar: toolbarSchema.parse(toolbar) } : {}),
      ...(popover
        ? {
            popover: {
              anchor: z.string().min(1).max(300).parse(popover.anchor),
              close: z.string().min(1).max(100).parse(popover.close),
              root: nodeSchema.parse(popover.root)
            }
          }
        : {}),
      ...(focus ? { focus } : {}),
      zoom: z.number().min(0.8).max(1.5).parse(zoom),
      ...(announcement
        ? {
            announcement: z
              .object({ id: z.number().int().positive(), message: z.string().min(1).max(2000) })
              .strict()
              .parse(announcement)
          }
        : {}),
      clearSecure: [...this.secureResets]
    }
    const json = JSON.stringify(validated)
    if (Buffer.byteLength(json, 'utf8') > 12_000_000)
      throw new Error('Native scene exceeds its explicit size budget')
    const liveActions = new Set<string>()
    const visit = (node: NativeNode) => {
      for (const action of [node.action, node.activate, node.context, node.openWindow])
        if (action) liveActions.add(action)
      node.children?.forEach(visit)
    }
    visit(modal ?? root)
    if (popover) {
      visit(popover.root)
      liveActions.add(popover.close)
    }
    // A sheet is window-modal: toolbar commands stay inert until it closes.
    if (!modal)
      toolbar?.items.forEach((item) => {
        if (item.action) liveActions.add(item.action)
        if (item.activate) liveActions.add(item.activate)
      })
    this.active = new Map([...this.next].filter(([, binding]) => liveActions.has(binding.id)))
    this.secureResets.clear()
    return json
  }

  dispatch(json: string): Promise<void> {
    return this.receive(json, false)
  }
  dispatchSecret(json: string): Promise<void> {
    return this.receive(json, true)
  }
  dispose(): void {
    this.closed = true
    this.active.clear()
    this.next.clear()
  }

  private async receive(json: string, secret: boolean): Promise<void> {
    if (this.closed || json.length > 100000) return
    let event: z.infer<typeof eventSchema>
    try {
      event = eventSchema.parse(JSON.parse(json))
    } catch {
      return
    }
    const binding = [...this.active.values()].find((item) => item.id === event.action)
    if (!binding || (binding.rule.type === 'secret') !== secret) return
    const { rule } = binding
    const value = event.value
    if (rule.type === 'none' && value !== undefined) return
    if (
      (rule.type === 'text' || rule.type === 'secret') &&
      (typeof value !== 'string' || value.length > rule.max)
    )
      return
    if (rule.type === 'choice' && (typeof value !== 'string' || !rule.values.includes(value)))
      return
    if (rule.type === 'boolean' && typeof value !== 'boolean') return
    if (
      rule.type === 'number' &&
      (typeof value !== 'number' || value < rule.min || value > rule.max)
    )
      return
    await binding.receive(value)
  }
}

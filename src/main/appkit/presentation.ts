import { z } from 'zod'

export interface NativeRow {
  readonly id: string
  readonly title: string
  readonly subtitle?: string | undefined
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
export interface NativeNode {
  readonly id: string
  readonly kind: NativeKind
  readonly title?: string | undefined
  readonly text?: string | undefined
  readonly value?: string | undefined
  readonly placeholder?: string | undefined
  readonly action?: string | undefined
  readonly activate?: string | undefined
  readonly context?: string | undefined
  readonly checked?: boolean | undefined
  readonly enabled?: boolean | undefined
  readonly selected?: string | undefined
  readonly rows?: readonly NativeRow[] | undefined
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
  readonly glass?: boolean | undefined
  readonly adaptiveScroll?: boolean | undefined
  readonly multiline?: boolean | undefined
  readonly maxLength?: number | undefined
  readonly clearRevision?: number | undefined
  readonly minWidth?: number | undefined
  readonly minContentWidth?: number | undefined
  readonly maxWidth?: number | undefined
  readonly collapseAt?: number | undefined
}

const short = z.string().max(4096)
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
        'table'
      ]),
      title: short.optional(),
      text: z.string().max(4_000_000).optional(),
      value: z.string().max(20_000).optional(),
      placeholder: short.optional(),
      action: short.optional(),
      activate: short.optional(),
      context: short.optional(),
      checked: z.boolean().optional(),
      enabled: z.boolean().optional(),
      selected: short.optional(),
      rows: z
        .array(z.object({ id: short, title: short, subtitle: short.optional() }).strict())
        .max(10000)
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
      glass: z.boolean().optional(),
      adaptiveScroll: z.boolean().optional(),
      multiline: z.boolean().optional(),
      maxLength: z.number().int().min(1).max(20000).optional(),
      clearRevision: z.number().int().nonnegative().optional(),
      minWidth: positive.optional(),
      minContentWidth: positive.optional(),
      maxWidth: positive.optional(),
      collapseAt: positive.optional()
    })
    .strict()
    .superRefine((node, context) => {
      if (node.kind === 'secure' && (node.value !== undefined || node.text !== undefined))
        context.addIssue({
          code: 'custom',
          message: 'Secure controls never receive a plaintext value'
        })
    })
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

  finish(root: NativeNode, modal?: NativeNode, focus?: string, zoom = 1): string {
    const ids = new Set<string>()
    const check = (node: NativeNode, depth: number) => {
      if (depth > 24 || ids.size > 2000 || ids.has(node.id))
        throw new Error('Invalid native tree identity or depth')
      ids.add(node.id)
      node.children?.forEach((child) => check(child, depth + 1))
    }
    check(root, 0)
    if (modal) check(modal, 0)
    const validated = {
      version: 1,
      revision: ++this.revision,
      root: nodeSchema.parse(root),
      ...(modal ? { modal: nodeSchema.parse(modal) } : {}),
      ...(focus ? { focus } : {}),
      zoom: z.number().min(0.8).max(1.5).parse(zoom),
      clearSecure: [...this.secureResets]
    }
    const json = JSON.stringify(validated)
    if (Buffer.byteLength(json, 'utf8') > 12_000_000)
      throw new Error('Native scene exceeds its explicit size budget')
    const liveActions = new Set<string>()
    const visit = (node: NativeNode) => {
      for (const action of [node.action, node.activate, node.context])
        if (action) liveActions.add(action)
      node.children?.forEach(visit)
    }
    visit(modal ?? root)
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

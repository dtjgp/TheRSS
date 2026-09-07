import { createHash } from 'node:crypto'
import type { DashboardSnapshot, TheRSSApi } from '../../shared/api'
import type {
  LocalAgentStatus,
  ModelProviderSummary,
  AnalysisRunner,
  AnalysisArtifact
} from '../../shared/models'
import type { NativeNode, NativeOption, NativePresentation, NativeRow } from './presentation'
import type { LocalResearchTarget } from '../../shared/localResearch'

export type Route = 'discover' | 'saved' | 'analytics' | 'sources' | 'settings'
export const recordViewId = (prefix: string, id: string): string =>
  `${prefix}:${createHash('sha256').update(id).digest('hex').slice(0, 16)}`
export interface NativeData {
  dashboard: DashboardSnapshot | null
  provider: ModelProviderSummary | null
  agents: readonly LocalAgentStatus[]
  personalPrompt: string
}
export interface NativeContext {
  readonly api: TheRSSApi
  readonly presentation: NativePresentation
  readonly data: NativeData
  redraw(): void
  focus(id: string): void
  notify(message: string, kind?: 'success' | 'error'): void
  navigate(route: Route): Promise<void>
  compact(): boolean
  openLocal(target: LocalResearchTarget, isCurrent: () => boolean): Promise<string | null>
  openExternal(url: string): void
  showDocument(title: string, content: string): void
  promote(itemId: string, sessionId?: string): Promise<void>
  width(key: 'sidebar' | 'discover' | 'saved'): number
  setWidth(key: 'sidebar' | 'discover' | 'saved', width: number): void
}
export interface NativeScreen {
  render(): NativeNode
  load?(): Promise<void>
  dispose?(): void
}

export const column = (
  id: string,
  children: readonly NativeNode[],
  extra: Partial<NativeNode> = {}
): NativeNode => ({ id, kind: 'column', gap: 10, children, ...extra })
export const row = (
  id: string,
  children: readonly NativeNode[],
  extra: Partial<NativeNode> = {}
): NativeNode => ({ id, kind: 'row', gap: 8, children, ...extra })
export const label = (id: string, text: string, extra: Partial<NativeNode> = {}): NativeNode => ({
  id,
  kind: 'label',
  text,
  ...extra
})
export const text = (id: string, content: string, extra: Partial<NativeNode> = {}): NativeNode => ({
  id,
  kind: 'text',
  text: content,
  ...extra
})
export const scroll = (
  id: string,
  content: NativeNode,
  extra: Partial<NativeNode> = {}
): NativeNode => ({ id, kind: 'scroll', flex: 1, children: [content], ...extra })
export const heading = (id: string, title: string): NativeNode =>
  label(id, title, { weight: 'title' })

export class Controls {
  constructor(private readonly context: NativeContext) {}
  button(
    id: string,
    title: string,
    receive: () => void | Promise<void>,
    enabled = true,
    key = id
  ): NativeNode {
    return {
      id,
      kind: 'button',
      title,
      enabled,
      action: this.context.presentation.action(key, enabled ? receive : () => undefined)
    }
  }
  input(
    id: string,
    title: string,
    value: string,
    receive: (value: string) => void,
    maxLength: number,
    extra: Partial<NativeNode> = {}
  ): NativeNode {
    return {
      id,
      kind: 'input',
      title,
      value,
      maxLength,
      action: this.context.presentation.action(
        id,
        (value) => {
          if (extra.enabled !== false) receive(value as string)
        },
        {
          type: 'text',
          max: maxLength
        }
      ),
      ...extra
    }
  }
  select(
    id: string,
    title: string,
    selected: string,
    options: readonly NativeOption[],
    receive: (value: string) => void,
    extra: Partial<NativeNode> = {}
  ): NativeNode {
    return {
      id,
      kind: 'select',
      title,
      selected,
      options,
      action: this.context.presentation.action(
        id,
        (value) => {
          if (extra.enabled !== false) receive(value as string)
        },
        {
          type: 'choice',
          values: options.filter((option) => option.enabled !== false).map((option) => option.id)
        }
      ),
      ...extra
    }
  }
  check(
    id: string,
    title: string,
    checked: boolean,
    receive: (value: boolean) => void,
    enabled = true
  ): NativeNode {
    return {
      id,
      kind: 'check',
      title,
      checked,
      enabled,
      action: this.context.presentation.action(
        id,
        (value) => {
          if (enabled) receive(value as boolean)
        },
        { type: 'boolean' }
      )
    }
  }
  table(
    id: string,
    title: string,
    rows: readonly NativeRow[],
    selected: string,
    receive: (id: string) => void | Promise<void>,
    options: {
      activate?: (id: string) => void | Promise<void>
      context?: (id: string) => void | Promise<void>
    } = {}
  ): NativeNode {
    const rule = { type: 'choice' as const, values: rows.map((item) => item.id) }
    return {
      id,
      kind: 'table',
      title,
      rows,
      selected,
      flex: 1,
      action: this.context.presentation.action(id, (value) => receive(value as string), rule),
      ...(options.activate
        ? {
            activate: this.context.presentation.action(
              `${id}:activate`,
              (value) => options.activate!(value as string),
              rule
            )
          }
        : {}),
      ...(options.context
        ? {
            context: this.context.presentation.action(
              `${id}:context`,
              (value) => options.context!(value as string),
              rule
            )
          }
        : {})
    }
  }
  split(id: string, key: 'saved' | 'discover', children: readonly NativeNode[]): NativeNode {
    return {
      id,
      kind: 'split',
      title: 'Resize list and reading panes',
      flex: 1,
      width: this.context.width(key),
      minWidth: 260,
      maxWidth: 520,
      collapseAt: 700,
      children,
      action: this.context.presentation.action(
        `width:${key}`,
        (value) => this.context.setWidth(key, value as number),
        { type: 'number', min: 260, max: 520 }
      )
    }
  }
  runner(
    id: string,
    selected: AnalysisRunner,
    receive: (value: AnalysisRunner) => void,
    busy = false
  ): NativeNode {
    const agents = this.context.data.agents
    return this.select(
      id,
      'Analysis runner',
      selected,
      [
        {
          id: 'model-provider',
          title: this.context.data.provider?.name ?? 'Model provider',
          enabled: this.context.data.provider !== null
        },
        {
          id: 'codex',
          title: 'Codex CLI',
          enabled: agents.some((agent) => agent.runner === 'codex' && agent.available)
        },
        {
          id: 'claude',
          title: 'Claude Code',
          enabled: agents.some((agent) => agent.runner === 'claude' && agent.available)
        }
      ],
      (value) => receive(value as AnalysisRunner),
      { width: 190, enabled: !busy }
    )
  }
  rich(id: string, content: string): NativeNode {
    return text(id, content, {
      activate: this.context.presentation.action(
        `${id}:link`,
        (url) => this.context.openExternal(url as string),
        { type: 'text', max: 2000 }
      )
    })
  }
}

export function runnerAvailable(context: NativeContext, runner: AnalysisRunner): boolean {
  return runner === 'model-provider'
    ? context.data.provider !== null
    : context.data.agents.some((agent) => agent.runner === runner && agent.available)
}
export function runnerUnavailableReason(context: NativeContext, runner: AnalysisRunner): string {
  if (runnerAvailable(context, runner)) return ''
  return runner === 'model-provider'
    ? 'Model provider is not configured. Choose an available runner or open Settings.'
    : `${runner === 'codex' ? 'Codex CLI' : 'Claude Code'} is not available. Choose another runner or check Settings.`
}
export function analysisText(artifact: AnalysisArtifact): string {
  return `${artifact.content}\n\n## Analysis provenance\nArtifact: ${artifact.id}\nProvider: ${artifact.providerName}\nModel: ${artifact.model}\nPrompt: ${artifact.promptVersion}\nSource hash: ${artifact.sourceHash}\nCreated: ${artifact.createdAt}\n\nDiscovery metadata analysis; verify the full paper before citing results.`
}
export function readableError(
  error: unknown,
  fallback = 'The operation could not be completed.'
): string {
  if (!(error instanceof Error)) return fallback
  return (
    error.message
      .replace(/\b(?:hf|ghp|github_pat)_[A-Za-z0-9_-]+\b/gu, '[redacted credential]')
      .replace(/\/(?:Users|home)\/[^\s:]+/gu, '[local path]')
      .replace(/\s+/gu, ' ')
      .slice(0, 500) || fallback
  )
}

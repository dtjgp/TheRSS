import { DISCOVER_SOURCE_IDS, type DiscoverSnapshot } from '../../shared/discover'
import { vi } from 'vitest'
import type { TheRSSApi, DashboardSnapshot } from '../../shared/api'
import type { NativeContext } from './common'
import { NativePresentation, type NativeNode } from './presentation'

export function nativeHarness(overrides: Partial<TheRSSApi> = {}) {
  const dashboard: DashboardSnapshot = {
    date: '2026-09-06',
    profileName: null,
    lastRefreshAt: null,
    sourceHealth: { arxiv: 'idle', github: 'idle' },
    sourceHealthDetails: {
      arxiv: { status: 'idle', observedAt: null, errorMessage: null },
      github: { status: 'idle', observedAt: null, errorMessage: null }
    },
    counts: { total: 0, arxiv: 0, github: 0, unread: 0 },
    items: [],
    savedItems: []
  }
  const api = {
    getDashboard: vi.fn(async () => dashboard),
    setSettingsDirty: vi.fn(),
    getLatestAnalysis: vi.fn(async () => null),
    getLatestDiscover: vi.fn(async () => null),
    getModelProvider: vi.fn(async () => null),
    getDiscoverPersonalizationSettings: vi.fn(async () => null),
    onDiscoverProgress: vi.fn(() => () => undefined),
    onAppCommand: vi.fn(() => () => undefined),
    ...overrides
  } as unknown as TheRSSApi
  const context: NativeContext = {
    api,
    presentation: new NativePresentation(),
    data: {
      dashboard,
      provider: null,
      personalPrompt: '',
      agents: [{ runner: 'codex', label: 'Codex CLI', available: true }]
    },
    redraw: vi.fn(),
    focus: vi.fn(),
    notify: vi.fn(),
    openExternal: vi.fn(),
    showDocument: vi.fn(),
    promote: vi.fn(async () => undefined),
    width: () => 320,
    setWidth: vi.fn()
  }
  const render = (screen: { render(): NativeNode }) => {
    context.presentation.begin()
    const root = screen.render()
    context.presentation.finish(root)
    return root
  }
  const find = (node: NativeNode, id: string): NativeNode | undefined =>
    node.id === id ? node : node.children?.map((child) => find(child, id)).find(Boolean)
  const act = async (
    screen: { render(): NativeNode },
    id: string,
    value?: string | boolean | number,
    secret = false
  ) => {
    const node = find(render(screen), id)
    if (!node?.action) throw new Error(`Missing native action ${id}`)
    const json = JSON.stringify({ action: node.action, ...(value !== undefined ? { value } : {}) })
    await (secret ? context.presentation.dispatchSecret(json) : context.presentation.dispatch(json))
  }
  return { api, context, render, find, act, dashboard }
}

export const nativeDiscoverFixture: DiscoverSnapshot = {
  id: 'session-1',
  intent: 'edge intelligence',
  runner: 'codex',
  status: 'partial',
  createdAt: '2026-09-06',
  plan: {
    version: 'discover-plan-v1',
    intentSummary: 'Edge search',
    arxiv: { categories: ['cs.LG'], keywords: ['pruning'], excludeKeywords: [] },
    github: { keywords: ['compression'], topics: [], languages: ['Python'] },
    rationale: 'Bounded fixture'
  },
  provenance: {
    providerId: 'local:codex',
    providerName: 'Codex CLI',
    model: 'codex',
    promptVersion: 'semantic-discover-v2',
    personalizationApplied: false,
    inputHash: 'hash',
    createdAt: 'now'
  },
  sourceOutcomes: Object.fromEntries(
    DISCOVER_SOURCE_IDS.map((source) => [
      source,
      {
        status: source === 'arxiv' ? 'failed' : 'healthy',
        resultCount: 1,
        error: source === 'arxiv' ? 'Fixture failure' : null
      }
    ])
  ) as DiscoverSnapshot['sourceOutcomes'],
  counts: {
    total: 30,
    arxiv: 30,
    github: 0,
    byKind: { paper: 30, repository: 0, article: 0, model: 0, dataset: 0, post: 0 },
    bySource: {} as DiscoverSnapshot['counts']['bySource']
  },
  items: Array.from({ length: 30 }, (_, index) => ({
    id: `arxiv:${index}`,
    source: 'arxiv',
    kind: 'paper',
    externalId: String(index),
    title: `Paper ${index}`,
    summary: 'Research summary',
    url: 'https://arxiv.org/abs/1',
    publishedAt: '2026-09-06',
    updatedAt: '2026-09-06',
    authors: ['Fixture'],
    categories: ['cs.LG'],
    topics: [],
    language: null,
    stars: null,
    metrics: {},
    score: 10,
    reasons: ['Relevant'],
    saved: false
  }))
}

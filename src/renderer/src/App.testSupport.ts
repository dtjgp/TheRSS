import { vi } from 'vitest'
import type { DashboardSnapshot, TheRSSApi } from '../../shared/api'
import type { DiscoverSnapshot, DiscoverSource, DiscoverSourceOutcome } from '../../shared/discover'
import { ACTIVE_TODAY_SOURCE_IDS } from '../../shared/sourceIdentity'

export const emptyDashboard: DashboardSnapshot = {
  date: '2026-08-19',
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

function sourceOutcomes(
  overrides: Partial<Record<DiscoverSource, DiscoverSourceOutcome>> = {}
): DiscoverSnapshot['sourceOutcomes'] {
  return Object.fromEntries(
    ACTIVE_TODAY_SOURCE_IDS.map((source) => [
      source,
      overrides[source] ?? { status: 'no_results', resultCount: 0, error: null }
    ])
  ) as DiscoverSnapshot['sourceOutcomes']
}

function sourceCounts(
  overrides: Partial<Record<DiscoverSource, number>> = {}
): DiscoverSnapshot['counts']['bySource'] {
  return Object.fromEntries(
    ACTIVE_TODAY_SOURCE_IDS.map((source) => [source, overrides[source] ?? 0])
  ) as DiscoverSnapshot['counts']['bySource']
}

export function createDiscoverSnapshot(): DiscoverSnapshot {
  return {
    id: 'discover-session-1',
    intent: 'semantic communication pruning for edge deployment',
    runner: 'codex',
    status: 'partial',
    createdAt: '2026-08-19T12:00:00.000Z',
    plan: {
      version: 'discover-plan-v1',
      intentSummary: 'Find pruning-aware edge intelligence across the full source desk.',
      arxiv: {
        categories: ['cs.LG', 'eess.SP'],
        keywords: ['semantic communication', 'structured pruning'],
        excludeKeywords: []
      },
      github: {
        keywords: ['model compression'],
        topics: ['model-compression'],
        languages: ['Python']
      },
      rationale: 'Combine targeted search with bounded recent-source filtering.'
    },
    provenance: {
      providerId: 'local-agent:codex',
      providerName: 'Codex CLI',
      model: 'codex-cli',
      promptVersion: 'semantic-discover-v1',
      personalizationApplied: false,
      inputHash: 'a'.repeat(64),
      createdAt: '2026-08-19T12:00:00.000Z'
    },
    sourceOutcomes: sourceOutcomes({
      arxiv: { status: 'healthy', resultCount: 1, error: null },
      github: { status: 'healthy', resultCount: 1, error: null },
      'folo:302': {
        status: 'partial',
        resultCount: 1,
        error: 'One malformed feed record was rejected.'
      }
    }),
    counts: {
      total: 3,
      arxiv: 1,
      github: 1,
      byKind: { paper: 1, repository: 1, article: 1, model: 0, dataset: 0, post: 0 },
      bySource: sourceCounts({ arxiv: 1, github: 1, 'folo:302': 1 })
    },
    items: [
      {
        id: 'arxiv:discover',
        source: 'arxiv',
        kind: 'paper',
        externalId: 'discover',
        title: 'Structured pruning for semantic communication',
        summary: 'A semantic communication paper.',
        url: 'https://arxiv.org/abs/discover',
        publishedAt: '2026-08-18T00:00:00.000Z',
        updatedAt: '2026-08-18T00:00:00.000Z',
        authors: ['A. Researcher'],
        categories: ['cs.LG'],
        topics: [],
        language: null,
        stars: null,
        metrics: {},
        score: 61,
        reasons: ['Title matches structured pruning'],
        saved: false
      },
      {
        id: 'github:discover/repo',
        source: 'github',
        kind: 'repository',
        externalId: 'discover/repo',
        title: 'discover/repo',
        summary: 'A repository for semantic communication experiments.',
        url: 'https://github.com/discover/repo',
        publishedAt: '2026-08-18T00:00:00.000Z',
        updatedAt: '2026-08-19T00:00:00.000Z',
        authors: [],
        categories: [],
        topics: ['model-compression'],
        language: 'Python',
        stars: 42,
        metrics: {},
        score: 48,
        reasons: ['GitHub topic model-compression'],
        saved: false
      },
      {
        id: 'folo:302:discover-article',
        source: 'folo:302',
        kind: 'article',
        externalId: 'discover-article',
        title: 'BAAI edge intelligence briefing',
        summary: 'A configured-source article selected from the bounded recent window.',
        url: 'https://www.baai.ac.cn/briefing',
        publishedAt: '2026-08-18T00:00:00.000Z',
        updatedAt: '2026-08-18T00:00:00.000Z',
        authors: ['BAAI'],
        categories: [],
        topics: [],
        language: null,
        stars: null,
        metrics: {},
        score: 39,
        reasons: ['Recent-window content matches edge intelligence'],
        saved: false
      }
    ]
  }
}

export function createApi(snapshot: DashboardSnapshot = emptyDashboard): TheRSSApi {
  return {
    onAppCommand: vi.fn().mockReturnValue(() => undefined),
    getDashboard: vi.fn().mockResolvedValue(snapshot),
    getSourceContent: vi.fn(),
    refreshSourceContent: vi.fn(),
    getInterestProfile: vi.fn().mockResolvedValue(null),
    saveInterestProfile: vi.fn().mockResolvedValue(snapshot),
    refresh: vi.fn().mockResolvedValue(snapshot),
    searchDiscover: vi.fn().mockResolvedValue(createDiscoverSnapshot()),
    getLatestDiscover: vi.fn().mockResolvedValue(null),
    getAnalytics: vi.fn().mockResolvedValue({
      generatedAt: '2026-08-19T12:00:00.000Z',
      windowDays: 7,
      trackingStartedAt: null,
      totals: {
        searchResults: 0,
        todayResults: 0,
        discoverResults: 0,
        deepAnalyses: 0,
        analyzedPapers: 0
      },
      daily: [],
      analyzedItems: []
    }),
    saveDiscoverResult: vi.fn().mockResolvedValue(snapshot),
    setTriageState: vi.fn().mockResolvedValue(snapshot),
    getModelProvider: vi.fn().mockResolvedValue(null),
    saveModelProvider: vi.fn().mockResolvedValue({
      id: 'default',
      name: 'Local fixture',
      protocol: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: 'fixture-model',
      hasCredential: true,
      updatedAt: '2026-08-19T12:00:00.000Z'
    }),
    testModelProvider: vi.fn().mockResolvedValue({
      status: 'connected',
      message: 'Connection succeeded.',
      testedAt: '2026-08-19T12:00:00.000Z'
    }),
    clearModelProviderCredential: vi.fn().mockResolvedValue({
      id: 'default',
      name: 'Local fixture',
      protocol: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: 'fixture-model',
      hasCredential: false,
      updatedAt: '2026-08-19T12:00:00.000Z'
    }),
    setSettingsDirty: vi.fn(),
    confirmDiscardSettings: vi.fn().mockResolvedValue(true),
    getDiscoverPersonalizationSettings: vi.fn().mockResolvedValue({
      prompt: '',
      updatedAt: '2026-08-19T12:00:00.000Z'
    }),
    saveDiscoverPersonalizationPrompt: vi.fn().mockResolvedValue({
      prompt:
        'I focus on local-first edge intelligence research and reviewer-safe evidence boundaries.',
      updatedAt: '2026-08-20T08:00:00.000Z'
    }),
    getLocalAgentStatuses: vi.fn().mockResolvedValue([
      { runner: 'codex', label: 'Codex CLI', available: true },
      { runner: 'claude', label: 'Claude Code', available: true }
    ]),
    analyzeItem: vi.fn().mockResolvedValue({
      id: 'analysis-1',
      itemId: 'folo:302:saved',
      providerId: 'local-agent:codex',
      providerName: 'Codex CLI',
      model: 'codex-cli',
      promptVersion: 'discovery-analysis-v1',
      sourceHash: 'b'.repeat(64),
      content: 'Bounded fixture analysis.',
      createdAt: '2026-08-19T12:00:00.000Z'
    }),
    analyzeDiscoverResult: vi.fn().mockResolvedValue({
      id: 'analysis-discover-paper',
      itemId: 'arxiv:discover',
      providerId: 'local-agent:codex',
      providerName: 'Codex CLI',
      model: 'codex-cli',
      promptVersion: 'llm-wiki-paper-l1-v1',
      sourceHash: 'c'.repeat(64),
      content:
        '## 快速决策卡\nEvidence state: abstract-only / provisional\n\n## TL;DR\nA bounded L1 fixture.',
      createdAt: '2026-08-20T12:00:00.000Z'
    }),
    getLatestAnalysis: vi.fn().mockResolvedValue(null),
    previewLlmWikiPromotion: vi.fn(),
    confirmLlmWikiPromotion: vi.fn(),
    cancelLlmWikiPromotion: vi.fn(),
    getLatestLlmWikiPromotion: vi.fn().mockResolvedValue(null)
  }
}

export function resetAppTestEnvironment(): void {
  window.localStorage.clear()
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: 1024
  })
}

import type { InterestProfile } from '../core/interests/interestProfile'
import type { DiscoverPersonalizationSettings } from './personalization'
import type {
  AnalysisArtifact,
  AnalysisRunner,
  LocalAgentStatus,
  ModelProviderInput,
  ModelProviderSummary,
  ProviderConnectionResult
} from './models'
import type { DiscoverSearchRequest, DiscoverSnapshot } from './discover'
import type { AnalyticsSnapshot } from './analytics'
import type { AppCommand } from './ipc'
import type { SystemAccentName } from './appearance'
import type { ContextMenuOutcome, ContextMenuTarget } from './contextMenu'
import type { DiscoveryItemKind, DiscoverySource } from './discovery'
import type { LlmWikiPromotionPreview, LlmWikiPromotionReceipt } from './llmWikiPromotion'

export type SourceHealth = 'idle' | 'refreshing' | 'healthy' | 'no_results' | 'partial' | 'failed'
export type TriageState = 'new' | 'viewed' | 'saved' | 'dismissed'

export interface SourceHealthDetail {
  readonly status: SourceHealth
  readonly observedAt: string | null
  readonly errorMessage: string | null
}

export interface DashboardItem {
  readonly id: string
  readonly source: DiscoverySource
  readonly kind?: DiscoveryItemKind
  readonly title: string
  readonly summary: string
  readonly url: string
  readonly publishedAt: string
  readonly score: number
  readonly triageState: TriageState
  readonly reasons: readonly string[]
}

export interface SourceContentItem extends DashboardItem {
  readonly updatedAt: string
}

export type SourceContentStatus = 'cached' | 'fetched' | 'partial' | 'no_results'

export interface SourceContentSnapshot {
  readonly source: DiscoverySource
  readonly status: SourceContentStatus
  readonly windowDays: 1 | 30
  readonly windowStart: string
  readonly windowEnd: string
  readonly lastIndexedAt: string | null
  readonly returnedCount: number
  readonly rejectedCount: number
  readonly items: readonly SourceContentItem[]
}

export interface DashboardSnapshot {
  readonly date: string
  readonly profileName: string | null
  readonly lastRefreshAt: string | null
  readonly sourceHealth: Readonly<
    Record<'arxiv' | 'github', SourceHealth> & Partial<Record<DiscoverySource, SourceHealth>>
  >
  readonly sourceHealthDetails: Readonly<
    Record<'arxiv' | 'github', SourceHealthDetail> &
      Partial<Record<DiscoverySource, SourceHealthDetail>>
  >
  readonly counts: {
    readonly total: number
    readonly arxiv: number
    readonly github: number
    readonly other?: number
    readonly bySource?: Readonly<Partial<Record<DiscoverySource, number>>>
    readonly unread: number
  }
  readonly items: readonly DashboardItem[]
  readonly savedItems: readonly DashboardItem[]
}

export interface TheRSSApi {
  onAppCommand(listener: (command: AppCommand) => void): () => void
  showContextMenu(target: ContextMenuTarget): Promise<ContextMenuOutcome>
  getSystemAccent(): Promise<SystemAccentName | null>
  onSystemAccentChange(listener: (accent: SystemAccentName | null) => void): () => void
  getDashboard(): Promise<DashboardSnapshot>
  getSourceContent(source: DiscoverySource): Promise<SourceContentSnapshot>
  refreshSourceContent(source: DiscoverySource): Promise<SourceContentSnapshot>
  getInterestProfile(): Promise<InterestProfile | null>
  saveInterestProfile(profile: InterestProfile): Promise<DashboardSnapshot>
  refresh(): Promise<DashboardSnapshot>
  searchDiscover(request: DiscoverSearchRequest): Promise<DiscoverSnapshot>
  getLatestDiscover(): Promise<DiscoverSnapshot | null>
  getAnalytics(): Promise<AnalyticsSnapshot>
  saveDiscoverResult(sessionId: string, itemId: string): Promise<DashboardSnapshot>
  setTriageState(id: string, state: TriageState): Promise<DashboardSnapshot>
  getModelProvider(): Promise<ModelProviderSummary | null>
  saveModelProvider(input: ModelProviderInput): Promise<ModelProviderSummary>
  testModelProvider(input: ModelProviderInput): Promise<ProviderConnectionResult>
  clearModelProviderCredential(): Promise<ModelProviderSummary>
  setSettingsDirty(isDirty: boolean): void
  confirmDiscardSettings(): Promise<boolean>
  getDiscoverPersonalizationSettings(): Promise<DiscoverPersonalizationSettings | null>
  saveDiscoverPersonalizationPrompt(prompt: string): Promise<DiscoverPersonalizationSettings>
  getLocalAgentStatuses(): Promise<readonly LocalAgentStatus[]>
  analyzeItem(id: string, runner: AnalysisRunner): Promise<AnalysisArtifact>
  analyzeDiscoverResult(
    sessionId: string,
    itemId: string,
    runner: AnalysisRunner
  ): Promise<AnalysisArtifact>
  getLatestAnalysis(id: string): Promise<AnalysisArtifact | null>
  previewLlmWikiPromotion(itemId: string, sessionId?: string): Promise<LlmWikiPromotionPreview>
  confirmLlmWikiPromotion(previewId: string): Promise<LlmWikiPromotionReceipt>
  cancelLlmWikiPromotion(previewId: string): Promise<LlmWikiPromotionReceipt>
  getLatestLlmWikiPromotion(itemId: string): Promise<LlmWikiPromotionReceipt | null>
}

import { z } from 'zod'
import { savedSourceUpdateRequestSchema } from '../shared/savedSourceUpdate'
import { interestProfileSchema } from '../core/interests/interestProfile'
import type { ResearchRepository } from '../core/storage/researchRepository'
import type { DiscoveryService } from '../core/discovery/discoveryService'
import type { DiscoverService } from '../core/discover/discoverService'
import type { ProviderService } from '../core/models/providerService'
import type { AnalysisService } from '../core/analysis/analysisService'
import type { LocalAgentService } from '../core/agents/localAgentService'
import type { LlmWikiPromotionService } from '../core/integrations/llmWikiPromotionService'
import type { TheRSSApi } from '../shared/api'
import type { SystemAccentName } from '../shared/appearance'
import type { AppCommand } from '../shared/ipc'
import {
  contextMenuTargetSchema,
  type ContextMenuOutcome,
  type ContextMenuTarget
} from '../shared/contextMenu'
import {
  discoverRunIdSchema,
  discoverSearchRequestSchema,
  discoverSourceSchema,
  type DiscoverRunProgress
} from '../shared/discover'
import type { DiscoverySource } from '../shared/discovery'
import { isDiscoverySource } from '../shared/sourceIdentity'
import { localSearchQuerySchema } from '../shared/localSearch'
import { localResearchTargetSchema } from '../shared/localResearch'
import { discoverPersonalizationPromptSchema } from '../shared/personalization'
import {
  llmWikiPromotionConfirmRequestSchema,
  llmWikiPromotionPreviewRequestSchema
} from '../shared/llmWikiPromotion'
import type { ProviderConnectionResult } from '../shared/models'

const itemId = z.string().trim().min(1).max(300)
const source = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(isDiscoverySource, 'Unknown or inactive source')
  .transform((value) => value as DiscoverySource)
const runner = z.enum(['model-provider', 'codex', 'claude']).default('model-provider')
const resultInput = z.object({ sessionId: itemId, itemId }).strict()
const triageInput = z.object({ id: itemId, state: z.enum(['new', 'viewed', 'saved', 'dismissed']) })

export interface ApplicationServices {
  readonly repository: ResearchRepository
  readonly discovery: DiscoveryService
  readonly discover: DiscoverService
  readonly provider: ProviderService
  readonly analysis: AnalysisService
  readonly agents: LocalAgentService
  readonly promotion: LlmWikiPromotionService
  readonly credentials?: () => { githubToken?: string; huggingFaceToken?: string }
  readonly testProvider: (
    profile: ReturnType<ProviderService['getConnectionTestProfile']>
  ) => Promise<ProviderConnectionResult>
}

export interface WindowContext {
  readonly ownerId: string
  isAvailable(): boolean
  setDirty(value: boolean): void
  confirmDiscard(): Promise<boolean>
  confirmPromotion(): Promise<boolean>
  contextMenu(target: ContextMenuTarget): Promise<ContextMenuOutcome>
  accent(): SystemAccentName | null
}

/** One validated service session per owning window, independent of the presentation engine. */
export class WindowApplication {
  readonly api: TheRSSApi
  private closed = false
  private dirty = false
  private readonly pending = new Set<Promise<unknown>>()
  private activeRun: { runId: string; controller: AbortController } | null = null
  private readonly progressListeners = new Set<(value: DiscoverRunProgress) => void>()
  private readonly commandListeners = new Set<(value: AppCommand) => void>()
  private readonly accentListeners = new Set<(value: SystemAccentName | null) => void>()

  constructor(
    private readonly services: ApplicationServices,
    private readonly context: WindowContext
  ) {
    const { repository, discovery, discover, provider, analysis, agents, promotion } = services
    const task = <T>(operation: () => T | Promise<T>): Promise<T> => this.task(operation)
    this.api = {
      onAppCommand: (listener) => this.subscribe(this.commandListeners, listener),
      onSystemAccentChange: (listener) => this.subscribe(this.accentListeners, listener),
      onDiscoverProgress: (listener) => this.subscribe(this.progressListeners, listener),
      showContextMenu: (candidate) =>
        task(() => context.contextMenu(contextMenuTargetSchema.parse(candidate))),
      getSystemAccent: () => task(() => context.accent()),
      getDashboard: () => task(() => repository.getDashboardSnapshot()),
      getSourceContent: (candidate) =>
        task(() => repository.getSourceContentSnapshot(source.parse(candidate))),
      refreshSourceContent: (candidate) =>
        task(() => discovery.refreshSourceContent(source.parse(candidate), this.credentials())),
      getInterestProfile: () => task(() => repository.getInterestProfile()),
      saveInterestProfile: (candidate) =>
        task(() => {
          repository.saveInterestProfile(interestProfileSchema.parse(candidate))
          return repository.getDashboardSnapshot()
        }),
      refresh: () => task(() => discovery.refresh(this.credentials())),
      searchLocal: (candidate) =>
        task(() => repository.searchLocal(localSearchQuerySchema.parse(candidate))),
      getLocalResearch: (candidate) =>
        task(async () => {
          const target = localResearchTargetSchema.parse(candidate)
          if (target.kind === 'saved') {
            const item = repository.getDiscoveryItem(target.itemId)
            return item?.triageState === 'saved' ? { kind: 'saved' as const, item } : null
          }
          if (target.kind === 'discover') {
            const snapshot = repository.getDiscoverSnapshot(target.sessionId)
            return snapshot?.items.some((item) => item.id === target.itemId)
              ? { kind: 'discover' as const, snapshot, itemId: target.itemId }
              : null
          }
          const state = await analysis.getAnalysisArtifact(target.analysisId)
          return state
            ? {
                kind: 'analysis' as const,
                state,
                item: repository.getDiscoveryItem(state.artifact.itemId)
              }
            : null
        }),
      searchDiscover: (candidate, id) =>
        task(() => {
          const request = discoverSearchRequestSchema.parse(candidate)
          const runId = discoverRunIdSchema.parse(id)
          return this.runDiscover(runId, (options) => discover.search(request, options))
        }),
      retryDiscover: (sessionId, sources, id) =>
        task(() => {
          const input = z
            .object({
              sessionId: itemId,
              sources: z.array(discoverSourceSchema).min(1).max(22),
              runId: discoverRunIdSchema
            })
            .strict()
            .parse({ sessionId, sources, runId: id })
          const previous = repository.getLatestDiscoverSnapshot()
          if (!previous || previous.id !== input.sessionId)
            throw new Error('Only the latest persisted Discover session can be retried')
          return this.runDiscover(input.runId, (options) =>
            discover.retry(previous, input.sources, options)
          )
        }),
      cancelDiscover: (candidate) =>
        task(() => {
          const runId = discoverRunIdSchema.parse(candidate)
          const canceled = this.activeRun?.runId === runId
          if (canceled) this.activeRun?.controller.abort()
          return { runId, canceled }
        }),
      getLatestDiscover: () => task(() => repository.getLatestDiscoverSnapshot()),
      getAnalytics: () => task(() => repository.getAnalyticsSnapshot()),
      saveDiscoverResult: (sessionId, id) =>
        task(() => {
          const validated = resultInput.parse({ sessionId, itemId: id })
          repository.saveDiscoverResult(validated.sessionId, validated.itemId)
          return repository.getDashboardSnapshot()
        }),
      setTriageState: (id, state) =>
        task(() => {
          const validated = triageInput.parse({ id, state })
          repository.setTriageState(validated.id, validated.state)
          return repository.getDashboardSnapshot()
        }),
      getSavedSourceUpdate: (id) => task(() => repository.getSavedSourceUpdate(itemId.parse(id))),
      applySavedSourceUpdate: (candidate) =>
        task(() => {
          const input = savedSourceUpdateRequestSchema.parse(candidate)
          const status = repository.applySavedSourceUpdate(input)
          return {
            status,
            item: repository.getDiscoveryItem(input.itemId),
            dashboard: repository.getDashboardSnapshot()
          }
        }),
      getModelProvider: () => task(() => provider.getSummary()),
      saveModelProvider: (candidate) => task(() => provider.save(candidate)),
      testModelProvider: (candidate) =>
        task(() => services.testProvider(provider.getConnectionTestProfile(candidate))),
      clearModelProviderCredential: () => task(() => provider.clearCredential()),
      setSettingsDirty: (candidate) => {
        if (this.closed || !context.isAvailable()) return
        const parsed = z.boolean().safeParse(candidate)
        if (!parsed.success) return
        this.dirty = parsed.data
        context.setDirty(this.dirty)
      },
      confirmDiscardSettings: () =>
        task(async () => {
          if (!this.dirty) return true
          const accepted = await context.confirmDiscard()
          if (accepted) {
            this.dirty = false
            context.setDirty(false)
          }
          return accepted
        }),
      getDiscoverPersonalizationSettings: () =>
        task(() => repository.getDiscoverPersonalizationSettings()),
      saveDiscoverPersonalizationPrompt: (candidate) =>
        task(() =>
          repository.saveDiscoverPersonalizationPrompt(
            discoverPersonalizationPromptSchema.parse(candidate)
          )
        ),
      getLocalAgentStatuses: () => task(() => agents.getStatuses()),
      analyzeItem: (id, candidate) =>
        task(() => analysis.analyzeItem(itemId.parse(id), { runner: runner.parse(candidate) })),
      analyzeDiscoverResult: (sessionId, id, candidate) =>
        task(() => {
          const input = resultInput
            .extend({ runner })
            .parse({ sessionId, itemId: id, runner: candidate })
          repository.materializeDiscoverResultForAnalysis(input.sessionId, input.itemId)
          return analysis.analyzeItem(input.itemId, { runner: input.runner })
        }),
      getLatestAnalysis: (id) => task(() => repository.getLatestAnalysis(itemId.parse(id))),
      getAnalysisArtifact: (id) => task(() => analysis.getAnalysisArtifact(itemId.parse(id))),
      previewLlmWikiPromotion: (id, sessionId) =>
        task(() => {
          const input = llmWikiPromotionPreviewRequestSchema.parse({ itemId: id, sessionId })
          if (input.sessionId)
            repository.materializeDiscoverResultForLlmWikiPromotion(input.sessionId, input.itemId)
          return promotion.preview(input.itemId, context.ownerId)
        }),
      confirmLlmWikiPromotion: (id) =>
        task(async () => {
          const { previewId } = llmWikiPromotionConfirmRequestSchema.parse({ previewId: id })
          if (!(await context.confirmPromotion()) || !context.isAvailable())
            return promotion.cancel(previewId, context.ownerId)
          return promotion.confirm(previewId, context.ownerId)
        }),
      cancelLlmWikiPromotion: (id) =>
        task(() =>
          promotion.cancel(
            llmWikiPromotionConfirmRequestSchema.parse({ previewId: id }).previewId,
            context.ownerId
          )
        ),
      getLatestLlmWikiPromotion: (id) => task(() => promotion.getLatest(itemId.parse(id)))
    }
  }

  command(command: AppCommand): void {
    if (!this.closed) this.commandListeners.forEach((listener) => listener(command))
  }
  accentChanged(accent: SystemAccentName | null): void {
    if (!this.closed) this.accentListeners.forEach((listener) => listener(accent))
  }

  async shutdown(): Promise<void> {
    this.closed = true
    this.activeRun?.controller.abort()
    this.progressListeners.clear()
    this.commandListeners.clear()
    this.accentListeners.clear()
    await Promise.allSettled([...this.pending])
    await this.services.promotion.disposeOwner(this.context.ownerId)
  }

  private subscribe<T>(
    listeners: Set<(value: T) => void>,
    listener: (value: T) => void
  ): () => void {
    if (!this.closed) listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  private credentials() {
    return this.services.credentials?.() ?? {}
  }

  private task<T>(operation: () => T | Promise<T>): Promise<T> {
    if (this.closed || !this.context.isAvailable())
      return Promise.reject(new Error('Application window is closed'))
    let promise: Promise<T>
    try {
      promise = Promise.resolve(operation())
    } catch (error) {
      return Promise.reject(error)
    }
    this.pending.add(promise)
    void promise.then(
      () => this.pending.delete(promise),
      () => this.pending.delete(promise)
    )
    return promise
  }

  private async runDiscover(
    runId: string,
    operation: (
      options: Parameters<DiscoverService['search']>[1]
    ) => ReturnType<DiscoverService['search']>
  ) {
    if (this.activeRun) throw new Error('A Discover run is already active for this window')
    const controller = new AbortController()
    this.activeRun = { runId, controller }
    try {
      return await operation({
        ...this.credentials(),
        signal: controller.signal,
        onProgress: (progress) => {
          if (!this.closed && this.context.isAvailable())
            this.progressListeners.forEach((listener) => listener({ ...progress, runId }))
        }
      })
    } finally {
      if (this.activeRun?.runId === runId) this.activeRun = null
    }
  }
}

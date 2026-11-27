import { randomUUID } from 'node:crypto'
import type { LlmWikiPromotionAdapter } from '../core/integrations/llmWikiPromotionService'
import { LlmWikiVaultAdapter } from '../core/integrations/llmWikiVaultAdapter'
import type { LlmWikiInboxAdapterPort } from '../core/integrations/llmWikiInboxService'
import { LlmWikiInboxAdapter } from '../core/integrations/llmWikiInboxAdapter'
import {
  LLM_WIKI_PROMOTION_PREVIEW_VERSION,
  LLM_WIKI_PROMOTION_PROMPT_VERSION,
  LLM_WIKI_PROMOTION_RECEIPT_VERSION
} from '../shared/llmWikiPromotion'
import {
  LLM_WIKI_INBOX_PREVIEW_VERSION,
  LLM_WIKI_INBOX_RECEIPT_VERSION
} from '../shared/llmWikiInbox'
import { resolveLlmWikiVaultLocation } from '../core/integrations/llmWikiDiagnostics'
import type { LlmWikiVaultDiagnostics } from '../shared/llmWikiSettings'
import { createLlmWikiPromotionRuntime } from './llmWikiPromotionRuntime'

export function buildFixtureWikiDiagnostics(customPath: string | null): LlmWikiVaultDiagnostics {
  const location = resolveLlmWikiVaultLocation({
    customPath,
    envPath: undefined,
    defaultPath: '/fixture/llm-wiki'
  })
  return {
    ...location,
    status: 'ready',
    checkedAt: new Date().toISOString(),
    checks: [
      {
        id: 'vault-root',
        label: 'Vault folder',
        status: 'ok',
        detail: 'Fixture vault folder is ready without accessing local files.',
        remediation: null
      },
      {
        id: 'required-files',
        label: 'Vault rules files',
        status: 'ok',
        detail: 'AGENTS.md and _schema.md are present in the fixture.',
        remediation: null
      },
      {
        id: 'paper-directories',
        label: 'Paper folders',
        status: 'ok',
        detail: 'raw/paper_records and Literature/Paper_Notes are present in the fixture.',
        remediation: null
      }
    ]
  }
}

export function createLlmWikiAdapters(options: {
  readonly useE2eFixtures: boolean
  readonly resolveVaultRoot: () => string
}): {
  readonly promotionAdapter: LlmWikiPromotionAdapter
  readonly inboxAdapter: LlmWikiInboxAdapterPort
} {
  if (options.useE2eFixtures) {
    const promotionAdapter: LlmWikiPromotionAdapter = {
      prepare: async (item, context) => {
        const base = 'Fixture et al. - 2026 - Deterministic promotion fixture'
        const paths = [
          `raw/papers/${base}.pdf`,
          `raw/paper_records/${base}.md`,
          'Literature/Paper_Notes/L2_Structured/Model_Compression/Fixture_2026_DeterministicPromotion.md',
          'Topics/Edge_AI/Model_Compression/Structured_Pruning.md',
          'Literature/Paper_Notes/Paper_Notes_Index.md',
          'log.md',
          'Automation_Conversations/2026-08-21__therss-paper-promotion__fixture.md'
        ]
        return {
          preview: {
            version: LLM_WIKI_PROMOTION_PREVIEW_VERSION,
            previewId: context.previewId,
            itemId: item.id,
            arxivId: item.externalId.replace(/v\d+$/u, ''),
            title: item.title,
            ready: true,
            vaultLabel: 'llm-wiki',
            level: 'L2',
            routingRationale: 'Deterministic Electron fixture route.',
            intendedPaths: paths,
            pdf: { pageCount: 12, byteSize: 120_000, sha256: 'd'.repeat(64) },
            evidenceBoundary: 'Fixture only; no real vault write or network call occurred.',
            blockers: [],
            sourceHash: '0'.repeat(64),
            contractHash: 'e'.repeat(64),
            expiresAt: context.expiresAt
          },
          opaqueHandle: { fixture: true }
        }
      },
      confirm: async (prepared) => ({
        version: LLM_WIKI_PROMOTION_RECEIPT_VERSION,
        id: `e2e:${randomUUID()}`,
        itemId: prepared.preview.itemId,
        arxivId: prepared.preview.arxivId,
        status: 'completed',
        runner: 'codex',
        promptVersion: LLM_WIKI_PROMOTION_PROMPT_VERSION,
        sourceHash: prepared.preview.sourceHash,
        contractHash: prepared.preview.contractHash,
        evidenceTier: 'full-text-verified',
        summary: 'Deterministic fixture promotion completed without writing the real vault.',
        createdPaths: prepared.preview.intendedPaths.slice(0, 3),
        updatedPaths: prepared.preview.intendedPaths.slice(3, -1),
        pdfPath: prepared.preview.intendedPaths[0] ?? null,
        sidecarPath: prepared.preview.intendedPaths[1] ?? null,
        notePath: prepared.preview.intendedPaths[2] ?? null,
        auditPath: prepared.preview.intendedPaths.at(-1) ?? null,
        blockers: [],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      }),
      dispose: async () => undefined
    }

    const inboxAdapter: LlmWikiInboxAdapterPort = {
      prepare: async (item, context) => {
        const paths = [
          `Inbox/TheRSS_2026-11-27_fixture_${context.sourceHash.slice(0, 8)}.md`,
          'log.md',
          'Automation_Conversations/20261127T000000Z__therss-inbox-capture__fixture.json'
        ]
        return {
          preview: {
            version: LLM_WIKI_INBOX_PREVIEW_VERSION,
            previewId: context.previewId,
            itemId: item.id,
            source: item.source,
            kind: item.kind as Exclude<typeof item.kind, 'paper'>,
            title: item.title,
            url: item.url,
            ready: true,
            vaultLabel: 'llm-wiki',
            destination: 'Inbox',
            intendedPaths: paths,
            evidenceBoundary: 'Fixture only; no real vault write occurred.',
            blockers: [],
            sourceHash: context.sourceHash,
            contractHash: 'f'.repeat(64),
            expiresAt: context.expiresAt
          },
          opaqueHandle: { fixture: true }
        }
      },
      confirm: async (prepared) => ({
        version: LLM_WIKI_INBOX_RECEIPT_VERSION,
        id: `e2e-inbox:${randomUUID()}`,
        itemId: prepared.preview.itemId,
        source: prepared.preview.source,
        kind: prepared.preview.kind,
        status: 'completed',
        sourceHash: prepared.preview.sourceHash,
        contractHash: prepared.preview.contractHash,
        evidenceTier: 'metadata-only',
        summary: 'Deterministic fixture Inbox capture completed without writing the real vault.',
        createdPaths: [prepared.preview.intendedPaths[0]!, prepared.preview.intendedPaths[2]!],
        updatedPaths: ['log.md'],
        notePath: prepared.preview.intendedPaths[0] ?? null,
        auditPath: prepared.preview.intendedPaths[2] ?? null,
        blockers: [],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      })
    }

    return { promotionAdapter, inboxAdapter }
  }

  const runtime = createLlmWikiPromotionRuntime()
  return {
    promotionAdapter: new LlmWikiVaultAdapter({
      ...runtime,
      resolveVaultRoot: options.resolveVaultRoot
    }),
    inboxAdapter: new LlmWikiInboxAdapter({
      resolveVaultRoot: options.resolveVaultRoot,
      runRuntime: runtime.runRuntime
    })
  }
}

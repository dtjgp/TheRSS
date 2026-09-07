import { z } from 'zod'
import type { DiscoverSnapshot } from '../../shared/discover'
import { hashAnalysisSource } from '../analysis/sourceSnapshot'

export const qualityJudgmentSchema = z
  .object({
    itemId: z.string().min(1).max(300),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/u),
    assessor: z.enum(['human', 'assistant']),
    relevance: z.union([z.literal(0), z.literal(1), z.literal(2), z.null()]),
    rationale: z.string().min(1).max(1200)
  })
  .strict()
export type QualityJudgment = z.infer<typeof qualityJudgmentSchema>

function normalizedUrl(raw: string, source: string): string | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    url.hash = ''
    url.pathname = url.pathname.replace(/\/$/u, '')
    if (source === 'github') url.pathname = url.pathname.toLocaleLowerCase()
    return url.toString()
  } catch {
    return null
  }
}

export function evaluateDiscoveryQuality(
  snapshot: DiscoverSnapshot,
  candidates: readonly QualityJudgment[] = [],
  k = 10
) {
  z.number().int().min(1).max(100).parse(k)
  const judgments = z.array(qualityJudgmentSchema).max(200).parse(candidates)
  const byId = new Map(snapshot.items.map((item) => [item.id, item]))
  const seen = new Set<string>()
  for (const judgment of judgments) {
    const key = `${judgment.assessor}:${judgment.itemId}`
    if (seen.has(key)) throw new Error('Duplicate quality judgment')
    seen.add(key)
    const item = byId.get(judgment.itemId)
    if (!item) throw new Error('Quality judgment is outside this snapshot')
    if (hashAnalysisSource({ ...item, triageState: 'new' }) !== judgment.sourceHash)
      throw new Error('Quality judgment has a stale source hash')
  }
  const top = snapshot.items.slice(0, k)
  const topIds = new Set(top.map((item) => item.id))
  const score = (assessor: QualityJudgment['assessor']) => {
    const selected = judgments.filter(
      (label) => label.assessor === assessor && topIds.has(label.itemId)
    )
    const judged = selected.filter((label) => label.relevance !== null)
    const complete = top.length === k && judged.length === k
    return {
      judged: judged.length,
      unknown: selected.length - judged.length,
      total: top.length,
      precisionAtK: complete ? judged.filter((label) => label.relevance! >= 1).length / k : null,
      directRelevanceAtK: complete
        ? judged.filter((label) => label.relevance === 2).length / k
        : null
    }
  }
  const urls = snapshot.items.map((item) => normalizedUrl(item.url, item.source))
  const safeUrls = urls.filter((url): url is string => url !== null)
  const outcomes = Object.values(snapshot.sourceOutcomes)
  return {
    runId: snapshot.id,
    k,
    returned: snapshot.items.length,
    diagnostics: {
      duplicateIds: snapshot.items.length - byId.size,
      duplicateUrls: safeUrls.length - new Set(safeUrls).size,
      unsafeUrls: urls.filter((url) => url === null).length,
      invalidDates: snapshot.items.filter(
        (item) =>
          !Number.isFinite(Date.parse(item.publishedAt)) ||
          !Number.isFinite(Date.parse(item.updatedAt))
      ).length,
      futurePublicationDates: snapshot.items.filter(
        (item) => Date.parse(item.publishedAt) > Date.parse(snapshot.createdAt)
      ).length,
      missingDescriptions: snapshot.items.filter((item) => !item.summary.trim()).length,
      unexpectedKinds: snapshot.items.filter(
        (item) => item.kind !== 'paper' && item.kind !== 'repository'
      ).length,
      failedSources: outcomes.filter((outcome) => outcome.status === 'failed').length,
      partialSources: outcomes.filter((outcome) => outcome.status === 'partial').length
    },
    human: score('human'),
    assistant: score('assistant'),
    recall: null,
    boundary:
      'Human and assistant judgments are separate. Scores are not relevance labels. Missing top-k labels and an unknown relevant corpus do not support precision or recall claims.'
  }
}

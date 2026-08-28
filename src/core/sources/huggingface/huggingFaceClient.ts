import { z } from 'zod'
import { readBoundedText } from '../../security/boundedResponse'
import type { ConfiguredSourceItem } from '../catalog/configuredSourceItem'

const HUGGING_FACE_SOURCE_ID = 'folo:64'
const HUGGING_FACE_ENDPOINTS = {
  model: 'https://huggingface.co/api/models',
  dataset: 'https://huggingface.co/api/datasets',
  paper: 'https://huggingface.co/api/daily_papers'
} as const

interface FetchHuggingFaceOptions {
  readonly fetcher?: typeof fetch
  readonly token?: string
  readonly maxItemsPerKind?: number
  readonly maxResponseBytes?: number
  readonly signal?: AbortSignal
}

const hubIdSchema = z
  .string()
  .min(1)
  .max(300)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/)
const tagSchema = z.string().min(1).max(200)
const modelSchema = z.object({
  id: hubIdSchema,
  lastModified: z.string().min(1),
  tags: z.array(tagSchema).default([]),
  downloads: z.number().int().nonnegative().default(0),
  pipeline_tag: z.string().max(100).nullable().optional()
})
const datasetSchema = z.object({
  id: hubIdSchema,
  lastModified: z.string().min(1),
  tags: z.array(tagSchema).default([]),
  downloads: z.number().int().nonnegative().default(0),
  description: z.string().nullable().optional()
})
const paperSchema = z.object({
  publishedAt: z.string().min(1),
  paper: z.object({
    id: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[A-Za-z0-9._-]+$/),
    title: z.string().min(1),
    summary: z.string().default(''),
    authors: z.array(z.object({ name: z.string().min(1).max(200) })).default([])
  })
})

function boundedPlainText(value: string, maxLength: number): string {
  return value
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function normalizedDate(value: string, label: string): string {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new Error(`Hugging Face ${label} has an invalid date`)
  return new Date(timestamp).toISOString()
}

function validatedLimit(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 50) {
    throw new Error('Hugging Face maxItemsPerKind must be between 1 and 50')
  }
  return value
}

async function fetchJson(
  label: string,
  endpoint: string,
  options: FetchHuggingFaceOptions,
  limit: number
): Promise<unknown> {
  const url = new URL(endpoint)
  url.searchParams.set('limit', String(limit))
  if (label !== 'papers') {
    url.searchParams.set('sort', 'lastModified')
    url.searchParams.set('direction', '-1')
    url.searchParams.set('full', 'true')
  }
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'TheRSS/0.2 (local research source client)'
  }
  if (options.token?.trim()) headers.Authorization = `Bearer ${options.token.trim()}`

  const response = await (options.fetcher ?? fetch)(url.toString(), {
    headers,
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(30_000)])
      : AbortSignal.timeout(30_000)
  })
  if (!response.ok) {
    throw new Error(`Hugging Face ${label} request failed with status ${response.status}`)
  }
  const body = await readBoundedText(
    response,
    options.maxResponseBytes ?? 5_000_000,
    `Hugging Face ${label}`
  )
  return JSON.parse(body) as unknown
}

export async function fetchHuggingFaceSignals(
  options: FetchHuggingFaceOptions = {}
): Promise<ConfiguredSourceItem[]> {
  const limit = validatedLimit(options.maxItemsPerKind ?? 10)
  const [modelPayload, datasetPayload, paperPayload] = await Promise.all([
    fetchJson('models', HUGGING_FACE_ENDPOINTS.model, options, limit),
    fetchJson('datasets', HUGGING_FACE_ENDPOINTS.dataset, options, limit),
    fetchJson('papers', HUGGING_FACE_ENDPOINTS.paper, options, limit)
  ])
  const models = z.array(modelSchema).max(50).parse(modelPayload)
  const datasets = z.array(datasetSchema).max(50).parse(datasetPayload)
  const papers = z.array(paperSchema).max(50).parse(paperPayload)

  return [
    ...models.map((model): ConfiguredSourceItem => ({
      id: `huggingface:model:${model.id}`,
      sourceId: HUGGING_FACE_SOURCE_ID,
      externalId: model.id,
      kind: 'model',
      title: boundedPlainText(model.id, 300),
      summary: `Model${model.pipeline_tag ? ` · ${boundedPlainText(model.pipeline_tag, 100)}` : ''} · ${model.downloads} downloads`,
      url: `https://huggingface.co/${model.id}`,
      publishedAt: normalizedDate(model.lastModified, 'model'),
      authors: [],
      tags: model.tags.slice(0, 50),
      metrics: { downloads: model.downloads }
    })),
    ...datasets.map((dataset): ConfiguredSourceItem => ({
      id: `huggingface:dataset:${dataset.id}`,
      sourceId: HUGGING_FACE_SOURCE_ID,
      externalId: dataset.id,
      kind: 'dataset',
      title: boundedPlainText(dataset.id, 300),
      summary:
        boundedPlainText(dataset.description ?? '', 5_000) ||
        `Dataset · ${dataset.downloads} downloads`,
      url: `https://huggingface.co/datasets/${dataset.id}`,
      publishedAt: normalizedDate(dataset.lastModified, 'dataset'),
      authors: [],
      tags: dataset.tags.slice(0, 50),
      metrics: { downloads: dataset.downloads }
    })),
    ...papers.map(({ paper, publishedAt }): ConfiguredSourceItem => ({
      id: `huggingface:paper:${paper.id}`,
      sourceId: HUGGING_FACE_SOURCE_ID,
      externalId: paper.id,
      kind: 'paper',
      title: boundedPlainText(paper.title, 500),
      summary: boundedPlainText(paper.summary, 10_000),
      url: `https://huggingface.co/papers/${paper.id}`,
      publishedAt: normalizedDate(publishedAt, 'paper'),
      authors: paper.authors.map((author) => boundedPlainText(author.name, 200)).filter(Boolean),
      tags: [],
      metrics: {}
    }))
  ]
}

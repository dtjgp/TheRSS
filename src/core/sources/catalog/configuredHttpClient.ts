import { readBoundedText } from '../../security/boundedResponse'
import { getConfiguredSourceDefinition } from './configuredSources'

export interface ConfiguredHttpDocument {
  readonly sourceId: string
  readonly transport: 'feed' | 'html'
  readonly endpoint: string
  readonly contentType: string
  readonly retrievedAt: string
  readonly body: string
}

interface FetchConfiguredHttpOptions {
  readonly fetcher?: typeof fetch
  readonly now?: Date
  readonly maxResponseBytes?: number
  readonly sleep?: (milliseconds: number) => Promise<void>
  readonly signal?: AbortSignal
}

const ALLOWED_CONTENT_TYPES = {
  feed: new Set(['application/rss+xml', 'application/atom+xml', 'application/xml', 'text/xml']),
  html: new Set(['text/html', 'application/xhtml+xml', 'application/json'])
} as const

function normalizedContentType(response: Response): string {
  return (response.headers.get('content-type') ?? '').split(';', 1)[0]!.trim().toLocaleLowerCase()
}

function assertFinalOrigin(response: Response, endpoint: string, sourceId: string): void {
  if (!response.url) return
  const expected = new URL(endpoint)
  const actual = new URL(response.url)
  if (actual.protocol !== 'https:' || actual.origin !== expected.origin) {
    throw new Error(`Configured source ${sourceId} redirected outside its fixed HTTPS origin`)
  }
}

export async function fetchConfiguredHttpDocument(
  sourceId: string,
  options: FetchConfiguredHttpOptions = {}
): Promise<ConfiguredHttpDocument> {
  const source = getConfiguredSourceDefinition(sourceId)
  if (
    source.transport !== 'feed' &&
    source.transport !== 'html' &&
    source.transport !== 'dated_feed'
  ) {
    throw new Error(`Configured source ${sourceId} does not use bounded HTTP document retrieval`)
  }
  const transport = source.transport === 'dated_feed' ? 'feed' : source.transport
  const fetcher = options.fetcher ?? fetch
  const sleep =
    options.sleep ??
    ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)))
  const endpoints = [source.endpoint]
  if ('fallbackEndpoint' in source && source.fallbackEndpoint)
    endpoints.push(source.fallbackEndpoint)
  const attempts = 'retryAttempts' in source ? (source.retryAttempts ?? 1) : 1
  let response: Response | undefined
  let endpoint = source.endpoint
  let lastError: unknown

  for (let endpointIndex = 0; endpointIndex < endpoints.length; endpointIndex += 1) {
    endpoint = endpoints[endpointIndex]!
    const endpointAttempts = endpointIndex === 0 ? attempts : 1
    for (let attempt = 1; attempt <= endpointAttempts; attempt += 1) {
      try {
        response = await fetcher(endpoint, {
          headers: {
            Accept:
              transport === 'feed'
                ? 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9'
                : 'text/html, application/xhtml+xml, application/json;q=0.8',
            'User-Agent': 'TheRSS/0.2 (local research source client)'
          },
          redirect: 'follow',
          signal: options.signal
            ? AbortSignal.any([options.signal, AbortSignal.timeout(30_000)])
            : AbortSignal.timeout(30_000)
        })
        if (response.ok) break
        lastError = new Error(
          `Configured source ${sourceId} request failed with status ${response.status}`
        )
        if (response.status < 500 && response.status !== 429) throw lastError
      } catch (error) {
        lastError = error
      }
      response = undefined
      if (attempt < endpointAttempts) await sleep(Math.min(250 * attempt, 1_000))
    }
    if (response?.ok) break
  }
  if (!response?.ok) {
    if (lastError instanceof Error && lastError.message.startsWith('Configured source')) {
      throw lastError
    }
    throw new Error(
      `Configured source ${sourceId} request failed: ${lastError instanceof Error ? lastError.message : 'network error'}`
    )
  }
  assertFinalOrigin(response, endpoint, sourceId)
  const contentType = normalizedContentType(response)
  if (!ALLOWED_CONTENT_TYPES[transport].has(contentType)) {
    throw new Error(`Configured source ${sourceId} returned unexpected content type ${contentType}`)
  }
  const body = await readBoundedText(
    response,
    options.maxResponseBytes ?? 5_000_000,
    `Configured source ${sourceId}`,
    'encoding' in source ? source.encoding : undefined
  )
  if (!body.trim()) throw new Error(`Configured source ${sourceId} returned an empty response`)

  return {
    sourceId,
    transport,
    endpoint,
    contentType,
    retrievedAt: (options.now ?? new Date()).toISOString(),
    body
  }
}

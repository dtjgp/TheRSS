import { execFile } from 'node:child_process'
import { z } from 'zod'
import type { ConfiguredSourceItem } from '../catalog/configuredSourceItem'

export interface XapiRunResult {
  readonly stdout: string
  readonly stderr: string
}

export type XapiRunner = (args: readonly string[]) => Promise<XapiRunResult>

interface FetchXOptions {
  readonly runner?: XapiRunner
  readonly count?: number
}

const actionSchema = z.object({
  id: z.literal('twitter.search'),
  input: z.object({
    required: z.array(z.string()),
    properties: z.record(z.string(), z.unknown()).default({})
  })
})
const tweetSchema = z.object({
  tweet_id: z.string().min(1).max(100),
  text: z.string().min(1),
  created_at: z.string().min(1),
  favorite_count: z.number().nonnegative().optional(),
  user: z.object({
    name: z.string().min(1).max(200),
    screen_name: z.string().regex(/^[A-Za-z0-9_]{1,15}$/)
  })
})
const searchSchema = z.object({
  data: z.object({
    provider: z.string().optional(),
    tweets: z.array(tweetSchema).max(100)
  })
})

function boundedPlainText(value: string, maxLength: number): string {
  return value.replaceAll(/\s+/g, ' ').trim().slice(0, maxLength)
}

function parseJson(stdout: string, label: string): unknown {
  if (Buffer.byteLength(stdout, 'utf8') > 2_000_000) {
    throw new Error(`${label} output exceeds the 2000000 byte safety limit`)
  }
  try {
    return JSON.parse(stdout) as unknown
  } catch {
    throw new Error(`${label} returned invalid JSON`)
  }
}

function defaultXapiRunner(args: readonly string[]): Promise<XapiRunResult> {
  return new Promise((resolve, reject) => {
    execFile(
      'npx',
      ['-y', 'xapi-to', ...args],
      { timeout: 30_000, maxBuffer: 2_000_000, shell: false, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`xapi command failed: ${error.message.slice(0, 300)}`))
          return
        }
        resolve({ stdout, stderr })
      }
    )
  })
}

function validatedCount(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error('xapi result count must be between 1 and 100')
  }
  return value
}

function normalizedDate(value: string): string {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new Error('xapi tweet has an invalid created_at')
  return new Date(timestamp).toISOString()
}

export async function fetchXSignals(
  rawQuery: string,
  options: FetchXOptions = {}
): Promise<ConfiguredSourceItem[]> {
  const query = rawQuery.trim()
  if (!query || query.length > 500) throw new Error('xapi query must contain 1 to 500 characters')
  const count = validatedCount(options.count ?? 20)
  const runner = options.runner ?? defaultXapiRunner

  const schemaResult = await runner(['get', 'twitter.search'])
  const schema = actionSchema.parse(parseJson(schemaResult.stdout, 'xapi schema'))
  if (!schema.input.required.includes('raw_query')) {
    throw new Error('xapi twitter.search schema does not require raw_query')
  }
  const sortProperty = schema.input.properties.sort_by as { readonly enum?: unknown } | undefined
  if (!Array.isArray(sortProperty?.enum) || !sortProperty.enum.includes('Latest')) {
    throw new Error('xapi twitter.search schema does not support Latest sorting')
  }

  const input = JSON.stringify({ raw_query: query, sort_by: 'Latest', count })
  const searchResult = await runner(['call', 'twitter.search', '--input', input])
  const payload = searchSchema.parse(parseJson(searchResult.stdout, 'xapi search'))

  return payload.data.tweets.map((tweet): ConfiguredSourceItem => {
    const summary = boundedPlainText(tweet.text, 5_000)
    return {
      id: `x:${tweet.tweet_id}`,
      sourceId: 'folo:2',
      externalId: tweet.tweet_id,
      kind: 'post',
      title: boundedPlainText(`@${tweet.user.screen_name}: ${summary}`, 300),
      summary,
      url: `https://x.com/${tweet.user.screen_name}/status/${tweet.tweet_id}`,
      publishedAt: normalizedDate(tweet.created_at),
      authors: [boundedPlainText(tweet.user.name, 200)],
      tags: [],
      metrics: tweet.favorite_count === undefined ? {} : { likes: tweet.favorite_count }
    }
  })
}

type HttpTransport = 'feed' | 'html'

export interface HttpConfiguredSourceDefinition {
  readonly id: string
  readonly transport: HttpTransport
  readonly endpoint: string
  readonly verifiedOn: string
  readonly retryOnly?: true
  readonly fallbackEndpoint?: string
  readonly retryAttempts?: number
}

export interface DatedFeedConfiguredSourceDefinition {
  readonly id: string
  readonly transport: 'dated_feed'
  readonly endpoint: string
  readonly verifiedOn: string
  readonly articleOrigin: string
  readonly dateMetaNames: readonly string[]
  readonly itemKind: 'paper' | 'article'
  readonly maxItems: number
}

export interface HuggingFaceConfiguredSourceDefinition {
  readonly id: 'folo:64'
  readonly transport: 'huggingface'
  readonly endpoints: {
    readonly models: string
    readonly datasets: string
    readonly papers: string
  }
}

export interface XapiConfiguredSourceDefinition {
  readonly id: 'folo:2'
  readonly transport: 'xapi'
  readonly schemaAction: 'twitter.search'
  readonly searchAction: 'twitter.search'
}

export type ConfiguredSourceDefinition =
  | HttpConfiguredSourceDefinition
  | DatedFeedConfiguredSourceDefinition
  | HuggingFaceConfiguredSourceDefinition
  | XapiConfiguredSourceDefinition

const VERIFIED_ON = '2026-08-19'

const definitions = [
  {
    id: 'folo:302',
    transport: 'feed',
    endpoint: 'https://rsshub.rssforever.com/baai/hub',
    verifiedOn: VERIFIED_ON
  },
  {
    id: 'folo:611',
    transport: 'html',
    endpoint: 'https://www.ncpssd.cn/',
    verifiedOn: VERIFIED_ON,
    retryOnly: true,
    fallbackEndpoint: 'https://m.ncpssd.cn/',
    retryAttempts: 2
  },
  {
    id: 'folo:444',
    transport: 'dated_feed',
    endpoint: 'https://back.nber.org/rss/new.xml',
    verifiedOn: VERIFIED_ON,
    articleOrigin: 'https://www.nber.org',
    dateMetaNames: ['citation_publication_date', 'dcterms.date'],
    itemKind: 'paper',
    maxItems: 20
  },
  {
    id: 'folo:182',
    transport: 'feed',
    endpoint: 'https://rsshub.rssforever.com/openai/news',
    verifiedOn: VERIFIED_ON
  },
  {
    id: 'folo:77',
    transport: 'feed',
    endpoint: 'https://hub.slarker.me/sciencenet/blog',
    verifiedOn: VERIFIED_ON
  },
  {
    id: 'folo:208',
    transport: 'feed',
    endpoint: 'https://www.qbitai.com/feed',
    verifiedOn: VERIFIED_ON
  },
  {
    id: 'folo:93',
    transport: 'feed',
    endpoint: 'https://rsshub.rssforever.com/mittrchina/index',
    verifiedOn: VERIFIED_ON
  },
  {
    id: 'folo:84',
    transport: 'feed',
    endpoint: 'https://www.mckinsey.com/insights/rss',
    verifiedOn: VERIFIED_ON
  },
  {
    id: 'folo:67',
    transport: 'feed',
    endpoint: 'https://rsshub.rssforever.com/aibase/news',
    verifiedOn: VERIFIED_ON
  },
  {
    id: 'folo:523',
    transport: 'feed',
    endpoint: 'https://hub.slarker.me/c114/roll',
    verifiedOn: VERIFIED_ON,
    retryOnly: true
  },
  {
    id: 'folo:253',
    transport: 'feed',
    endpoint: 'https://rsshub.rssforever.com/cnbc/rss',
    verifiedOn: VERIFIED_ON
  },
  {
    id: 'folo:44',
    transport: 'feed',
    endpoint: 'https://news.ycombinator.com/rss',
    verifiedOn: VERIFIED_ON
  },
  {
    id: 'folo:792',
    transport: 'feed',
    endpoint: 'https://www.mdpi.com/rss',
    verifiedOn: VERIFIED_ON
  },
  {
    id: 'folo:79',
    transport: 'feed',
    endpoint: 'https://www.solidot.org/index.rss',
    verifiedOn: VERIFIED_ON
  },
  {
    id: 'folo:172',
    transport: 'feed',
    endpoint: 'https://techcrunch.com/feed/',
    verifiedOn: VERIFIED_ON
  },
  {
    id: 'folo:1104',
    transport: 'feed',
    endpoint: 'https://www.techpowerup.com/rss/news',
    verifiedOn: VERIFIED_ON
  },
  {
    id: 'folo:177',
    transport: 'dated_feed',
    endpoint: 'https://asia.nikkei.com/rss/feed/nar',
    verifiedOn: VERIFIED_ON,
    articleOrigin: 'https://asia.nikkei.com',
    dateMetaNames: ['date'],
    itemKind: 'article',
    maxItems: 20
  },
  {
    id: 'folo:257',
    transport: 'feed',
    endpoint: 'https://www.theverge.com/rss/index.xml',
    verifiedOn: VERIFIED_ON
  },
  {
    id: 'folo:312',
    transport: 'feed',
    endpoint: 'https://www.wired.com/feed/rss',
    verifiedOn: VERIFIED_ON
  },
  {
    id: 'folo:64',
    transport: 'huggingface',
    endpoints: {
      models: 'https://huggingface.co/api/models',
      datasets: 'https://huggingface.co/api/datasets',
      papers: 'https://huggingface.co/api/daily_papers'
    }
  },
  {
    id: 'folo:2',
    transport: 'xapi',
    schemaAction: 'twitter.search',
    searchAction: 'twitter.search'
  }
] as const satisfies readonly ConfiguredSourceDefinition[]

function assertHttpsEndpoint(value: string, label: string): void {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`${label} must be a credential-free HTTPS endpoint`)
  }
}

function validateDefinitions(
  candidates: readonly ConfiguredSourceDefinition[]
): readonly ConfiguredSourceDefinition[] {
  const identities = new Set<string>()
  for (const source of candidates) {
    if (identities.has(source.id)) throw new Error(`Duplicate configured source ${source.id}`)
    identities.add(source.id)
    if (
      source.transport === 'feed' ||
      source.transport === 'html' ||
      source.transport === 'dated_feed'
    ) {
      assertHttpsEndpoint(source.endpoint, source.id)
      if ('fallbackEndpoint' in source && source.fallbackEndpoint) {
        assertHttpsEndpoint(source.fallbackEndpoint, `${source.id} fallback`)
      }
      if (source.transport === 'dated_feed') {
        assertHttpsEndpoint(source.articleOrigin, `${source.id} article origin`)
      }
    } else if (source.transport === 'huggingface') {
      Object.entries(source.endpoints).forEach(([kind, endpoint]) =>
        assertHttpsEndpoint(endpoint, `${source.id} ${kind}`)
      )
    }
  }
  return Object.freeze([...candidates])
}

export const CONFIGURED_SOURCE_DEFINITIONS = validateDefinitions(definitions)

export function getConfiguredSourceDefinition(id: string): ConfiguredSourceDefinition {
  const source = CONFIGURED_SOURCE_DEFINITIONS.find((candidate) => candidate.id === id)
  if (!source) throw new Error(`Source ${id} is not configured`)
  return source
}

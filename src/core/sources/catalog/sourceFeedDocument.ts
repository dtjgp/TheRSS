import { Buffer } from 'node:buffer'
import { XMLParser, XMLValidator } from 'fast-xml-parser'

export function parseSourceFeed(body: string): Record<string, unknown> {
  if (Buffer.byteLength(body) > 5_000_000) throw new Error('Feed exceeds the source safety limit')
  const declarations = body.replaceAll(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->/gu, '')
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/iu.test(declarations))
    throw new Error('Feed contains an unsupported XML declaration')
  if (XMLValidator.validate(body) !== true) throw new Error('Source returned invalid feed XML')
  const parsed: unknown = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true
  }).parse(body)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('Source returned no feed container')
  const result = parsed as Record<string, unknown>
  const rss = result.rss
  if ('feed' in result || 'RDF' in result || (rss && typeof rss === 'object' && 'channel' in rss))
    return result
  throw new Error('Source returned an unsupported feed container')
}

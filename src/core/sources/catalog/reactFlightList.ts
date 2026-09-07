import { Buffer } from 'node:buffer'

const MAX_BYTES = 5_000_000
const MAX_FRAMES = 10_000

// Read the public SSR data format, never execute a page's JavaScript or resolve its references.
export function readInitialArticles(html: string): readonly unknown[] {
  if (Buffer.byteLength(html) > MAX_BYTES)
    throw new Error('Official news page exceeds safety limit')
  const chunks: string[] = []
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/giu)) {
    const call = script[1]!.trim().match(/^self\.__next_f\.push\(([\s\S]*)\);?$/u)
    if (!call) continue
    const payload: unknown = JSON.parse(call[1]!)
    if (Array.isArray(payload) && payload[0] === 1 && typeof payload[1] === 'string') {
      chunks.push(payload[1])
    }
  }
  const stream = Buffer.from(chunks.join(''), 'utf8')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let offset = 0
  let frames = 0
  let nodes = 0
  let articles: readonly unknown[] | undefined
  function visit(value: unknown, depth = 0): void {
    if (++nodes > 100_000 || depth > 32) throw new Error('Official news list exceeds nesting limit')
    if (!value || typeof value !== 'object') return
    if (!Array.isArray(value) && 'initialArticles' in value) {
      if (!Array.isArray(value.initialArticles)) throw new Error('Official news list is invalid')
      articles ??= value.initialArticles
      return
    }
    for (const child of Object.values(value)) visit(child, depth + 1)
  }
  while (offset < stream.length) {
    if (stream[offset] === 10 || stream[offset] === 13) {
      offset++
      continue
    }
    if (++frames > MAX_FRAMES) throw new Error('Official news page exceeds frame limit')
    const colon = stream.indexOf(58, offset)
    if (
      colon < offset ||
      colon - offset > 32 ||
      !/^[\da-f]*$/iu.test(stream.toString('ascii', offset, colon))
    ) {
      throw new Error('Official news page has an invalid frame')
    }
    offset = colon + 1
    if (stream[offset] === 84) {
      const comma = stream.indexOf(44, offset)
      const lengthText = stream.toString('ascii', offset + 1, comma)
      if (comma < offset || !/^[\da-f]{1,8}$/iu.test(lengthText)) {
        throw new Error('Official news page has an invalid text length')
      }
      // Flight T lengths count UTF-8 bytes, not JS UTF-16 code units. Text may contain newlines.
      const end = comma + 1 + Number.parseInt(lengthText, 16)
      if (end > stream.length) throw new Error('Official news page has a truncated text frame')
      offset = end
      continue
    }
    const newline = stream.indexOf(10, offset)
    if (newline < offset) throw new Error('Official news page has a truncated frame')
    const payload = decoder.decode(stream.subarray(offset, newline))
    if (payload.startsWith('[') || payload.startsWith('{')) visit(JSON.parse(payload))
    offset = newline + 1
  }
  if (!articles) throw new Error('Official news page has no initial article list')
  return articles.slice(0, 100)
}

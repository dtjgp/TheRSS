import type { DiscoveryItem, DiscoveryItemKind } from '../../shared/discovery'
import type { NativeSymbol } from './presentation'
import { sourceDisplayName } from '../../shared/sourceIdentity'
import {
  sourcePublicationEvidence,
  sourcePublicationLabel,
  hasPublicationMonthOnly
} from '../../shared/sourceDate'

export function researchSubtitle(
  item: Pick<DiscoveryItem, 'source' | 'publishedAt'> & Partial<Pick<DiscoveryItem, 'summary'>>
): string {
  return `${sourceDisplayName(item.source)} · ${sourcePublicationLabel(item)}`
}

const kindGlyphs: Record<DiscoveryItemKind, { symbol: NativeSymbol; label: string }> = {
  paper: { symbol: 'doc.text', label: 'Paper' },
  repository: { symbol: 'chevron.left.forwardslash.chevron.right', label: 'Repository' },
  article: { symbol: 'newspaper', label: 'Article' },
  model: { symbol: 'cpu', label: 'Model' },
  dataset: { symbol: 'tablecells', label: 'Dataset' },
  post: { symbol: 'text.bubble', label: 'Post' }
}

/** The leading glyph and accessible kind name of a research row. */
export function researchKindSymbol(kind: DiscoveryItemKind): {
  symbol: NativeSymbol
  label: string
} {
  return kindGlyphs[kind]
}
/** Row fields for the kind glyph; an item without a recorded kind gets no glyph. */
export function researchRowGlyph(kind: DiscoveryItemKind | undefined): {
  symbol?: NativeSymbol
  symbolLabel?: string
} {
  return kind && kindGlyphs[kind]
    ? { symbol: kindGlyphs[kind].symbol, symbolLabel: kindGlyphs[kind].label }
    : {}
}

/** Present relevant fields; no source value is rewritten and zero is not treated as missing. */
export function researchMetadata(item: DiscoveryItem): string {
  return [
    '## Source details',
    `Source: ${sourceDisplayName(item.source)}`,
    `Record type: ${item.kind}`,
    `Source identifier: ${item.externalId}`,
    ...(item.authors.length || item.kind === 'paper'
      ? [`Authors: ${item.authors.join(', ') || 'Not supplied'}`]
      : []),
    ...(item.categories.length ? [`Categories: ${item.categories.join(', ')}`] : []),
    ...(item.topics.length ? [`Topics: ${item.topics.join(', ')}`] : []),
    ...(item.language !== null ? [`Language: ${item.language}`] : []),
    ...(item.stars !== null ? [`Stars: ${item.stars}`] : []),
    ...(item.metrics.downloads !== undefined ? [`Downloads: ${item.metrics.downloads}`] : []),
    ...(item.metrics.likes !== undefined ? [`Likes: ${item.metrics.likes}`] : []),
    `Published: ${sourcePublicationEvidence(item)}`,
    `Updated: ${hasPublicationMonthOnly(item) ? 'Not supplied separately' : item.updatedAt}`
  ].join('\n')
}

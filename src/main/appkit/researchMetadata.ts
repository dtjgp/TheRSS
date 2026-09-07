import type { DiscoveryItem } from '../../shared/discovery'
import { sourceDisplayName } from '../../shared/sourceIdentity'

export function researchSubtitle(
  item: Pick<DiscoveryItem, 'source' | 'publishedAt'>,
  saved = false
): string {
  return `${sourceDisplayName(item.source)} · ${item.publishedAt.slice(0, 10)}${saved ? ' · Saved' : ''}`
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
    `Published: ${item.publishedAt}`,
    `Updated: ${item.updatedAt}`
  ].join('\n')
}

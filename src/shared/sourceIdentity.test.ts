import { describe, expect, it } from 'vitest'
import {
  ACTIVE_TODAY_SOURCE_IDS,
  discoverySourceFromCatalogId,
  isDiscoverySource,
  sourceCatalogId,
  sourceDisplayName,
  sourceStyleToken
} from './sourceIdentity'

describe('source identity', () => {
  it('maps legacy and configured ingestion identities to catalog metadata', () => {
    expect(discoverySourceFromCatalogId('official:arxiv')).toBe('arxiv')
    expect(discoverySourceFromCatalogId('folo:10')).toBe('github')
    expect(discoverySourceFromCatalogId('folo:64')).toBe('folo:64')
    expect(discoverySourceFromCatalogId('official:itu')).toBeNull()
    expect(sourceCatalogId('arxiv')).toBe('official:arxiv')
    expect(sourceCatalogId('github')).toBe('folo:10')
    expect(sourceCatalogId('folo:64')).toBe('folo:64')
    expect(sourceDisplayName('arxiv')).toBe('arXiv')
    expect(sourceDisplayName('github')).toBe('GitHub')
    expect(sourceDisplayName('folo:64')).toBe('Huggingface')
    expect(sourceStyleToken('folo:64')).toBe('source-64')
  })

  it('accepts only known active ingestion identities', () => {
    expect(isDiscoverySource('arxiv')).toBe(true)
    expect(isDiscoverySource('folo:2')).toBe(false)
    expect(isDiscoverySource('folo:999999')).toBe(false)
    expect(isDiscoverySource('folo:not-a-number')).toBe(false)
    expect(isDiscoverySource('https://example.com')).toBe(false)
    expect(ACTIVE_TODAY_SOURCE_IDS).toHaveLength(22)
    expect(new Set(ACTIVE_TODAY_SOURCE_IDS).size).toBe(22)
  })
})

import { describe, expect, it } from 'vitest'
import { DISCOVER_SOURCE_IDS } from './discover'
import { SOURCE_GROUPS, sourceGroup } from './sourceGroups'

describe('research source groups', () => {
  it('partitions exactly the retained sources without duplicates or dormant entries', () => {
    const ids = SOURCE_GROUPS.flatMap((group) => group.sources)
    expect(ids).toHaveLength(22)
    expect(new Set(ids).size).toBe(22)
    expect([...ids].sort()).toEqual([...DISCOVER_SOURCE_IDS].sort())
    expect(sourceGroup('arxiv')?.id).toBe('papers')
    expect(sourceGroup('github')?.id).toBe('code')
    expect(sourceGroup(null)).toBeUndefined()
  })
})

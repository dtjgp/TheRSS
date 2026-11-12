import { describe, expect, it } from 'vitest'
import { DISCOVER_SOURCE_IDS, type DiscoverSource } from './discover'
import { changeShownSources, SOURCE_CHOICES, visibleSourceChoices } from './sourceChoice'

describe('source choices', () => {
  it('lists every Discover source once with its catalog role and group', () => {
    expect(SOURCE_CHOICES.map(({ source }) => source).sort()).toEqual(
      [...DISCOVER_SOURCE_IDS].sort()
    )
    expect(SOURCE_CHOICES.every(({ role, name }) => role.length > 0 && name.length > 0)).toBe(true)
  })

  it('finds by name, role or group and changes only shown sources', () => {
    const selection = new Set<DiscoverSource>(['arxiv', 'folo:84'])
    expect(visibleSourceChoices(selection, 'github', false).map(({ source }) => source)).toContain(
      'github'
    )
    const group = visibleSourceChoices(selection, 'business & policy', false)
    expect(group.map(({ source }) => source)).toEqual(['folo:84', 'folo:253', 'folo:177'])
    const role = SOURCE_CHOICES.find(({ source }) => source === 'folo:64')!.role
    expect(visibleSourceChoices(selection, role, false).map(({ source }) => source)).toContain(
      'folo:64'
    )
    expect(visibleSourceChoices(selection, '', true).map(({ source }) => source)).toEqual([
      'arxiv',
      'folo:84'
    ])
    const cleared = changeShownSources(selection, group, false)
    expect([...cleared]).toEqual(['arxiv'])
    const added = changeShownSources(selection, group, true)
    expect(added).toEqual(new Set(['arxiv', 'folo:84', 'folo:253', 'folo:177']))
    expect(selection).toEqual(new Set(['arxiv', 'folo:84']))
  })
})

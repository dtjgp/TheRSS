import { describe, expect, it, vi } from 'vitest'
import type { DiscoverSourcePreference } from '../../shared/discoverSourcePreference'
import { CHANGED_DEFAULT_NOTE, WebDiscoverSession } from './discoverSession'

const preference = (sources: DiscoverSourcePreference['sources']): DiscoverSourcePreference => ({
  sources,
  unavailable: [],
  origin: 'user',
  updatedAt: '2026-11-12T00:00:00.000Z'
})

describe('Web Discover session', () => {
  it('does not let a late default read replace a saved default or the draft', async () => {
    let finish!: (value: DiscoverSourcePreference) => void
    const session = new WebDiscoverSession({
      getDiscoverSourcePreference: vi.fn(
        () =>
          new Promise<DiscoverSourcePreference>((resolve) => {
            finish = resolve
          })
      ),
      saveDiscoverSourcePreference: vi.fn(async (sources) => preference(sources))
    })
    const loading = session.loadDefaults()
    await session.saveDefault(['folo:84'])
    finish(preference(['arxiv', 'github']))
    await loading
    expect(session.getState()).toMatchObject({ sources: ['folo:84'], defaults: ['folo:84'] })
  })

  it('keeps a running search draft and reports a failed read without selecting anything', async () => {
    const read = vi
      .fn<() => Promise<DiscoverSourcePreference>>()
      .mockRejectedValueOnce(new Error('busy'))
      .mockResolvedValue(preference(['arxiv']))
    const save = vi
      .fn<(sources: readonly string[]) => Promise<DiscoverSourcePreference>>()
      .mockRejectedValueOnce(new Error('disk full'))
      .mockImplementation(async (sources) => preference(sources as never))
    const session = new WebDiscoverSession({
      getDiscoverSourcePreference: read,
      saveDiscoverSourcePreference: save as never
    })
    await session.loadDefaults()
    expect(session.getState()).toMatchObject({ sources: [], failed: true })
    await session.loadDefaults(true)
    expect(session.getState()).toMatchObject({ sources: ['arxiv'], failed: false })
    session.startRun('run-0')
    await expect(session.saveDefault(['github'])).rejects.toThrow('disk full')
    expect(session.getState()).toMatchObject({ sources: ['arxiv'], defaults: ['arxiv'] })
    await session.saveDefault(['github'])
    expect(session.getState()).toMatchObject({
      sources: ['arxiv'],
      defaults: ['github'],
      note: CHANGED_DEFAULT_NOTE
    })
  })

  it('lets only the owning run start and end the running marker', () => {
    const session = new WebDiscoverSession({
      getDiscoverSourcePreference: vi.fn(),
      saveDiscoverSourcePreference: vi.fn()
    })
    expect(session.startRun('run-1')).toBe(true)
    // A second start (for example from a rebuilt view) is refused and cannot end the first.
    expect(session.startRun('run-2')).toBe(false)
    session.finishRun('run-2')
    expect(session.getState().activeRun).toBe('run-1')
    expect(session.running).toBe(true)
    session.finishRun('run-1')
    expect(session.getState().activeRun).toBeNull()
    expect(session.running).toBe(false)
  })
})

import { describe, expect, it, vi } from 'vitest'
import { NativePresentation, type NativeNode } from './presentation'
import { DiscoverScreen } from './discover'
import { SavedScreen } from './saved'
import { TriageHistory } from './reading'
import { nativeDiscoverFixture, nativeHarness } from './testSupport'

describe('Share and drag research out', () => {
  it('accepts only https links for row drags and Share buttons', () => {
    const view = new NativePresentation()
    const table = (drag: unknown) =>
      ({
        id: 'results',
        kind: 'table',
        title: 'Results',
        rows: [{ id: 'a', title: 'A', drag }]
      }) as unknown as NativeNode
    const button = (share: unknown) =>
      ({ id: 'share', kind: 'button', title: 'Share', share }) as unknown as NativeNode
    const link = { url: 'https://arxiv.org/abs/1', title: 'A', text: 'A. arXiv' }
    expect(JSON.parse(view.finish(table(link))).root.rows[0].drag).toEqual(link)
    expect(JSON.parse(view.finish(button({ url: link.url }))).root.share).toEqual({
      url: link.url
    })
    for (const url of ['http://example.com', 'javascript:alert(1)', 'file:///tmp/x', 'nope']) {
      expect(() => view.finish(table({ ...link, url }))).toThrow()
      expect(() => view.finish(button({ url }))).toThrow()
    }
    expect(() => view.finish(table({ ...link, text: 'x'.repeat(4001) }))).toThrow()
    expect(() =>
      view.finish({ id: 'label', kind: 'label', share: { url: link.url } } as unknown as NativeNode)
    ).toThrow()
  })

  it('lets Discover and Saved rows carry the link, title and citation', async () => {
    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => nativeDiscoverFixture) })
    const discover = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await discover.load()
    const item = nativeDiscoverFixture.items[0]!
    const row = h.find(h.render(discover), 'discover-results')?.rows?.[0]
    expect(row?.drag).toEqual({
      url: item.url,
      title: item.title,
      text: expect.stringMatching(
        new RegExp(`^${item.title}\\. arXiv\\. \\d{4}-\\d{2}-\\d{2}\\. https:`)
      )
    })
    discover.dispose()
    h.context.data.dashboard = {
      ...h.dashboard,
      savedItems: [
        { ...item, triageState: 'saved' },
        { ...item, id: 'unsafe', url: 'http://insecure.example/x', triageState: 'saved' }
      ]
    }
    const saved = new SavedScreen(h.context, new TriageHistory(h.context))
    const rows = h.find(h.render(saved), 'saved-items')?.rows
    expect(rows?.[0]?.drag?.url).toBe(item.url)
    expect(rows?.[1]?.drag, 'A non-https link is never draggable').toBeUndefined()
  })

  it('keeps long feed titles and links within the presentation bounds', async () => {
    const long = {
      ...nativeDiscoverFixture.items[0]!,
      title: 'T'.repeat(2500),
      url: `https://example.org/${'p'.repeat(1500)}`
    }
    const tooLong = { ...long, id: 'too-long', url: `https://example.org/${'p'.repeat(2100)}` }
    const h = nativeHarness({
      getLatestDiscover: vi.fn(async () => ({ ...nativeDiscoverFixture, items: [long, tooLong] }))
    })
    const screen = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await screen.load()
    const rows = h.find(h.render(screen), 'discover-results')?.rows
    expect(rows?.[0]?.drag?.title).toHaveLength(1000)
    expect(rows?.[0]?.drag?.text.length).toBeLessThanOrEqual(4000)
    expect(rows?.[1]?.drag, 'A link over 2048 characters is not dragged').toBeUndefined()
    screen.dispose()
  })
  it('offers Share in the reading actions for https links only', async () => {
    const h = nativeHarness({ getLatestDiscover: vi.fn(async () => nativeDiscoverFixture) })
    const discover = new DiscoverScreen(h.context, new TriageHistory(h.context))
    await discover.load()
    const share = h.find(h.render(discover), 'discover-share')
    expect(share).toMatchObject({
      kind: 'button',
      title: 'Share',
      symbol: 'square.and.arrow.up',
      share: { url: nativeDiscoverFixture.items[0]!.url }
    })
    discover.dispose()
    const unsafe = nativeHarness({
      getLatestDiscover: vi.fn(async () => ({
        ...nativeDiscoverFixture,
        items: nativeDiscoverFixture.items.map((entry) => ({ ...entry, url: 'http://x.example' }))
      }))
    })
    const screen = new DiscoverScreen(unsafe.context, new TriageHistory(unsafe.context))
    await screen.load()
    expect(unsafe.find(unsafe.render(screen), 'discover-share')).toBeUndefined()
    screen.dispose()
  })
})

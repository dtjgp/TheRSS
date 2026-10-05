import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { SETTINGS_SECTIONS, SettingsScreen } from './settings'
import { nativeHarness } from './testSupport'
import type { NativeNode } from './presentation'

const provider = {
  id: 'default',
  name: 'Original',
  protocol: 'openai-compatible' as const,
  baseUrl: 'https://model.invalid/v1',
  model: 'research',
  hasCredential: true,
  updatedAt: '2026-09-06'
}

describe('AppKit Settings', () => {
  it('switches panes without a pop-up and never repeats the pane name as a heading', async () => {
    const h = nativeHarness()
    const screen = new SettingsScreen(h.context)
    await screen.load()
    const headings = (node: NativeNode): string[] => [
      ...(node.kind === 'label' && node.weight === 'title' ? [node.text ?? ''] : []),
      ...(node.children ?? []).flatMap(headings)
    ]
    expect(screen.section).toBe('personal')
    for (const [section, form] of [
      ['personal', 'personal-form'],
      ['provider', 'provider-form']
    ] as const) {
      screen.select(section)
      const scene = h.render(screen)
      expect(screen.section).toBe(section)
      expect(h.find(scene, form)).toBeDefined()
      expect(h.find(scene, 'settings-tab')).toBeUndefined()
      expect(h.find(scene, 'settings-description')).toBeUndefined()
      expect(headings(scene)).not.toContain(SETTINGS_SECTIONS[section].title)
    }
    expect(headings(h.render(screen))).toContain('Local agents')
  })
  it('reports a successful save, credential clear and prompt save to its window', async () => {
    const changed = vi.fn()
    const h = nativeHarness({
      getModelProvider: vi.fn(async () => provider),
      saveModelProvider: vi.fn(async () => provider),
      clearModelProviderCredential: vi.fn(async () => ({ ...provider, hasCredential: false })),
      saveDiscoverPersonalizationPrompt: vi.fn(async (prompt) => ({ prompt, updatedAt: 'now' }))
    })
    const screen = new SettingsScreen(h.context, { changed })
    await screen.load()
    await h.act(screen, 'personal-prompt', 'Edge AI')
    await h.act(screen, 'personal-save')
    expect(changed).toHaveBeenCalledTimes(1)
    screen.select('provider')
    await h.act(screen, 'provider-save')
    expect(changed).toHaveBeenCalledTimes(2)
    await h.act(screen, 'provider-clear-key')
    expect(changed).toHaveBeenCalledTimes(3)
    // A rejected save changes nothing elsewhere.
    vi.mocked(h.api.saveModelProvider).mockRejectedValueOnce(new Error('rejected'))
    await h.act(screen, 'provider-save')
    expect(changed).toHaveBeenCalledTimes(3)
  })
  it('reports invalid fields beside their inputs, focuses the first error and clears only edited errors', async () => {
    const save = vi.fn()
    const h = nativeHarness({ saveModelProvider: save })
    const screen = new SettingsScreen(h.context)
    await screen.load()
    screen.select('provider')
    await h.act(screen, 'provider-url', 'file:///not-a-provider')
    await h.act(screen, 'provider-save')
    expect(save).not.toHaveBeenCalled()
    expect(h.find(h.render(screen), 'provider-name-error')?.text).toContain('name')
    expect(h.find(h.render(screen), 'provider-url-error')?.text).toContain('HTTPS')
    expect(h.find(h.render(screen), 'provider-model-error')?.text).toContain('model')
    expect(h.context.focus).toHaveBeenLastCalledWith('provider-name')
    await h.act(screen, 'provider-name', 'My model provider')
    expect(h.find(h.render(screen), 'provider-name-error')).toBeUndefined()
    expect(h.find(h.render(screen), 'provider-url-error')).toBeDefined()
    expect(h.find(h.render(screen), 'provider-save')?.emphasis).toBe('primary')
    expect(h.find(h.render(screen), 'provider-actions')?.children?.map((node) => node.id)).toEqual([
      'provider-save',
      'provider-test'
    ])
  })
  it('retains both drafts and preserves dirty state after saving one section', async () => {
    const h = nativeHarness({
      getModelProvider: vi.fn(async () => provider),
      saveDiscoverPersonalizationPrompt: vi.fn(async (prompt) => ({ prompt, updatedAt: 'now' }))
    })
    const screen = new SettingsScreen(h.context)
    await screen.load()
    await h.act(screen, 'personal-prompt', 'Research focus')
    screen.select('provider')
    await h.act(screen, 'provider-name', 'Edited')
    screen.select('personal')
    expect(h.find(h.render(screen), 'personal-prompt')?.value).toBe('Research focus')
    await h.act(screen, 'personal-save')
    expect(h.api.setSettingsDirty).toHaveBeenLastCalledWith(true)
    screen.discard()
    expect(h.api.setSettingsDirty).toHaveBeenLastCalledWith(false)
    screen.select('provider')
    expect(h.find(h.render(screen), 'provider-name')?.value).toBe('Original')
  })

  it('sends new credentials only to the bounded provider operation and clears native input after save', async () => {
    const fixtureCredential = randomUUID()
    const save = vi.fn(async () => provider)
    const test = vi.fn(async () => ({
      status: 'connected' as const,
      message: 'Fixture',
      testedAt: 'now'
    }))
    const h = nativeHarness({
      getModelProvider: vi.fn(async () => provider),
      saveModelProvider: save,
      testModelProvider: test
    })
    const screen = new SettingsScreen(h.context)
    await screen.load()
    screen.select('provider')
    await h.act(screen, 'provider-key', fixtureCredential, true)
    expect(JSON.stringify(h.render(screen))).not.toContain(fixtureCredential)
    await h.act(screen, 'provider-test')
    expect(test).toHaveBeenCalledWith(expect.objectContaining({ apiKey: fixtureCredential }))
    expect(save).not.toHaveBeenCalled()
    const before = h.find(h.render(screen), 'provider-key')?.clearRevision
    await h.act(screen, 'provider-save')
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ apiKey: fixtureCredential }))
    expect(h.find(h.render(screen), 'provider-key')?.clearRevision).toBeGreaterThan(before!)
    expect(h.api.setSettingsDirty).toHaveBeenLastCalledWith(false)
  })

  it('requires replacement or explicit clearing when a protected credential changes endpoint', async () => {
    const save = vi.fn(async () => provider)
    const clear = vi.fn(async () => ({ ...provider, hasCredential: false }))
    const h = nativeHarness({
      getModelProvider: vi.fn(async () => provider),
      saveModelProvider: save,
      clearModelProviderCredential: clear
    })
    const screen = new SettingsScreen(h.context)
    await screen.load()
    screen.select('provider')
    await h.act(screen, 'provider-url', 'https://another.invalid')
    await h.act(screen, 'provider-save')
    expect(save).not.toHaveBeenCalled()
    expect(JSON.stringify(h.render(screen))).toContain('replacement credential')
    await h.act(screen, 'provider-clear-key')
    expect(clear).toHaveBeenCalledOnce()
    await h.act(screen, 'provider-save')
    expect(save).toHaveBeenCalledOnce()
  })
})

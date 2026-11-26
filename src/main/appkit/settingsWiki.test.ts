import { describe, expect, it, vi } from 'vitest'
import type { LlmWikiVaultDiagnostics } from '../../shared/llmWikiSettings'
import type { NativeNode, NativeToolbar } from './presentation'
import { SETTINGS_SECTIONS, SettingsScreen } from './settings'
import { NativeSettingsPresenter } from './settingsPresenter'
import { nativeHarness } from './testSupport'

function diagnosticsFixture(
  overrides: Partial<LlmWikiVaultDiagnostics> = {}
): LlmWikiVaultDiagnostics {
  return {
    resolvedPath: '/Users/researcher/Obsidian/llm-wiki',
    origin: 'default',
    customPath: null,
    defaultPath: '/Users/researcher/Obsidian/llm-wiki',
    envOverridePath: null,
    status: 'ready',
    checkedAt: '2026-11-21T10:30:00.000Z',
    checks: [
      {
        id: 'vault-root',
        label: 'Vault folder exists',
        status: 'ok',
        detail: 'Readable directory found.',
        remediation: null
      },
      {
        id: 'schema-files',
        label: 'Required vault docs',
        status: 'ok',
        detail: 'AGENTS.md and _schema.md found.',
        remediation: null
      }
    ],
    ...overrides
  }
}

describe('AppKit Settings Knowledge Base (P1-6)', () => {
  it('exposes the Knowledge Base pane in SETTINGS_SECTIONS and the preference toolbar without repeating the pane heading', async () => {
    expect(SETTINGS_SECTIONS.wiki).toEqual({ title: 'Knowledge Base', symbol: 'square.stack' })

    const h = nativeHarness({
      getLocalAgentStatuses: vi.fn(async () => []),
      getLlmWikiSettings: vi.fn(async () => diagnosticsFixture())
    })
    let sceneJson = ''
    const presenter = new NativeSettingsPresenter(h.api, {
      present: (next) => {
        sceneJson = next
      },
      openExternal: vi.fn(),
      changed: vi.fn()
    })
    try {
      await presenter.start()
      const initial = JSON.parse(sceneJson) as { root: NativeNode; toolbar: NativeToolbar }
      expect(initial.toolbar.items.map((item) => [item.id, item.title, item.symbol])).toEqual([
        ['settings-personal', 'Personal Context', 'person.crop.circle'],
        ['settings-provider', 'Model Provider', 'cpu'],
        ['settings-wiki', 'Knowledge Base', 'square.stack']
      ])

      presenter.select('wiki')
      await Promise.resolve()
      const wikiScene = JSON.parse(sceneJson) as { root: NativeNode; toolbar: NativeToolbar }
      expect(wikiScene.toolbar).toMatchObject({
        title: 'Knowledge Base',
        selected: 'settings-wiki'
      })
      expect(h.find(wikiScene.root, 'wiki-form')).toBeDefined()
      expect(h.find(wikiScene.root, 'settings-scroll')?.fitWindow).toBe(true)

      const titleHeadings = (node: NativeNode): string[] => [
        ...(node.kind === 'label' && node.weight === 'title' ? [node.text ?? ''] : []),
        ...(node.children ?? []).flatMap(titleHeadings)
      ]
      expect(titleHeadings(wikiScene.root)).not.toContain('Knowledge Base')
    } finally {
      presenter.dispose()
    }
  })

  it('displays resolved path, origin, status, env override note, and diagnostic remediation hints', async () => {
    const diagnostics = diagnosticsFixture({
      resolvedPath: '/Volumes/Research/env-wiki',
      origin: 'env',
      customPath: '/Users/researcher/CustomWiki',
      envOverridePath: '/Volumes/Research/env-wiki',
      status: 'incomplete',
      checks: [
        {
          id: 'vault-root',
          label: 'Vault folder exists',
          status: 'ok',
          detail: 'Directory exists.',
          remediation: null
        },
        {
          id: 'paper-notes',
          label: 'Literature/Paper_Notes folder',
          status: 'warning',
          detail: 'Literature/Paper_Notes is missing.',
          remediation: 'Create Literature/Paper_Notes inside the llm-wiki vault.'
        }
      ]
    })

    const h = nativeHarness({
      getLlmWikiSettings: vi.fn(async () => diagnostics)
    })
    const screen = new SettingsScreen(h.context)
    await screen.load()
    screen.select('wiki')
    const scene = h.render(screen)

    expect(h.find(scene, 'wiki-status')?.text).toBe('Status: Incomplete · Environment override')
    expect(h.find(scene, 'wiki-resolved-path')?.text).toContain('/Volumes/Research/env-wiki')
    expect(h.find(scene, 'wiki-checked-at')?.text).toContain('Checked')
    expect(h.find(scene, 'wiki-env-note')?.text).toContain('THERSS_LLM_WIKI_PATH')

    expect(h.find(scene, 'wiki-check-vault-root-title')?.text).toBe('OK · Vault folder exists')
    expect(h.find(scene, 'wiki-check-vault-root-remediation')).toBeUndefined()
    expect(h.find(scene, 'wiki-check-paper-notes-title')?.text).toBe(
      'Warning · Literature/Paper_Notes folder'
    )
    expect(h.find(scene, 'wiki-check-paper-notes-remediation')?.text).toContain(
      'Create Literature/Paper_Notes'
    )
    screen.dispose()
  })

  it('chooses a custom folder, ignores canceled dialogs, resets to default, and rechecks diagnostics', async () => {
    const initial = diagnosticsFixture()
    const custom = diagnosticsFixture({
      resolvedPath: '/Users/researcher/CustomVault',
      origin: 'custom',
      customPath: '/Users/researcher/CustomVault'
    })
    const rechecked = diagnosticsFixture({
      status: 'unavailable',
      checks: [
        {
          id: 'vault-root',
          label: 'Vault folder exists',
          status: 'error',
          detail: 'Folder not found.',
          remediation: 'Choose an existing llm-wiki folder.'
        }
      ]
    })

    const getLlmWikiSettings = vi
      .fn<() => Promise<LlmWikiVaultDiagnostics>>()
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(rechecked)
      .mockResolvedValueOnce(initial)
    const chooseLlmWikiVaultFolder = vi
      .fn()
      .mockResolvedValueOnce({ canceled: true, path: null })
      .mockResolvedValueOnce({ canceled: false, path: '/Users/researcher/CustomVault' })
    const saveLlmWikiVaultPath = vi
      .fn()
      .mockResolvedValueOnce(custom)
      .mockResolvedValueOnce(initial)
    const changed = vi.fn()

    const h = nativeHarness({
      getLlmWikiSettings,
      chooseLlmWikiVaultFolder,
      saveLlmWikiVaultPath
    })
    const screen = new SettingsScreen(h.context, { changed })
    await screen.load()
    screen.select('wiki')

    // Initially using default folder -> Use default folder button is disabled.
    expect(h.find(h.render(screen), 'wiki-use-default')?.enabled).toBe(false)

    // Canceled folder picker makes no save call and does not fire changed().
    await h.act(screen, 'wiki-choose-folder')
    expect(chooseLlmWikiVaultFolder).toHaveBeenCalledTimes(1)
    expect(saveLlmWikiVaultPath).not.toHaveBeenCalled()
    expect(changed).not.toHaveBeenCalled()

    // Confirmed folder picker saves path, updates diagnostics, enables Use default, and fires changed('wiki').
    await h.act(screen, 'wiki-choose-folder')
    expect(saveLlmWikiVaultPath).toHaveBeenCalledWith('/Users/researcher/CustomVault')
    expect(changed).toHaveBeenCalledTimes(1)
    expect(changed).toHaveBeenLastCalledWith('wiki')
    const afterChoose = h.render(screen)
    expect(h.find(afterChoose, 'wiki-status')?.text).toBe('Status: Ready · Custom folder')
    expect(h.find(afterChoose, 'wiki-use-default')?.enabled).toBe(true)

    // Use default folder clears customPath and notifies changed('wiki').
    await h.act(screen, 'wiki-use-default')
    expect(saveLlmWikiVaultPath).toHaveBeenLastCalledWith(null)
    expect(changed).toHaveBeenCalledTimes(2)
    expect(h.find(h.render(screen), 'wiki-use-default')?.enabled).toBe(false)

    // Recheck vault with unchanged status/path does not trigger unnecessary changed() broadcasts.
    await h.act(screen, 'wiki-recheck')
    expect(getLlmWikiSettings).toHaveBeenCalledTimes(2)
    expect(changed).toHaveBeenCalledTimes(2)

    // Recheck vault transitioning ready -> unavailable and unavailable -> ready notifies changed('wiki')
    // so cached unavailable list badges recover when the user fixes the vault.
    await h.act(screen, 'wiki-recheck')
    expect(getLlmWikiSettings).toHaveBeenCalledTimes(3)
    expect(changed).toHaveBeenCalledTimes(3)
    expect(changed).toHaveBeenLastCalledWith('wiki')
    expect(h.find(h.render(screen), 'wiki-status')?.text).toBe(
      'Status: Unavailable · Default folder'
    )
    await h.act(screen, 'wiki-recheck')
    expect(getLlmWikiSettings).toHaveBeenCalledTimes(4)
    expect(changed).toHaveBeenCalledTimes(4)
    expect(h.find(h.render(screen), 'wiki-status')?.text).toBe('Status: Ready · Default folder')
    screen.dispose()
  })

  it('isolates Knowledge Base load errors without breaking Personal Context or Model Provider', async () => {
    const h = nativeHarness({
      getLlmWikiSettings: vi.fn(async () => {
        throw new Error('Permission denied on vault')
      })
    })
    const screen = new SettingsScreen(h.context)
    await screen.load()

    // Personal Context remains loaded and editable.
    expect(h.find(h.render(screen), 'personal-prompt')?.enabled).toBe(true)
    expect(h.find(h.render(screen), 'settings-retry')).toBeUndefined()

    // Knowledge Base displays the bounded error and allows retry.
    screen.select('wiki')
    const scene = h.render(screen)
    expect(h.find(scene, 'wiki-message')?.text).toContain('Permission denied on vault')
    expect(h.find(scene, 'wiki-recheck')?.enabled).toBe(true)
    screen.dispose()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { NativeSettingsPresenter } from './settingsPresenter'
import { nativeHarness } from './testSupport'
import type { NativeNode, NativeToolbar } from './presentation'

type Scene = { root: NativeNode; modal?: NativeNode; toolbar: NativeToolbar; zoom: number }

function settingsWindow(overrides: Parameters<typeof nativeHarness>[0] = {}) {
  const h = nativeHarness({
    getLocalAgentStatuses: vi.fn(async () => [
      { runner: 'codex' as const, label: 'Codex CLI', available: true }
    ]),
    ...overrides
  })
  let scene = ''
  const changed = vi.fn()
  const presenter = new NativeSettingsPresenter(h.api, {
    present: (next) => {
      scene = next
    },
    openExternal: vi.fn(),
    changed
  })
  return { h, presenter, changed, scene: (): Scene => JSON.parse(scene) as Scene }
}

describe('Settings window', () => {
  it('switches panes from a preference toolbar that names the selected pane', async () => {
    const { h, presenter, scene } = settingsWindow()
    await presenter.start()
    let parsed = scene()
    expect(parsed.toolbar).toMatchObject({
      title: 'Personal Context',
      style: 'preference',
      selected: 'settings-personal'
    })
    expect(parsed.toolbar.items.map((item) => [item.id, item.title, item.symbol])).toEqual([
      ['settings-personal', 'Personal Context', 'person.crop.circle'],
      ['settings-provider', 'Model Provider', 'cpu']
    ])
    expect(h.find(parsed.root, 'personal-form')).toBeDefined()
    expect(h.find(parsed.root, 'settings-tab')).toBeUndefined()
    await presenter.presentation.dispatch(
      JSON.stringify({ action: parsed.toolbar.items[1]!.action })
    )
    await Promise.resolve()
    parsed = scene()
    expect(parsed.toolbar).toMatchObject({
      title: 'Model Provider',
      selected: 'settings-provider'
    })
    expect(h.find(parsed.root, 'provider-form')).toBeDefined()
    // Agent availability is loaded for this window, not borrowed from the main window.
    expect(h.find(parsed.root, 'agent-status-codex')?.text).toBe('Codex CLI: Available')
    presenter.select('personal')
    await Promise.resolve()
    expect(scene().toolbar.selected).toBe('settings-personal')
    presenter.dispose()
  })

  it('opens on a requested pane, keeps its own zoom and ignores workspace commands', async () => {
    const { h, presenter, scene } = settingsWindow()
    presenter.select('provider')
    await presenter.start()
    expect(scene().toolbar.selected).toBe('settings-provider')
    presenter.zoom('in')
    await Promise.resolve()
    expect(scene().zoom).toBeGreaterThan(1)
    await presenter.command('save-selected')
    await presenter.command('show-saved')
    expect(h.find(scene().root, 'provider-form')).toBeDefined()
    presenter.dispose()
  })

  it('reports saved changes to the application and shows connection details as a sheet', async () => {
    const { h, presenter, changed, scene } = settingsWindow({
      saveDiscoverPersonalizationPrompt: vi.fn(async (prompt: string) => ({
        prompt,
        updatedAt: 'now'
      })),
      testModelProvider: vi.fn(async () => ({
        status: 'connected' as const,
        message: 'Fixture connection',
        testedAt: 'now'
      }))
    })
    await presenter.start()
    const act = async (id: string, value?: string) => {
      const { root, modal } = scene()
      const node = h.find(root, id) ?? (modal ? h.find(modal, id) : undefined)
      await presenter.presentation.dispatch(
        JSON.stringify({ action: node!.action, ...(value === undefined ? {} : { value }) })
      )
      await Promise.resolve()
    }
    await act('personal-prompt', 'Edge AI')
    await act('personal-save')
    expect(changed).toHaveBeenCalledOnce()
    presenter.select('provider')
    await Promise.resolve()
    await act('provider-name', 'Fixture')
    await act('provider-url', 'https://fixture.invalid/v1')
    await act('provider-model', 'fixture-model')
    await act('provider-test')
    await act('provider-connection-details')
    expect(h.find(scene().modal!, 'document-modal-content')?.text).toContain('Fixture connection')
    await act('modal-close')
    expect(scene().modal).toBeUndefined()
    expect(changed).toHaveBeenCalledOnce()
    presenter.dispose()
  })
})

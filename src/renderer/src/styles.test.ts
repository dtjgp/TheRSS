import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const stylesheet = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('Apple semantic color system', () => {
  it('defines native light and dark semantic roles instead of legacy palette names', () => {
    const lightTokens = [
      '--label: #1d1d1f;',
      '--secondary-label: #626267;',
      '--system-background: #ffffff;',
      '--secondary-system-background: #f2f2f7;',
      '--system-grouped-background: #f2f2f7;',
      '--secondary-system-grouped-background: #ffffff;',
      '--separator: rgba(60, 60, 67, 0.29);',
      '--system-blue: #007aff;',
      '--system-green: #34c759;',
      '--system-orange: #ff9500;',
      '--system-red: #ff3b30;',
      '--system-indigo: #5856d6;',
      '--system-purple: #af52de;',
      '--system-cyan: #32ade6;',
      '--system-blue-text: #0057b8;',
      '--system-green-text: #176b2c;',
      '--system-red-text: #b42318;'
    ]
    const darkTokens = [
      '--label: #f5f5f7;',
      '--secondary-label: #a9a9af;',
      '--system-background: #000000;',
      '--secondary-system-background: #1c1c1e;',
      '--system-blue: #0a84ff;',
      '--system-green: #30d158;',
      '--system-orange: #ff9f0a;',
      '--system-red: #ff453a;'
    ]

    lightTokens.forEach((token) => expect(stylesheet).toContain(token))
    darkTokens.forEach((token) => expect(stylesheet).toContain(token))
    expect(stylesheet).not.toContain('--forest:')
    expect(stylesheet).not.toContain('--signal:')
    expect(stylesheet).not.toContain('#fffdf8')
    expect(stylesheet).not.toContain('rgba(255, 252, 246')
  })

  it('maps every primary interface to a restrained native system tint', () => {
    const viewMappings = [
      ".app-shell[data-view='today']",
      ".app-shell[data-view='saved']",
      ".app-shell[data-view='discover']",
      ".app-shell[data-view='interests']",
      ".app-shell[data-view='models']",
      ".app-shell[data-view='analytics']"
    ]

    viewMappings.forEach((selector) => expect(stylesheet).toContain(selector))
    expect(stylesheet).toContain('--view-accent: var(--system-blue);')
    expect(stylesheet).toContain('--view-accent: var(--saved-accent);')
    expect(stylesheet).toContain('--view-accent: var(--system-indigo);')
    expect(stylesheet).toContain('--view-accent: var(--system-teal);')
    expect(stylesheet).toContain('--view-accent: var(--system-purple);')
    expect(stylesheet).toContain('--view-accent: var(--system-cyan);')
  })

  it('uses semantic grouped surfaces for every non-inbox workspace', () => {
    expect(stylesheet).toContain('background: var(--secondary-system-grouped-background);')
    expect(stylesheet).toContain('background: var(--tertiary-system-fill);')
    expect(stylesheet).toContain('color: var(--secondary-label);')
    expect(stylesheet).toContain('border-color: var(--separator);')
  })

  it('keeps the collapsed sidebar divider clear of the macOS traffic lights', () => {
    expect(stylesheet).toMatch(
      /\.app-shell--sidebar-collapsed\s*\{[^}]*grid-template-columns:\s*84px minmax\(0, 1fr\)/u
    )
    expect(stylesheet).not.toMatch(
      /\.app-shell--sidebar-collapsed\s*\{[^}]*grid-template-columns:\s*68px/u
    )
  })

  it('keeps long Discover sessions inside a keyboard-scrollable result region', () => {
    expect(stylesheet).toMatch(
      /\.discover-result-list\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;[^}]*scrollbar-gutter:\s*stable;/su
    )
    expect(stylesheet).toMatch(
      /\.discover-result-list\s*>\s*\.today-view__heading\s*\{[^}]*position:\s*sticky;/su
    )
  })

  it('keeps Personal Prompt settings in one column on desktop layouts', () => {
    expect(stylesheet).toMatch(
      /\.model-editor\s+\.personalization-form\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/su
    )
  })
})

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const stylesheet = [
  './styles.css',
  './styles/settings.css',
  './styles/discover.css',
  './styles/analytics.css',
  './styles/sources.css',
  './styles/workspace.css',
  './styles/accessibility.css'
]
  .map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'))
  .join('\n')
const rendererEntry = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8')
const packageMetadata = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')
) as { dependencies?: Record<string, string> }
const packageLock = readFileSync(new URL('../../../package-lock.json', import.meta.url), 'utf8')

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
      ".app-shell[data-view='settings']",
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

  it('keeps Personal Prompt controls on the full Settings panel width', () => {
    expect(stylesheet).toMatch(
      /\.settings-panel\s+form\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/su
    )
    expect(stylesheet).toMatch(/\.settings-panel\s+\.field--wide[^}]*grid-column:\s*1\s*\/\s*-1/su)
  })

  it('gives the Discover source summary a full row at the minimum desktop width', () => {
    const narrowStart = stylesheet.indexOf('@media (max-width: 920px)')
    const narrowEnd = stylesheet.indexOf('@media (prefers-color-scheme: dark)')
    const narrowRules = stylesheet.slice(narrowStart, narrowEnd)

    expect(narrowRules).toMatch(
      /\.discover-controls\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/su
    )
    expect(narrowRules).toMatch(/\.discover-source-picker\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/su)
  })

  it('uses an opaque placeholder token with normal-text contrast in both appearances', () => {
    const contrastRatio = (foreground: string, background: string): number => {
      const luminance = (hex: string) => {
        const channels = hex
          .slice(1)
          .match(/.{2}/gu)!
          .map((value) => Number.parseInt(value, 16) / 255)
          .map((value) =>
            value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
          )
        return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
      }
      const foregroundLuminance = luminance(foreground)
      const backgroundLuminance = luminance(background)
      return (
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
      )
    }

    expect(stylesheet).toContain('--placeholder-label: #626267;')
    expect(stylesheet).toContain('--placeholder-label: #a9a9af;')
    expect(stylesheet).toMatch(
      /input::placeholder,\s*textarea::placeholder\s*\{[^}]*color:\s*var\(--placeholder-label\);[^}]*opacity:\s*1;/su
    )
    expect(contrastRatio('#626267', '#f2f2f7')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#a9a9af', '#2c2c2e')).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps large-result and Saved triage controls compact and visible', () => {
    const discoverSummaryRule = stylesheet.match(/\.discover-card__summary\s*\{([^}]*)\}/su)?.[1]
    const savedSummaryRule = stylesheet.match(
      /\.signal-detail__summary\[data-expanded='false'\]\s*\{([^}]*)\}/su
    )?.[1]
    expect(discoverSummaryRule).toContain('-webkit-line-clamp: 3;')
    expect(discoverSummaryRule).toContain('overflow: hidden;')
    expect(stylesheet).toMatch(
      /\.discover-result-pagination\s*\{[^}]*position:\s*sticky;[^}]*bottom:\s*0;/su
    )
    expect(stylesheet).toMatch(
      /\.signal-detail__actions\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/su
    )
    expect(savedSummaryRule).toContain('-webkit-line-clamp: 6;')
    expect(savedSummaryRule).toContain('overflow: hidden;')
  })

  it('uses only Apple system typography without bundled third-party font assets', () => {
    const fontFamilyDeclarations = Array.from(
      stylesheet.matchAll(/font-family:\s*([^;]+);/gu),
      (match) => match[1]?.trim()
    )

    expect(stylesheet).toMatch(
      /--font-apple-text:\s*-apple-system,\s*BlinkMacSystemFont,\s*'SF Pro Text',\s*'Helvetica Neue',\s*sans-serif;/u
    )
    expect(stylesheet).toMatch(
      /--font-apple-display:\s*'SF Pro Display',\s*-apple-system,\s*BlinkMacSystemFont,\s*'Helvetica Neue',\s*sans-serif;/u
    )
    expect(new Set(fontFamilyDeclarations)).toEqual(
      new Set(['var(--font-apple-text)', 'var(--font-apple-display)', 'inherit'])
    )
    expect(stylesheet).not.toMatch(/Newsreader|IBM Plex Sans/u)
    expect(rendererEntry).not.toContain('@fontsource/')
    expect(packageMetadata.dependencies).not.toHaveProperty('@fontsource/ibm-plex-sans')
    expect(packageMetadata.dependencies).not.toHaveProperty('@fontsource/newsreader')
    expect(packageLock).not.toContain('node_modules/@fontsource/')
  })

  it('supports increased contrast and forced colors without hiding focus or state', () => {
    expect(stylesheet).toContain('@media (prefers-contrast: more)')
    expect(stylesheet).toContain('@media (forced-colors: active)')
    expect(stylesheet).toMatch(
      /@media \(prefers-contrast: more\)[\s\S]*--separator:\s*rgba\(60,\s*60,\s*67,\s*0\.62\);/u
    )
    expect(stylesheet).toMatch(
      /@media \(forced-colors: active\)[\s\S]*\.status-dot[\s\S]*background:\s*CanvasText;/u
    )
    expect(stylesheet).toMatch(
      /@media \(forced-colors: active\)[\s\S]*:focus-visible[\s\S]*outline:\s*3px solid Highlight;/u
    )
  })

  it('keeps critical uppercase metadata at an 11px minimum', () => {
    for (const selector of [
      '.eyebrow',
      '.source-catalog-controls label > span',
      '.analytics-summary-card > span'
    ]) {
      const escaped = selector.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&')
      const rule = stylesheet.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'su'))?.[1]
      expect(rule, selector).toBeDefined()
      expect(rule, selector).not.toMatch(/font-size:\s*(?:8|9|10)px;/u)
    }
  })
})

import { describe, expect, it } from 'vitest'
import {
  llmWikiFolderChoiceSchema,
  llmWikiVaultDiagnosticsSchema,
  llmWikiVaultPathInputSchema,
  llmWikiVaultPathSchema
} from './llmWikiSettings'

describe('llmWikiSettings schemas', () => {
  it('accepts valid absolute paths, normalizes trailing slashes, and allows null reset', () => {
    expect(llmWikiVaultPathSchema.parse('/Users/alice/Obsidian/llm-wiki/')).toBe(
      '/Users/alice/Obsidian/llm-wiki'
    )
    expect(llmWikiVaultPathSchema.parse('/')).toBe('/')
    expect(llmWikiVaultPathSchema.parse(null)).toBeNull()
    expect(llmWikiVaultPathInputSchema.parse({ vaultPath: null })).toEqual({ vaultPath: null })
  })

  it.each([
    ['relative path', 'Obsidian/llm-wiki'],
    ['dot-relative path', './llm-wiki'],
    ['parent traversal', '/Users/alice/../etc'],
    ['blank string', '   '],
    ['leading tab control', '\t/Users/alice/llm-wiki'],
    ['trailing tab control', '/Users/alice/llm-wiki\t'],
    ['embedded NUL control', '/Users/alice/\u0000llm-wiki'],
    ['C1 control character', '/Users/alice/\u0085llm-wiki'],
    ['bidi override format character', '/Users/alice/\u202ellm-wiki'],
    ['zero-width format character', '/Users/alice/\u200bllm-wiki'],
    ['overlong path', `/${'a'.repeat(1_000)}`],
    ['space-padded overlong path', ` ${'/' + 'a'.repeat(999)} `]
  ])('rejects invalid vault path (%s)', (_label, candidate) => {
    expect(() => llmWikiVaultPathSchema.parse(candidate)).toThrow()
  })

  it('validates structured diagnostics and folder-picker responses', () => {
    const diagnostics = llmWikiVaultDiagnosticsSchema.parse({
      resolvedPath: '/Users/alice/Obsidian/llm-wiki',
      origin: 'custom',
      customPath: '/Users/alice/Obsidian/llm-wiki',
      defaultPath: '/Users/alice/Obsidian/default-wiki',
      envOverridePath: null,
      status: 'ready',
      checkedAt: '2026-11-21T20:00:00.000Z',
      checks: [
        {
          id: 'vault-root',
          label: 'Vault folder',
          status: 'ok',
          detail: 'Directory exists and is not a symlink.',
          remediation: null
        }
      ]
    })
    expect(diagnostics.status).toBe('ready')
    expect(llmWikiFolderChoiceSchema.parse({ canceled: true, path: null })).toEqual({
      canceled: true,
      path: null
    })
  })
})

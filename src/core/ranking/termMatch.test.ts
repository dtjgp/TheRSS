import { describe, expect, it } from 'vitest'
import { includesWholeTerm, termsShareWholeCue } from './termMatch'

describe('includesWholeTerm', () => {
  it.each([
    ['LLMs', 'llm'],
    ['Transformers', 'transformer'],
    ['surveys', 'survey'],
    ['batches', 'batch'],
    ['基于LLM的推荐系统', 'llm'],
    ['AI驱动的需求响应', 'ai'],
    ['LLMモデル', 'llm'],
    ['LLM기반', 'llm'],
    ['low-rank', 'low rank'],
    ['low rank', 'low-rank'],
    ['low‐rank', 'low–rank'],
    ['low–rank', 'low‐rank'],
    ['low \t– rank', 'low rank'],
    ['carbon\nintensity', 'carbon intensity'],
    ['carbon intensity', 'carbon\nintensity'],
    ['low-rank models', 'low rank model'],
    ['结构化通道剪枝', '剪枝'],
    ['C++', 'c++']
  ])('matches %j against %j', (value, term) => {
    expect(includesWholeTerm(value, term)).toBe(true)
  })

  it.each([
    ['address', 'dr'],
    ['every', 'ev'],
    ['paid', 'ai'],
    ['robotics', 'robot'],
    ['TransformersExtra', 'transformer'],
    ['基于LLMx的推荐系统', 'llm'],
    ['GPT-4s', 'gpt-4'],
    ['C++s', 'c++'],
    ['lowrank', 'low rank'],
    ['low/rank', 'low rank'],
    ['x', ' '],
    ['low rank', '-rank'],
    ['low rank', 'low-']
  ])('rejects %j against %j', (value, term) => {
    expect(includesWholeTerm(value, term)).toBe(false)
  })
})

describe('termsShareWholeCue', () => {
  it.each([
    ['deadline-aware scheduling', 'deadline aware scheduling'],
    ['low‐rank', 'low–rank'],
    ['llm', 'llms'],
    ['llms', 'llm'],
    ['batch', 'batches'],
    ['low-rank models', 'low rank model'],
    ['Energy', 'energy'],
    ['边缘计算', '边缘计算'],
    ['基于LLM的推荐', '基于llm的推荐']
  ])('treats %j and %j as the same whole cue', (left, right) => {
    expect(termsShareWholeCue(left, right)).toBe(true)
  })

  it.each([
    ['energy', 'energy efficiency'],
    ['llm', 'llm pruning'],
    ['边缘计算', '边缘'],
    ['c++', 'c++s'],
    ['edge', 'pruning'],
    ['', 'llm']
  ])('keeps %j and %j distinct', (left, right) => {
    expect(termsShareWholeCue(left, right)).toBe(false)
  })
})

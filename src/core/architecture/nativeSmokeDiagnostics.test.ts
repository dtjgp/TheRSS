import { describe, expect, it } from 'vitest'
import { classifyNativeSmokeStderr } from '../../../scripts/native-smoke-diagnostics.mjs'

const category =
  '[4666:0906/190712.864771:ERROR:base/process/process_mac.cc:53] task_policy_set TASK_CATEGORY_POLICY: (os/kern) invalid argument (4)'
const suppression =
  '[4666:0906/190712.864868:ERROR:base/process/process_mac.cc:98] task_policy_set TASK_SUPPRESSION_POLICY: (os/kern) invalid argument (4)'

describe('native smoke stderr classification', () => {
  it('retains the two exact observed process-policy diagnostics separately', () => {
    expect(classifyNativeSmokeStderr([category + '\n' + suppression + '\n'])).toEqual({
      applicationErrors: [],
      platformDiagnostics: [category, suppression]
    })
  })
  it('fails application errors even when they share a chunk with a known diagnostic', () => {
    const fatal = 'Uncaught TypeError: broken native action'
    expect(classifyNativeSmokeStderr([category + '\n' + fatal + '\n']).applicationErrors).toEqual([
      fatal
    ])
  })
  it('assembles partial chunks and preserves the known input-method diagnostic', () => {
    const input =
      '2026-09-06 19:07:12.123 TheRSS[123:456] error messaging the mach port for IMKCFRunLoopWakeUpReliable'
    const result = classifyNativeSmokeStderr([
      category.slice(0, 45),
      category.slice(45) + '\n',
      input + '\n'
    ])
    expect(result.platformDiagnostics).toEqual([category, input])
    expect(result.applicationErrors).toEqual([])
  })
  it('does not hide different kernel errors, spoofed prefixes or additional suffixes', () => {
    const unknown = [
      category.replace('(4)', '(5)'),
      'Other: ' + category,
      category + ' Uncaught failure'
    ]
    expect(classifyNativeSmokeStderr([unknown.join('\n')]).applicationErrors).toEqual(unknown)
  })
})

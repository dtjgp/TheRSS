import { resolve } from 'node:path'
import { findOversizedSourceFiles } from '../src/core/architecture/sourceFilePolicy.ts'

const MAX_SOURCE_LINES = 800
const sourceRoot = resolve(process.cwd(), 'src')
const violations = await findOversizedSourceFiles(sourceRoot, MAX_SOURCE_LINES)

if (violations.length === 0) {
  process.stdout.write(
    `Architecture policy passed: all owned source files are <= ${MAX_SOURCE_LINES} lines.\n`
  )
} else {
  process.stderr.write(
    `Architecture policy failed: ${violations.length} owned source file(s) exceed ${MAX_SOURCE_LINES} lines.\n`
  )
  for (const violation of violations) {
    process.stderr.write(`- src/${violation.path}: ${violation.lines} lines\n`)
  }
  process.exitCode = 1
}

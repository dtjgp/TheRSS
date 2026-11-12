/* global console, process */
// Read-only check of test-results/sidebar-diagnostics/: for each failure directory, the record and
// the archive status share the correlation ID, the archived trace exists, its SHA-256 matches the
// status file, and `unzip -l` can list it. Prints one JSON summary; exit 1 if a check fails.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = 'test-results/sidebar-diagnostics'
const directories = existsSync(root) ? readdirSync(root).sort() : []
let ok = directories.length > 0
const results = directories.map((name) => {
  const directory = join(root, name)
  const result = { directory }
  try {
    const record = JSON.parse(readFileSync(join(directory, 'diagnostics.json'), 'utf8'))
    const status = JSON.parse(readFileSync(join(directory, 'trace-archive.json'), 'utf8'))
    const trace = join(directory, 'trace.zip')
    const content = readFileSync(trace)
    const listing = execFileSync('unzip', ['-l', trace], { encoding: 'utf8' })
    const entries = listing
      .split('\n')
      .map((line) => line.trim().split(/\s+/u).slice(3).join(' '))
      .filter((entry) => /\.(trace|network|stacks)$/u.test(entry))
    const rendererEvents = record.events.filter((event) => event.source === 'renderer')
    Object.assign(result, {
      correlationId: record.correlationId,
      statusCorrelationId: status.correlationId,
      correlated: record.correlationId === status.correlationId && status.recordMatches === true,
      directoryHasIdPrefix: name.endsWith(record.correlationId.slice(0, 8)),
      // Reported separately from `passed`: records written before the path fix keep absolute paths.
      pathsSanitized: ['diagnostics.json', 'trace-archive.json'].every(
        (file) =>
          !/\/Users\/|\/var\/folders\/|\/private\//u.test(
            readFileSync(join(directory, file), 'utf8')
          )
      ),
      state: status.state,
      sourceTrace: status.sourceTrace,
      bytes: content.length,
      sha256Matches: createHash('sha256').update(content).digest('hex') === status.sha256,
      sourceSha256Matches: status.sha256 === status.sourceSha256,
      traceEntries: entries,
      rendererEvents: rendererEvents.length,
      rendererEventsWithSourceTime: rendererEvents.filter(
        (event) =>
          typeof event.sourceTimeStamp === 'number' && typeof event.sourceEpochMs === 'number'
      ).length,
      documents: [...new Set(rendererEvents.map((event) => event.sourceTimeOrigin))].length,
      eventClockTypes: [...new Set(rendererEvents.map((event) => event.sourceClock))],
      codeFiles: record.code.files.map(
        (file) => `${file.path} ${file.git} ${String(file.sha256).slice(0, 12)}`
      )
    })
    const passed =
      result.correlated &&
      result.directoryHasIdPrefix &&
      result.state === 'copied' &&
      result.sha256Matches &&
      result.sourceSha256Matches &&
      entries.length > 0 &&
      result.rendererEvents === result.rendererEventsWithSourceTime &&
      record.code.files.every((file) => typeof file.sha256 === 'string')
    result.passed = passed
    ok &&= passed
  } catch (error) {
    result.passed = false
    result.error = String(error instanceof Error ? error.message : error).slice(0, 300)
    ok = false
  }
  return result
})
console.log(JSON.stringify({ root, count: directories.length, ok, results }, null, 2))
process.exit(ok ? 0 : 1)

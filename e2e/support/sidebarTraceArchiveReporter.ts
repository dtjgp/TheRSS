import { createHash } from 'node:crypto'
import { constants, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter'

/**
 * Copies the retained Playwright trace of a failed sidebar test next to its diagnostics record,
 * because Playwright clears its outputDir on the next run. It acts only on results that carry the
 * "sidebar-diagnostics" attachment and only when the record in the target directory has the same
 * correlationId (otherwise it writes nothing there). It never overwrites a file and
 * never throws: an archive problem is written to the status file and cannot change the result.
 * Paths in the status file are relative to the working directory.
 */
const ATTACHMENT = 'sidebar-diagnostics'
const RECORD = 'diagnostics.json'
const TRACE = 'trace.zip'
const STATUS = 'trace-archive.json'

interface DiagnosticsReference {
  readonly correlationId: string
  readonly directory: string
}

function reference(result: TestResult): DiagnosticsReference | null {
  const attachment = result.attachments.find((entry) => entry.name === ATTACHMENT && entry.body)
  if (!attachment?.body) return null
  const record = JSON.parse(attachment.body.toString('utf8')) as {
    correlationId?: unknown
    trace?: { archiveDirectory?: unknown }
  }
  const correlationId = record.correlationId
  const directory = record.trace?.archiveDirectory
  if (typeof correlationId !== 'string' || typeof directory !== 'string') return null
  const absolute = resolve(directory)
  const root = resolve('test-results/sidebar-diagnostics')
  // The directory comes from our own record; still refuse anything outside the diagnostics root.
  if (isAbsolute(directory) || relative(root, absolute).startsWith('..')) return null
  return { correlationId, directory: absolute }
}

function archive(test: TestCase, result: TestResult): void {
  let target: DiagnosticsReference | null
  try {
    target = reference(result)
  } catch {
    return
  }
  if (!target) return
  const status: Record<string, unknown> = {
    kind: 'sidebar-e2e-trace-archive',
    correlationId: target.correlationId,
    test: test.title,
    testStatus: result.status,
    record: RECORD,
    archivedAt: new Date().toISOString()
  }
  try {
    const recorded = JSON.parse(readFileSync(join(target.directory, RECORD), 'utf8')) as {
      correlationId?: unknown
    }
    if (recorded.correlationId !== target.correlationId) {
      // A record with another ID is not this result's record: write nothing into its directory.
      process.stderr.write(
        `sidebar trace archive: rejected ${target.correlationId.slice(0, 8)}: record ID differs\n`
      )
      return
    }
    status.recordMatches = true
    const traces = result.attachments.filter((entry) => entry.name === 'trace' && entry.path)
    if (traces.length === 0) {
      status.state = 'no-trace-attachment'
    } else {
      const source = String(traces[0]?.path)
      status.sourceTrace = relative(process.cwd(), source)
      if (!existsSync(source)) {
        status.state = 'source-missing'
      } else {
        const destination = join(target.directory, TRACE)
        copyFileSync(source, destination, constants.COPYFILE_EXCL)
        const content = readFileSync(destination)
        status.state = 'copied'
        status.archivedTrace = relative(process.cwd(), destination)
        status.bytes = content.length
        status.sha256 = createHash('sha256').update(content).digest('hex')
        status.sourceSha256 = createHash('sha256').update(readFileSync(source)).digest('hex')
      }
      if (traces.length > 1) status.extraTraceAttachments = traces.length - 1
    }
  } catch (error) {
    status.state = 'failed'
    status.error = String(error instanceof Error ? error.message : error)
      .split(process.cwd())
      .join('.')
      .slice(0, 500)
  }
  try {
    writeFileSync(join(target.directory, STATUS), `${JSON.stringify(status, null, 2)}\n`, {
      flag: 'wx'
    })
  } catch {
    // The record and the test result stay as they are.
  }
}

export default class SidebarTraceArchiveReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult): void {
    try {
      archive(test, result)
    } catch {
      // Never change the run because of the archive.
    }
  }

  printsToStdio(): boolean {
    return false
  }
}

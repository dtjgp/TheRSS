import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, relative } from 'node:path'
import { test, type ElectronApplication, type Page } from '@playwright/test'

/**
 * Failure diagnostics for the sidebar E2E. Events are kept in bounded memory for the explicit
 * fixture app only and written only when the test fails: as a test attachment and as a copy in
 * test-results/sidebar-diagnostics/<stamp>-<id>/, which Playwright does not clear (its outputDir is
 * test-results/compatibility). The trace is written by Playwright after the test ends;
 * sidebarTraceArchiveReporter.ts copies it into the same directory, matched by correlationId.
 * Renderer events reach Node through an exposed binding, so they survive page.reload(). Printable
 * keys are recorded as "char"; no text content is recorded.
 */
export const SIDEBAR_DIAGNOSTICS_DIRECTORY = join(process.cwd(), 'test-results/sidebar-diagnostics')
export const SIDEBAR_DIAGNOSTICS_ATTACHMENT = 'sidebar-diagnostics'
export const SIDEBAR_DIAGNOSTICS_RECORD = 'diagnostics.json'
export const SIDEBAR_TRACE_ARCHIVE = 'trace.zip'
export const SIDEBAR_TRACE_ARCHIVE_STATUS = 'trace-archive.json'
const MAX_EVENTS = 3000
const BINDING = '__sidebarDiagnosticsRecord'
const TIMEOUT_MS = 3000
/** Files whose working-tree content identifies the code under test (hash only, no content). */
const CODE_IDENTITY_FILES = [
  'src/renderer/src/App.tsx',
  'src/renderer/src/AppTopbar.tsx',
  'src/renderer/src/styles.css',
  'e2e/sidebar-resize.spec.ts',
  'e2e/support/sidebarDiagnostics.ts',
  'e2e/support/sidebarTraceArchiveReporter.ts',
  'playwright.config.ts',
  'package-lock.json'
]

const RENDERER_RECORDER = `(() => {
  if (window.__sidebarDiagnosticsStop) return
  let stopped = false
  let observeTimer = null
  const timeOrigin = performance.timeOrigin
  // sourceTimeStamp is event.timeStamp (or performance.now() for records without an event), in ms
  // relative to this document's performance.timeOrigin; Node adds its own receive time.
  const send = (entry, event) => {
    if (stopped) return
    const stamp = event ? event.timeStamp : performance.now()
    entry.sourceClock = event ? 'event.timeStamp' : 'performance.now'
    entry.sourceTimeStamp = Math.round(stamp * 1000) / 1000
    entry.sourceTimeOrigin = timeOrigin
    try {
      const pending = window.${BINDING} && window.${BINDING}(entry)
      if (pending && typeof pending.catch === 'function') pending.catch(() => undefined)
    } catch { /* the binding can be gone while the page closes */ }
  }
  const describe = (element) => {
    if (!element || !element.getAttribute) return String(element && element.nodeName)
    return String(element.getAttribute('aria-label') || element.getAttribute('role') || element.className || element.tagName).slice(0, 60)
  }
  const keyName = (key) => (typeof key === 'string' && key.length === 1 ? 'char' : key)
  const off = []
  const on = (target, type, handler) => {
    target.addEventListener(type, handler, true)
    off.push(() => target.removeEventListener(type, handler, true))
  }
  send({ type: 'document-start', readyState: document.readyState })
  for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture'])
    on(window, type, (event) => send({ type, pointerId: event.pointerId, buttons: event.buttons, x: Math.round(event.clientX), trusted: event.isTrusted, target: describe(event.target) }, event))
  // Moves are kept only while a button is pressed (drags), to stay lightweight.
  on(window, 'pointermove', (event) => {
    if (event.buttons) send({ type: 'pointermove', pointerId: event.pointerId, buttons: event.buttons, x: Math.round(event.clientX), trusted: event.isTrusted, target: describe(event.target) }, event)
  })
  for (const type of ['keydown', 'keyup'])
    on(window, type, (event) => send({ type, key: keyName(event.key), repeat: event.repeat, trusted: event.isTrusted, active: describe(document.activeElement) }, event))
  on(window, 'focus', (event) => send({ type: 'window-focus' }, event))
  on(window, 'blur', (event) => send({ type: 'window-blur' }, event))
  on(document, 'visibilitychange', (event) => send({ type: 'visibility', state: document.visibilityState }, event))
  const originalSetItem = Storage.prototype.setItem
  Storage.prototype.setItem = function (key, value) {
    if (key === 'therss.sidebar-width') send({ type: 'store', value: String(value) })
    return originalSetItem.call(this, key, value)
  }
  const observers = []
  let pending = 0
  const observe = () => {
    observeTimer = null
    if (stopped) return
    const resizer = document.querySelector('.sidebar-resizer'), shell = document.querySelector('.app-shell')
    if (!resizer || !shell) {
      if (++pending < 200) observeTimer = setTimeout(observe, 50)
      return
    }
    send({ type: 'resizer-initial', valuenow: resizer.getAttribute('aria-valuenow'), hidden: resizer.hidden, stored: localStorage.getItem('therss.sidebar-width'), focused: document.hasFocus() })
    const attributes = new MutationObserver((records) => {
      for (const record of records) send({ type: 'attribute', node: 'resizer', name: record.attributeName, value: resizer.getAttribute(record.attributeName) })
    })
    attributes.observe(resizer, { attributes: true, attributeFilter: ['aria-valuenow', 'aria-valuemax', 'hidden', 'tabindex'] })
    const shellClass = new MutationObserver(() => send({ type: 'attribute', node: 'shell', name: 'class', value: shell.className }))
    shellClass.observe(shell, { attributes: true, attributeFilter: ['class'] })
    observers.push(attributes, shellClass)
  }
  if (document.readyState === 'loading') on(document, 'DOMContentLoaded', observe)
  else observe()
  window.__sidebarDiagnosticsStop = () => {
    stopped = true
    if (observeTimer !== null) clearTimeout(observeTimer)
    observeTimer = null
    for (const remove of off) remove()
    for (const observer of observers) observer.disconnect()
    Storage.prototype.setItem = originalSetItem
    delete window.__sidebarDiagnosticsStop
  }
})()`

const RENDERER_SNAPSHOT = `(() => {
  const sidebar = document.querySelector('.sidebar'), resizer = document.querySelector('.sidebar-resizer')
  const active = document.activeElement
  return {
    sidebarWidth: sidebar ? getComputedStyle(sidebar).width : null,
    resizer: resizer ? {
      valuenow: resizer.getAttribute('aria-valuenow'), valuemax: resizer.getAttribute('aria-valuemax'),
      hidden: resizer.hidden, tabindex: resizer.getAttribute('tabindex')
    } : null,
    shellClass: document.querySelector('.app-shell')?.className ?? null,
    stored: localStorage.getItem('therss.sidebar-width'),
    activeElement: active ? String(active.getAttribute?.('aria-label') || active.getAttribute?.('role') || active.tagName).slice(0, 60) : null,
    documentHasFocus: document.hasFocus(),
    visibility: document.visibilityState,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    timeOrigin: performance.timeOrigin,
    now: performance.now()
  }
})()`

const CLOCKS = {
  t: 'Date.now() in the Playwright test process when a renderer event arrived through the binding (source renderer) or a phase was marked (source test); Date.now() in the Electron main process when it recorded the event (source main)',
  ms: 't minus the first t of the timeline',
  sourceTimeStamp:
    'renderer only: event.timeStamp (sourceClock "event.timeStamp") or performance.now() (sourceClock "performance.now"), ms relative to sourceTimeOrigin',
  sourceTimeOrigin:
    'renderer only: performance.timeOrigin of the document that sent the event (epoch ms); it changes on reload',
  sourceEpochMs:
    'renderer only: sourceTimeOrigin + sourceTimeStamp, the renderer clock time of the event'
}

export interface DiagnosticEvent {
  readonly t: number
  readonly source: 'renderer' | 'main' | 'test'
  readonly type: string
  readonly [field: string]: unknown
}

export interface SidebarDiagnostics {
  /** Correlates the failure record, the attachment and the archived trace. */
  readonly correlationId: string
  /** Marks a test step on the shared timeline. */
  phase(name: string): void
  /** A copy of the renderer and test events received so far (for probes). */
  timeline(): readonly DiagnosticEvent[]
  /** Writes the failure record. It never throws, so the original failure stays the result. */
  recordFailure(error: unknown): Promise<string | null>
  /** Removes the listeners, init script, binding and storage patch. It never throws. */
  dispose(): Promise<void>
}

async function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('diagnostics step timed out')), TIMEOUT_MS)
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function git(args: readonly string[]): string | null {
  try {
    return execFileSync('git', [...args], { encoding: 'utf8' })
  } catch {
    return null
  }
}

/** HEAD, the number of changed paths and a SHA-256 of each identity file's working-tree content. */
function codeIdentity(): Record<string, unknown> {
  const status = git(['status', '--porcelain', '--', ...CODE_IDENTITY_FILES])
  const files = CODE_IDENTITY_FILES.map((path) => {
    try {
      const content = readFileSync(join(process.cwd(), path))
      const line = status?.split('\n').find((entry) => entry.slice(3) === path)
      return {
        path,
        sha256: createHash('sha256').update(content).digest('hex'),
        bytes: content.length,
        git: line ? line.slice(0, 2).trim() : status === null ? null : 'unmodified'
      }
    } catch {
      return { path, sha256: null, bytes: null, git: null }
    }
  })
  return {
    head: git(['rev-parse', 'HEAD'])?.trim() ?? null,
    changedPaths: git(['status', '--porcelain'])?.split('\n').filter(Boolean).length ?? null,
    files
  }
}

function roundMs(value: number): number {
  return Math.round(value * 1000) / 1000
}

export async function startSidebarDiagnostics(
  application: ElectronApplication,
  page: Page,
  flags: Readonly<Record<string, string>>
): Promise<SidebarDiagnostics> {
  const correlationId = randomUUID()
  const events: DiagnosticEvent[] = []
  let dropped = 0
  const push = (event: DiagnosticEvent) => {
    if (events.length < MAX_EVENTS) events.push(event)
    else dropped++
  }
  const binding = await page.exposeBinding(BINDING, (_source, entry: Record<string, unknown>) => {
    const origin = Number(entry.sourceTimeOrigin)
    const stamp = Number(entry.sourceTimeStamp)
    push({
      ...entry,
      t: Date.now(),
      source: 'renderer',
      type: String(entry.type),
      sourceEpochMs: Number.isFinite(origin + stamp) ? roundMs(origin + stamp) : null
    })
  })
  const initScript = await page.addInitScript(RENDERER_RECORDER)
  await page.evaluate(RENDERER_RECORDER)
  await application.evaluate(({ app, BrowserWindow }, limit) => {
    const store = { events: [] as Array<Record<string, unknown>>, off: [] as Array<() => void> }
    const record = (type: string, extra: Record<string, unknown> = {}) => {
      if (store.events.length < limit) store.events.push({ t: Date.now(), type, ...extra })
    }
    const window = BrowserWindow.getAllWindows()[0]
    if (window)
      for (const type of ['focus', 'blur', 'resize', 'show', 'hide'] as const) {
        const handler = () => record(`window-${type}`)
        window.on(type as 'focus', handler)
        store.off.push(() => window.off(type as 'focus', handler))
      }
    for (const type of [
      'did-become-active',
      'did-resign-active',
      'browser-window-focus',
      'browser-window-blur'
    ] as const) {
      const handler = () => record(`app-${type}`)
      app.on(type as 'did-become-active', handler)
      store.off.push(() => app.off(type as 'did-become-active', handler))
    }
    record('recorder-attached', { windowFocused: window?.isFocused() ?? null })
    ;(globalThis as Record<string, unknown>).__sidebarDiagnosticsMain = store
  }, 1000)
  push({ t: Date.now(), source: 'test', type: 'diagnostics-started', correlationId })

  const mainEvents = () =>
    withTimeout(
      application.evaluate(
        () =>
          (
            (globalThis as Record<string, unknown>).__sidebarDiagnosticsMain as
              { events: Array<Record<string, unknown>> } | undefined
          )?.events ?? []
      )
    ).catch(() => [])

  return {
    correlationId,
    phase(name) {
      push({ t: Date.now(), source: 'test', type: 'phase', name })
    },
    timeline() {
      return events.map((event) => ({ ...event }))
    },
    async recordFailure(error) {
      try {
        const info = test.info()
        const [main, renderer, window, electron] = await Promise.all([
          mainEvents(),
          withTimeout(page.evaluate(RENDERER_SNAPSHOT)).catch((reason) => ({
            unavailable: String(reason).slice(0, 200)
          })),
          withTimeout(
            application.evaluate(({ BrowserWindow }) => {
              const current = BrowserWindow.getAllWindows()[0]
              return current ? { bounds: current.getBounds(), focused: current.isFocused() } : null
            })
          ).catch(() => null),
          withTimeout(application.evaluate(() => process.versions.electron)).catch(() => null)
        ])
        const timeline = [
          ...events,
          ...main.map((event): DiagnosticEvent => ({
            ...event,
            t: Number(event.t),
            type: String(event.type),
            source: 'main'
          }))
        ].sort((left, right) => Number(left.t) - Number(right.t))
        const start = Number(timeline[0]?.t ?? Date.now())
        const recordedAt = new Date()
        const directory = join(
          SIDEBAR_DIAGNOSTICS_DIRECTORY,
          `${recordedAt.toISOString().replace(/[:.]/gu, '-')}-${correlationId.slice(0, 8)}`
        )
        const record = {
          kind: 'sidebar-e2e-failure-diagnostics',
          correlationId,
          recordedAt: recordedAt.toISOString(),
          test: {
            title: info.title,
            file: relative(process.cwd(), info.file),
            retry: info.retry,
            timeout: info.timeout
          },
          config: {
            workers: info.config.workers,
            retries: info.project.retries,
            projectTimeout: info.project.timeout,
            flags
          },
          code: { ...codeIdentity(), electron },
          // Paths are made relative to the working directory or the home directory.
          error: String(error instanceof Error ? (error.stack ?? error.message) : error)
            // eslint-disable-next-line no-control-regex -- strips terminal colour codes
            .replace(/\u001b\[[0-9;]*m/gu, '')
            .split(process.cwd())
            .join('.')
            .split(homedir())
            .join('~')
            .slice(0, 4000),
          // Playwright writes the retained trace after the test ends. The archive reporter copies
          // it next to this record and writes its own status file; the record cannot know it.
          trace: {
            mode: String(info.project.use.trace ?? ''),
            archiveDirectory: relative(process.cwd(), directory),
            archivedTrace: SIDEBAR_TRACE_ARCHIVE,
            archiveStatus: SIDEBAR_TRACE_ARCHIVE_STATUS,
            archivedBy: 'e2e/support/sidebarTraceArchiveReporter.ts'
          },
          clocks: CLOCKS,
          final: { renderer, window },
          eventLimit: MAX_EVENTS,
          droppedEvents: dropped,
          events: timeline.map((event) => ({ ...event, ms: Number(event.t) - start }))
        }
        const body = `${JSON.stringify(record, null, 2)}\n`
        await mkdir(SIDEBAR_DIAGNOSTICS_DIRECTORY, { recursive: true })
        await mkdir(directory)
        const file = join(directory, SIDEBAR_DIAGNOSTICS_RECORD)
        await writeFile(file, body, { flag: 'wx' })
        await info.attach(SIDEBAR_DIAGNOSTICS_ATTACHMENT, { body, contentType: 'application/json' })
        return file
      } catch {
        return null
      }
    },
    async dispose() {
      await withTimeout(
        page.evaluate(
          '(() => { if (window.__sidebarDiagnosticsStop) window.__sidebarDiagnosticsStop() })()'
        )
      ).catch(() => undefined)
      await withTimeout(initScript.dispose()).catch(() => undefined)
      await withTimeout(binding.dispose()).catch(() => undefined)
      await withTimeout(
        application.evaluate(() => {
          const store = (globalThis as Record<string, unknown>).__sidebarDiagnosticsMain as
            { off: Array<() => void> } | undefined
          for (const remove of store?.off ?? []) remove()
          delete (globalThis as Record<string, unknown>).__sidebarDiagnosticsMain
        })
      ).catch(() => undefined)
    }
  }
}

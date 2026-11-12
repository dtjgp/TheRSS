import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env } from 'node:process'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { startSidebarDiagnostics, type SidebarDiagnostics } from '../support/sidebarDiagnostics'

// Probes for the sidebar diagnostics. They are not product tests and never run in the E2E suite.
// The first one fails on purpose to exercise the failure record and the trace archive.

async function launchFixture(): Promise<{ application: ElectronApplication; profile: string }> {
  const profile = await mkdtemp(join(tmpdir(), 'therss-sidebar-probe-'))
  const application = await electron.launch({
    args: [`--user-data-dir=${profile}`, '.'],
    env: { ...env, THERSS_E2E_FIXTURES: '1', THERSS_UI: 'web', THERSS_NATIVE_GLASS: 'off' }
  })
  return { application, profile }
}

test('sidebar diagnostics record a controlled failure across a reload', async () => {
  const { application, profile } = await launchFixture()
  let diagnostics: SidebarDiagnostics | undefined
  try {
    const page = await application.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    diagnostics = await startSidebarDiagnostics(application, page, { probe: 'controlled-failure' })
    const heading = page.getByRole('heading', { name: 'Discover research' })
    const resizer = page.getByRole('separator', { name: 'Resize sidebar' })
    await expect(heading).toBeVisible()
    diagnostics.phase('probe-before-reload')
    await resizer.press('ArrowRight')
    diagnostics.phase('probe-reload')
    await page.reload()
    await expect(heading).toBeVisible()
    diagnostics.phase('probe-after-reload')
    await resizer.press('ArrowLeft')
    // The intentional failure: this assertion is the probe's own and is always false.
    expect('probe state', 'Intentional failure of the diagnostics probe').toBe(
      'intentional-probe-failure'
    )
  } catch (error) {
    await diagnostics?.recordFailure(error)
    throw error
  } finally {
    await diagnostics?.dispose()
    await application.close()
    await rm(profile, { recursive: true, force: true })
  }
})

test('sidebar diagnostics remove their listeners and storage patch on dispose', async () => {
  const { application, profile } = await launchFixture()
  try {
    const page = await application.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    const diagnostics = await startSidebarDiagnostics(application, page, { probe: 'dispose' })
    expect(await page.evaluate('typeof window.__sidebarDiagnosticsStop')).toBe('function')
    await diagnostics.dispose()
    expect(await page.evaluate('typeof window.__sidebarDiagnosticsStop')).toBe('undefined')
    expect(await page.evaluate('Storage.prototype.setItem.toString()')).toContain('[native code]')
    expect(await application.evaluate(() => '__sidebarDiagnosticsMain' in globalThis)).toBe(false)
    // The init script is removed too: a reload after dispose does not install the recorder again.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Discover research' })).toBeVisible()
    expect(await page.evaluate('typeof window.__sidebarDiagnosticsStop')).toBe('undefined')
    expect(await page.evaluate('Storage.prototype.setItem.toString()')).toContain('[native code]')
  } finally {
    await application.close()
    await rm(profile, { recursive: true, force: true })
  }
})

test('sidebar diagnostics disposed before the sidebar exists do not observe it later', async () => {
  const { application, profile } = await launchFixture()
  try {
    const page = await application.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    const resizer = page.getByRole('separator', { name: 'Resize sidebar' })
    await expect(resizer).toBeVisible()
    // Probe fixture only: detach the resize handle so the recorder has to wait for it.
    await page.evaluate(`(() => {
      const node = document.querySelector('.sidebar-resizer')
      window.__probeResizer = { node, parent: node.parentNode, next: node.nextSibling }
      node.remove()
    })()`)
    const diagnostics = await startSidebarDiagnostics(application, page, { probe: 'early-dispose' })
    await diagnostics.dispose()
    const received = diagnostics.timeline()
    expect(received.map((event) => event.type)).not.toContain('resizer-initial')
    // Anything the recorder still sends after dispose lands in this page-local list.
    await page.evaluate(`(() => {
      window.__probeLate = []
      window.__sidebarDiagnosticsRecord = (entry) => { window.__probeLate.push(entry.type) }
    })()`)
    expect(await page.evaluate('String(window.__sidebarDiagnosticsRecord)')).toContain(
      '__probeLate'
    )
    // The handle arrives late, after several 50 ms observer retries would have run.
    await page.evaluate(`(() => {
      const saved = window.__probeResizer
      saved.parent.insertBefore(saved.node, saved.next)
      delete window.__probeResizer
    })()`)
    await page.evaluate('new Promise((done) => setTimeout(done, 400))')
    const before = await resizer.getAttribute('aria-valuenow')
    await resizer.press('ArrowRight')
    await expect(resizer).not.toHaveAttribute('aria-valuenow', before ?? '')
    const after = await resizer.getAttribute('aria-valuenow')
    // The product wrote the new width, so a live storage patch or observer would have seen it.
    expect(await page.evaluate("localStorage.getItem('therss.sidebar-width')")).toBe(after)
    expect(await page.evaluate('window.__probeLate')).toEqual([])
    expect(diagnostics.timeline()).toHaveLength(received.length)
    expect(await page.evaluate('Storage.prototype.setItem.toString()')).toContain('[native code]')
    expect(await page.evaluate('typeof window.__sidebarDiagnosticsStop')).toBe('undefined')
  } finally {
    await application.close()
    await rm(profile, { recursive: true, force: true })
  }
})

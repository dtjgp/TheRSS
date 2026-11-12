/**
 * Event recorder for the sidebar diagnosis. Renderer events reach Node through an exposed
 * binding, so they survive page.reload(). Only the fixture app is observed: key names are kept
 * for named keys (arrows, Escape, Tab), printable characters are recorded as "char".
 */
import { writeFile } from 'node:fs/promises'

export const RENDERER_RECORDER = `(() => {
  if (window.__sidebarRecorderInstalled) return
  window.__sidebarRecorderInstalled = true
  const send = (entry) => { try { window.__sidebarRecord(entry) } catch { /* not exposed yet */ } }
  const describe = (element) => {
    if (!element || !element.getAttribute) return String(element && element.nodeName)
    return String(element.getAttribute('aria-label') || element.getAttribute('role') || element.className || element.tagName).slice(0, 60)
  }
  const keyName = (key) => (key && key.length === 1 ? 'char' : key)
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture'])
    window.addEventListener(type, (event) => send({ type, pointerId: event.pointerId, buttons: event.buttons, x: Math.round(event.clientX), trusted: event.isTrusted, target: describe(event.target) }), true)
  for (const type of ['keydown', 'keyup'])
    window.addEventListener(type, (event) => send({ type, key: keyName(event.key), repeat: event.repeat, trusted: event.isTrusted, active: describe(document.activeElement) }), true)
  window.addEventListener('focus', () => send({ type: 'window-focus' }))
  window.addEventListener('blur', () => send({ type: 'window-blur' }))
  document.addEventListener('visibilitychange', () => send({ type: 'visibility', state: document.visibilityState }))
  const setItem = Storage.prototype.setItem
  Storage.prototype.setItem = function (key, value) {
    if (key === 'therss.sidebar-width') send({ type: 'store', value: String(value) })
    return setItem.call(this, key, value)
  }
  const observe = () => {
    const resizer = document.querySelector('.sidebar-resizer'), shell = document.querySelector('.app-shell')
    if (!resizer || !shell) return void setTimeout(observe, 50)
    send({ type: 'resizer-initial', valuenow: resizer.getAttribute('aria-valuenow'), hidden: resizer.hidden, stored: localStorage.getItem('therss.sidebar-width'), focused: document.hasFocus() })
    new MutationObserver((records) => { for (const record of records) send({ type: 'attr', node: 'resizer', name: record.attributeName, value: resizer.getAttribute(record.attributeName) }) })
      .observe(resizer, { attributes: true, attributeFilter: ['aria-valuenow', 'hidden', 'tabindex'] })
    new MutationObserver(() => send({ type: 'attr', node: 'shell', name: 'class', value: shell.className }))
      .observe(shell, { attributes: true, attributeFilter: ['class'] })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe)
  else observe()
})()`

export async function attachRecorder(application, page) {
  const events = []
  await page.exposeBinding('__sidebarRecord', (_source, entry) => {
    events.push({ t: Date.now(), source: 'renderer', ...entry })
  })
  await page.addInitScript(RENDERER_RECORDER)
  await page.evaluate(RENDERER_RECORDER)
  await application.evaluate(({ app, BrowserWindow }) => {
    globalThis.__sidebarMainEvents = []
    const push = (type, extra = {}) =>
      globalThis.__sidebarMainEvents.push({ t: Date.now(), source: 'main', type, ...extra })
    const window = BrowserWindow.getAllWindows()[0]
    for (const type of ['focus', 'blur', 'resize', 'show', 'hide'])
      window.on(type, () => push(`window-${type}`))
    for (const type of [
      'did-become-active',
      'did-resign-active',
      'browser-window-focus',
      'browser-window-blur'
    ])
      app.on(type, () => push(`app-${type}`))
    push('recorder-attached', { focused: window.isFocused() })
  })
  return {
    phase: (name, extra = {}) =>
      events.push({ t: Date.now(), source: 'test', type: 'phase', name, ...extra }),
    async save(file, outcome) {
      const main = await application.evaluate(() => globalThis.__sidebarMainEvents).catch(() => [])
      const all = [...events, ...(main ?? [])].sort((left, right) => left.t - right.t)
      const start = all[0]?.t ?? 0
      await writeFile(
        file,
        `${JSON.stringify({ outcome, events: all.map((event) => ({ ...event, ms: event.t - start })) }, null, 2)}\n`
      )
    }
  }
}

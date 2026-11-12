/* eslint-disable @typescript-eslint/no-require-imports -- Electron -r loads CommonJS only */
/* global require, process */
/**
 * Temporary verification helper, loaded with `electron -r`. It replaces shell.openExternal before
 * the app's main module runs, so no URL (https, obsidian://) leaves the isolated app. Each
 * attempt is appended to THERSS_OPEN_EXTERNAL_LOG as one JSON line. Not part of the product.
 */
const { appendFileSync } = require('node:fs')
const { shell } = require('electron')

const log = process.env.THERSS_OPEN_EXTERNAL_LOG
if (!log) throw new Error('THERSS_OPEN_EXTERNAL_LOG is required')
const record = (kind, target) =>
  appendFileSync(log, `${JSON.stringify({ kind, target, at: new Date().toISOString() })}\n`)

shell.openExternal = async (url) => {
  record('openExternal', String(url))
}
shell.openPath = async (path) => {
  record('openPath', String(path))
  return ''
}
shell.showItemInFolder = (path) => {
  record('showItemInFolder', String(path))
}
record('helper-loaded', null)

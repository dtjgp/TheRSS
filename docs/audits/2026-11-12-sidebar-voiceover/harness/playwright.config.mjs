import { join } from 'node:path'
import process from 'node:process'
import { defineConfig } from '@playwright/test'

// Sidebar diagnosis only; not part of the normal E2E (e2e/ is its testDir).
export default defineConfig({
  testDir: '.',
  testMatch: process.env.SIDEBAR_DIAG_MATCH ?? '*.diag.spec.mjs',
  outputDir: process.env.SIDEBAR_DIAG_OUT ?? join(process.cwd(), 'test-results/sidebar-diag'),
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['line']],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' }
})

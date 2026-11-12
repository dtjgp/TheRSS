import { join } from 'node:path'
import process from 'node:process'
import { defineConfig } from '@playwright/test'

// The full E2E order with the sidebar case replaced by the recorded copy, which must sort after
// e2e/ (it is copied to test-results/sidebar-diag/zz/ by the caller). Diagnosis only.
export default defineConfig({
  testDir: process.cwd(),
  testMatch: ['e2e/*.spec.ts', 'test-results/sidebar-diag/zz/*.diag.spec.mjs'],
  testIgnore: ['e2e/sidebar-resize.spec.ts'],
  outputDir: process.env.SIDEBAR_DIAG_OUT ?? join(process.cwd(), 'test-results/sidebar-diag/full'),
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' }
})

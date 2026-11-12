import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Keep Playwright's per-run cleanup away from native acceptance artifacts.
  outputDir: 'test-results/compatibility',
  timeout: 45_000,
  fullyParallel: false,
  // Electron windows share macOS focus. Parallel files can cancel a drag by
  // activating another app; serialize the desktop interaction fixtures.
  workers: 1,
  retries: 0,
  // The archive reporter copies a failed sidebar test's trace next to its diagnostics record in
  // test-results/sidebar-diagnostics/, which the next run does not clear. It never changes a result.
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['./e2e/support/sidebarTraceArchiveReporter.ts']
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
})

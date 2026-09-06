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
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
})

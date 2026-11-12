import { defineConfig } from '@playwright/test'

// Controlled failure probe for the sidebar diagnostics. Not part of the E2E suite: the suite's
// testDir is e2e/ and its default testMatch does not include *.probe.ts.
export default defineConfig({
  testDir: '.',
  testMatch: '*.probe.ts',
  outputDir: '../../test-results/sidebar-diagnostics-probe',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: '../../test-results/sidebar-diagnostics-probe-report.json' }],
    ['../support/sidebarTraceArchiveReporter.ts']
  ],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' }
})

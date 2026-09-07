import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Node 25+ host Web Storage shadows jsdom's real, origin-scoped Storage in
    // Vitest workers (vitest-dev/vitest#10867). Keep browser storage in jsdom.
    execArgv: ['--no-experimental-webstorage'],
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/core/**/*.{ts,tsx}', 'src/shared/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    }
  }
})

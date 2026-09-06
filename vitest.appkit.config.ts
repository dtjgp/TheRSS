import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/main/appkit/**/*.test.ts',
      'src/main/windowApplication*.test.ts',
      'src/main/nativeAppKitRuntime.test.ts'
    ],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage/appkit',
      include: [
        'src/main/appkit/**/*.ts',
        'src/main/windowApplication.ts',
        'src/main/windowApplicationRuntime.ts',
        'src/main/nativeAppKitRuntime.ts'
      ],
      exclude: ['src/**/*.test.ts', 'src/main/appkit/testSupport.ts'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 }
    }
  }
})

import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: 'src/mcp/stdio.ts',
    outDir: 'out/mcp',
    emptyOutDir: false,
    target: 'node22',
    rollupOptions: {
      external: ['better-sqlite3']
    }
  }
})

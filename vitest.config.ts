import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
  test: {
    // Frontend tests run in jsdom. Server/shared tests opt into Node with `// @vitest-environment node`.
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: [
      'src/**/*.test.{ts,tsx}',
      'server/**/*.test.ts',
      'shared/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
  },
})

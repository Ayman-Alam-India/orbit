import react from '@vitejs/plugin-react'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
    // Tests use the small, stable fixture data set, not the curated seed (see server/data/store.ts).
    // Offline, deterministic tests: fixture data, mock AI, no API keys (even if the shell has some).
    env: {
      ORBIT_SEED_DIR: 'server/data/fixtures',
      DATA_MODE: 'mock',
      AI_PROVIDER: 'mock',
      GOOGLE_GENERATIVE_AI_API_KEY: '',
      GROQ_API_KEY: '',
      // A fresh, empty disk cache per run: never the real server/.cache the dev server writes.
      ORBIT_CACHE_DIR: join(tmpdir(), `orbit-test-cache-${Date.now()}`),
    },
    include: [
      'src/**/*.test.{ts,tsx}',
      'server/**/*.test.ts',
      'shared/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
  },
})

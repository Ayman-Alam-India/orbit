import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
  // The globe chunk (three.js) is ~2 MB by nature and is already lazy-loaded.
  build: { chunkSizeWarningLimit: 2500 },
  server: {
    // The API server (npm run dev:api) listens on 8787. The browser only ever calls /api/...
    proxy: { '/api': 'http://localhost:8787' },
    // The frontend never imports these. Watching them can crash Vite on Windows (EBUSY) while the API
    // server writes cache files (e.g. narration clips) or a file in docs/ is being written.
    watch: { ignored: ['**/server/**', '**/docs/**', '**/scripts/**', '**/.cache/**'] },
  },
})

import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// The app's unit tests (the API has its own in api/, in the Workers runtime).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['__tests__/**/*.test.ts'] },
})

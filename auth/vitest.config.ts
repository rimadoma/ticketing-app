import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Only run test/*.ts
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
})
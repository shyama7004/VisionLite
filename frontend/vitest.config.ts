import { defineConfig } from 'vitest/config'

// Tests do not need the app plugins, so keep this config small.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node', pool: 'vmThreads' },
})

import { defineConfig } from 'vitest/config'

// Unit tests for the shared game rules (packs, race physics, catalog).
export default defineConfig({
  test: { include: ['shared/**/*.test.ts'] },
})

/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site under /<repo>/; the deploy workflow sets VITE_BASE.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      // Game rules shared with the Supabase Edge Functions.
      '@game': fileURLToPath(new URL('./supabase/functions/_shared/game/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'supabase/functions/_shared/**/*.test.ts'],
  },
})

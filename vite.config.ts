/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    // Run the API from b2b-marketplace-api on its default port; the proxy avoids needing CORS in development
    proxy: { '/api': process.env.API_URL ?? 'http://localhost:5095' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})

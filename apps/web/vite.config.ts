import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const API_TARGET = process.env.API_INTERNAL_URL ?? 'http://localhost:3000';
const PORT = Number(process.env.WEB_PORT ?? 5173);

export default defineConfig({
  plugins: [sveltekit()],
  // Vitest owns src/; e2e/ belongs to Playwright and must not be collected here.
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
  server: {
    host: '0.0.0.0',
    port: PORT,
    strictPort: true,
    // In prod Caddy serves the API under the same origin at /api/*; mirror that in dev
    // so browser-side fetches stay relative and cookies stay first-party.
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
    },
  },
});

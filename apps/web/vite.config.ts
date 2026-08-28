import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const API_TARGET = process.env.API_INTERNAL_URL ?? 'http://localhost:3000';
const PORT = Number(process.env.WEB_PORT ?? 5173);

export default defineConfig({
  plugins: [sveltekit()],
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

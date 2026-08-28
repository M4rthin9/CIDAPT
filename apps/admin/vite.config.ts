import { fileURLToPath, URL } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const API_TARGET = process.env.API_INTERNAL_URL ?? 'http://localhost:3000';
const PORT = Number(process.env.ADMIN_PORT ?? 5174);

export default defineConfig({
  // Caddy serves the SPA under /admin (via `handle_path`, which strips the
  // prefix before hitting the file server). Emitting asset URLs as /admin/...
  // keeps them from falling through to the storefront route.
  base: '/admin/',
  plugins: [svelte()],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: PORT,
    strictPort: true,
    // Caddy serves the SPA from /admin and proxies /api/* to the same origin in prod;
    // mirror that in dev so relative fetches keep the session cookie first-party.
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
    },
  },
  // SPA falls back to index.html (Caddy try_files is already set); hash routing below
  // keeps deep links working regardless of the /admin base path.
  build: {
    outDir: 'dist',
  },
});

import { defineConfig } from '@playwright/test';

const WEB_PORT = Number(process.env.WEB_PORT ?? 5173);
// Point the suite at an already-running storefront (the compose stack behind
// Caddy, for instance) with E2E_BASE_URL; the dev-server webServer block is
// skipped in that case so nothing competes for the port.
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  // The dev server compiles routes on first hit; give assertions room for a cold SSR.
  expect: { timeout: 10_000 },
  retries: 0,
  use: {
    baseURL: BASE_URL,
    viewport: { width: 360, height: 800 },
    locale: 'th-TH',
    headless: true,
  },
  // The API must already be reachable (see README: migrate + seed + `pnpm --filter @cida/api dev`);
  // only the storefront is started here.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        port: WEB_PORT,
        reuseExistingServer: true,
        timeout: 60_000,
      },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});

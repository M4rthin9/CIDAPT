import { defineConfig } from '@playwright/test';

const WEB_PORT = Number(process.env.WEB_PORT ?? 5173);

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  // The dev server compiles routes on first hit; give assertions room for a cold SSR.
  expect: { timeout: 10_000 },
  retries: 0,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    viewport: { width: 360, height: 800 },
    locale: 'th-TH',
    headless: true,
  },
  // The API must already be reachable (see README: migrate + seed + `pnpm --filter @cida/api dev`);
  // only the storefront is started here.
  webServer: {
    command: 'pnpm dev',
    port: WEB_PORT,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});

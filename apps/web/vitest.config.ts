import { defineConfig } from 'vitest/config';

/**
 * Vitest config is kept out of `vite.config.ts` on purpose: importing
 * `vitest/config` there pulls in Vite 7's type definitions, which clash with the
 * Vite 6 types `@sveltejs/kit`'s plugin is built against and break `tsc`.
 *
 * Vitest reads this file in preference to vite.config.ts and still applies the
 * Vite config for transforms.
 */
export default defineConfig({
  test: {
    // Vitest owns src/; e2e/ belongs to Playwright and must not be collected here.
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
});

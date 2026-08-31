import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      out: 'build',
      precompress: true,
    }),
    alias: {
      $lib: 'src/lib',
    },
    // SvelteKit emits an inline bootstrap <script> on every SSR response, so a
    // blanket `script-src 'self'` (what Caddy sent for the whole site) blocked
    // hydration in the deployed stack: the page rendered but nothing was
    // interactive — add-to-cart, form validation and the language switcher all
    // silently did nothing. Hash mode makes SvelteKit emit its own CSP header
    // with the per-build hash of that script, so the storefront stays strict
    // without `unsafe-inline`. Caddy no longer sets CSP on the storefront route.
    csp: {
      mode: 'hash',
      directives: {
        'default-src': ['self'],
        'img-src': ['self', 'data:'],
        'style-src': ['self', 'unsafe-inline'],
        'script-src': ['self'],
        'frame-ancestors': ['none'],
        'base-uri': ['self'],
        'form-action': ['self'],
      },
    },
  },
};

export default config;

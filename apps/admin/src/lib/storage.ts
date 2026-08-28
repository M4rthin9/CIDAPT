/**
 * Cached session user, shared by `api.ts` and `auth.svelte.ts`.
 *
 * Lives in its own module so the 401 handler in `api.ts` can drop the cache
 * without importing the auth store (which imports `api` right back).
 * The cache is a UI convenience only — the cookie is the real credential and
 * every request is re-authorised server-side.
 */
export const SESSION_KEY = 'cida-admin-session';

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

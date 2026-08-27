import { env } from '$env/dynamic/private';

/**
 * Base URL of the Hono API as seen from the SSR process. In prod Caddy fronts
 * both origins, but the web container still talks to `api:3000` directly.
 */
export const API_BASE = env.API_INTERNAL_URL ?? 'http://localhost:3000';

/**
 * Server-side fetch to the API. The cart lives in an HttpOnly cookie set by the
 * API, so it has to be forwarded explicitly — cross-origin `event.fetch` won't.
 */
export async function apiFetch(
  event: { fetch: typeof fetch; request: Request },
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const cookie = event.request.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);

  return event.fetch(`${API_BASE}${path}`, { ...init, headers });
}

/** Returns `json.data` on 2xx, `null` on any error or when the API is unreachable. */
export async function apiData<T>(
  event: { fetch: typeof fetch; request: Request },
  path: string,
): Promise<T | null> {
  try {
    const res = await apiFetch(event, path);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T };
    return json.data ?? null;
  } catch {
    return null;
  }
}

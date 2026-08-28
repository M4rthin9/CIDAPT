import { clearSession } from './storage';

export interface ApiError {
  code: string;
  message_th: string;
  message_en: string;
  details?: unknown;
  request_id?: string;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly message_th: string;
  readonly message_en: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(status: number, body: { error?: ApiError } | null) {
    super(body?.error?.message_en ?? `Request failed (${status})`);
    this.status = status;
    this.code = body?.error?.code ?? 'unknown';
    this.message_th = body?.error?.message_th ?? this.message;
    this.message_en = body?.error?.message_en ?? this.message;
    this.details = body?.error?.details;
    this.requestId = body?.error?.request_id;
  }
}

/**
 * Minimal typed fetch wrapper over the Hono API. All calls are same-origin
 * (`/api/v1/...`) so the first-party session cookie is sent automatically.
 *
 * `T` is the shape of `{ data }` in the success envelope. On a failed `ok`
 * response it throws `ApiRequestError`; on 401 it clears auth and redirects
 * to login unless the caller opts out.
 */
export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
  opts: { redirectOn401?: boolean } = {},
): Promise<T> {
  const { redirectOn401 = true } = opts;
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    credentials: 'same-origin',
  });

  if (res.ok) {
    const json = (await res.json().catch(() => ({}))) as { data?: T };
    return (json.data ?? undefined) as T;
  }

  const body = (await res.json().catch(() => null)) as { error?: ApiError } | null;

  if (res.status === 401 && redirectOn401) {
    clearSession();
    const target = window.location.hash.replace(/^#/, '');
    window.location.hash = target ? `#/login?next=${encodeURIComponent(target)}` : '#/login';
  }

  throw new ApiRequestError(res.status, body);
}

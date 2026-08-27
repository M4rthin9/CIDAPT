import type { Context, Next } from 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
    adminUserId: string;
    adminRole: string;
    adminEmail: string;
    adminDisplayName: string;
  }
}

export async function requestIdMiddleware(c: Context, next: Next) {
  const { randomUUID } = await import('node:crypto');
  const id = randomUUID();
  c.set('requestId', id);
  c.header('X-Request-Id', id);
  await next();
}

import type { Context, MiddlewareHandler } from 'hono';
import { getValkey } from '../valkey.js';
import { getLogger } from '../logger.js';

/**
 * Valkey-backed fixed-window rate limiter, keyed by client IP + route path.
 * Returns 429 when the window is exhausted. On Valkey failure it fails
 * open (logs and lets the request through) so a cache outage never bricks
 * the storefront.
 */
export function rateLimit(opts: { max: number; windowMs: number }): MiddlewareHandler {
  return async (c: Context, next) => {
    const key = `rl:${c.req.path}:${clientIp(c)}`;
    try {
      const redis = getValkey();
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, Math.ceil(opts.windowMs / 1000));
      }
      if (count > opts.max) {
        return c.json(
          {
            error: {
              code: 'rate_limited',
              message_th: 'กรุณาลองใหม่อีกครั้งในภายหลัง',
              message_en: 'Too many requests, please try again later.',
              request_id: c.get('requestId'),
            },
          },
          429,
        );
      }
      await next();
    } catch (err) {
      getLogger().warn({ err }, 'rate limiter unavailable — failing open');
      await next();
    }
  };
}

function clientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const cf = c.req.header('cf-connecting-ip');
  if (cf) return cf;
  return c.req.header('x-real-ip') ?? 'unknown';
}

import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv } from '../config';

export type CartLine = { productId: string; quantity: number };

/**
 * The cart is a signed cookie rather than a server-side session: guests never
 * authenticate, and the only thing worth protecting is tampering with the
 * contents. Prices are always re-read from the DB, never from the cookie.
 */
function sign(payload: string): string {
  return createHmac('sha256', getEnv().SESSION_SECRET).update(payload).digest('base64url');
}

export function encodeCart(lines: CartLine[]): string {
  const payload = Buffer.from(JSON.stringify(lines), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function decodeCart(raw: string | undefined): CartLine[] {
  if (!raw) return [];

  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return [];

  const payload = raw.slice(0, dot);
  const provided = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(sign(payload));

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return [];

  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((line): CartLine[] => {
      if (typeof line !== 'object' || line === null) return [];
      const { productId, quantity } = line as Record<string, unknown>;
      if (typeof productId !== 'string' || typeof quantity !== 'number') return [];
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return [];
      return [{ productId, quantity }];
    });
  } catch {
    return [];
  }
}

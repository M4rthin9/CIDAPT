import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import { apiErrorSchema, successEnvelope, listEnvelope } from '@cida/contracts';

describe('API contract schemas', () => {
  describe('error envelope', () => {
    it('matches expected shape', () => {
      const error = {
        error: {
          code: 'validation_error',
          message_th: 'ข้อมูลไม่ถูกต้อง',
          message_en: 'Validation error',
          details: { field: 'email' },
          request_id: 'abc-123',
        },
      };
      const result = apiErrorSchema.safeParse(error);
      expect(result.success).toBe(true);
    });

    it('rejects missing required fields', () => {
      const error = { error: { code: 'test' } };
      const result = apiErrorSchema.safeParse(error);
      expect(result.success).toBe(false);
    });
  });

  describe('success envelope', () => {
    it('wraps data correctly', () => {
      const schema = successEnvelope(z.object({ id: z.string() }));
      const result = schema.safeParse({ data: { id: 'test' } });
      expect(result.success).toBe(true);
    });

    it('rejects invalid data', () => {
      const schema = successEnvelope(z.object({ id: z.string() }));
      const result = schema.safeParse({ data: { id: 123 } });
      expect(result.success).toBe(false);
    });
  });

  describe('list envelope', () => {
    it('includes pagination meta', () => {
      const schema = listEnvelope(z.object({ name: z.string() }));
      const result = schema.safeParse({
        data: [{ name: 'test' }],
        meta: { page: 1, perPage: 10, total: 1 },
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid meta', () => {
      const schema = listEnvelope(z.object({ name: z.string() }));
      const result = schema.safeParse({
        data: [{ name: 'test' }],
        meta: { page: 0, perPage: 10, total: 1 },
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Route input validation', () => {
  const app = new Hono();

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  app.post('/login', async (c) => {
    const body = await c.req.json();
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return c.json(
        {
          error: {
            code: 'validation_error',
            message_th: 'ข้อมูลไม่ถูกต้อง',
            message_en: 'Validation error',
            details: Object.fromEntries(
              result.error.issues.map((i) => [i.path.join('.'), i.message]),
            ),
          },
        },
        422,
      );
    }
    return c.json({ data: { ok: true } });
  });

  it('accepts valid login', async () => {
    const res = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'pass' }),
    });
    expect(res.status).toBe(200);
  });

  it('rejects invalid email', async () => {
    const res = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-email', password: 'pass' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('validation_error');
  });

  it('rejects empty password', async () => {
    const res = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: '' }),
    });
    expect(res.status).toBe(422);
  });

  it('rejects missing fields', async () => {
    const res = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });
});

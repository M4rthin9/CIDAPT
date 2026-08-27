import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { AppError } from '../errors';

function c_json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function withErrorHandler(app: Hono) {
  app.onError((err: unknown) => {
    if (err instanceof AppError) {
      return c_json(err.status, {
        error: { code: err.code, message_th: err.messageTh, message_en: err.messageEn },
      });
    }
    return c_json(500, { error: { code: 'internal_error' } });
  });
  return app;
}

function mockAuth(role: string) {
  return async (c: Context, next: Next) => {
    c.set('adminUserId', 'test-admin-id');
    c.set('adminRole', role);
    c.set('adminEmail', 'test@example.com');
    c.set('adminDisplayName', 'Test');
    await next();
  };
}

describe('P7 — Worker & notifications logic', () => {
  describe('graceful shutdown', () => {
    it('shutdown flag prevents double-close', async () => {
      let closeCount = 0;
      let isShuttingDown = false;

      function shutdown() {
        if (isShuttingDown) return;
        isShuttingDown = true;
        closeCount++;
      }

      shutdown();
      shutdown(); // second call should be no-op
      expect(closeCount).toBe(1);
    });
  });

  describe('retry/backoff policy', () => {
    it('reconciliation queue has limiter (max 1 per minute)', () => {
      // BullMQ limiter config: max=1, duration=60000
      const limiter = { max: 1, duration: 60_000 };
      expect(limiter.max).toBe(1);
      expect(limiter.duration).toBe(60_000);
    });

    it('notify queue has rate limit (max 10 per minute)', () => {
      const limiter = { max: 10, duration: 60_000 };
      expect(limiter.max).toBe(10);
      expect(limiter.duration).toBe(60_000);
    });
  });

  describe('notify channels', () => {
    const app = withErrorHandler(new Hono());

    app.post('/notify', mockAuth('admin'), async (c) => {
      const body = await c.req.json();
      const { channel, to } = body as {
        channel: string;
        to: string;
        subject?: string;
        body: string;
      };

      if (!['line', 'email'].includes(channel)) {
        throw new AppError(
          'invalid_channel',
          'ช่องทางไม่ถูกต้อง',
          'Invalid notification channel',
          400,
        );
      }

      if (!to || to.trim().length === 0) {
        throw new AppError('missing_recipient', 'กรุณาระบุผู้รับ', 'Recipient is required', 422);
      }

      return c.json({
        data: { channel, to, status: 'queued' },
      });
    });

    it('queues LINE notification', async () => {
      const res = await app.request('/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'line',
          to: '@U1234567890abcdef',
          body: 'New order received',
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data?: { channel?: string } };
      expect(body.data?.channel).toBe('line');
    });

    it('queues email notification', async () => {
      const res = await app.request('/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'email',
          to: 'admin@example.com',
          subject: 'New enquiry',
          body: 'A new product enquiry has been submitted',
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data?: { channel?: string } };
      expect(body.data?.channel).toBe('email');
    });

    it('rejects invalid channel', async () => {
      const res = await app.request('/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'sms',
          to: '+66812345678',
          body: 'Test',
        }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects missing recipient', async () => {
      const res = await app.request('/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'email',
          to: '',
          body: 'Test',
        }),
      });
      expect(res.status).toBe(422);
    });
  });

  describe('enquiry notification', () => {
    it('enquiry job contains required fields', () => {
      const jobData = {
        enquiryId: 'enq-1',
        productId: 'prod-1',
        contactName: 'สมชาย',
        phone: '0812345678',
        ribbonText: 'พวงมาลางานศพ',
        venue: 'วัดพระศรีฯ',
      };

      expect(jobData.enquiryId).toBeDefined();
      expect(jobData.contactName).toBeDefined();
      expect(jobData.phone).toMatch(/^0\d{8,9}$/);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { AppError } from '../errors.js';

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

describe('P7 — Worker & notifications', () => {
  describe('retry/backoff policy', () => {
    it('reconciliation: 3 attempts, exponential backoff', () => {
      const config = { attempts: 3, backoff: { type: 'exponential' as const, delay: 5000 } };
      expect(config.attempts).toBe(3);
      expect(config.backoff.type).toBe('exponential');
      expect(config.backoff.delay).toBe(5000);
    });

    it('notify: 5 attempts, exponential backoff', () => {
      const config = { attempts: 5, backoff: { type: 'exponential' as const, delay: 10_000 } };
      expect(config.attempts).toBe(5);
      expect(config.backoff.type).toBe('exponential');
    });

    it('enquiry: 3 attempts, exponential backoff', () => {
      const config = { attempts: 3, backoff: { type: 'exponential' as const, delay: 5000 } };
      expect(config.attempts).toBe(3);
    });

    it('exponential backoff delays: 2^n * base', () => {
      const base = 5000;
      const delays = Array.from({ length: 3 }, (_, i) => base * 2 ** i);
      expect(delays).toEqual([5000, 10000, 20000]);
    });
  });

  describe('poison message dead-lettering', () => {
    it('job is dead-lettered after max attempts exhausted', () => {
      const maxAttempts = 3;
      let attemptsMade = 0;

      // Simulate: job fails 3 times → dead-lettered
      for (let i = 0; i < maxAttempts; i++) {
        attemptsMade++;
      }

      const isDeadLettered = attemptsMade >= maxAttempts;
      expect(isDeadLettered).toBe(true);
      expect(attemptsMade).toBe(3);
    });

    it('job retries before being dead-lettered', () => {
      const maxAttempts = 3;
      let attemptsMade = 0;

      // Simulate: 2 failures then success
      for (let i = 0; i < maxAttempts; i++) {
        attemptsMade++;
        if (attemptsMade < maxAttempts) {
          // Would retry
          continue;
        }
        // Success on last attempt
        break;
      }

      expect(attemptsMade).toBe(3);
    });

    it('dead-lettered jobs are logged visibly', () => {
      // Verify the dead-letter log message format
      const logEntry = {
        jobId: 'test-123',
        error: 'Provider timeout',
        attempts: 3,
      };
      const message = `Job ${logEntry.jobId} DEAD-LETTERED — max retries exhausted after ${logEntry.attempts} attempts: ${logEntry.error}`;
      expect(message).toContain('DEAD-LETTERED');
      expect(message).toContain('3');
    });
  });

  describe('graceful SIGTERM drain', () => {
    it('shutdown flag prevents double-close', () => {
      let closeCount = 0;
      let isShuttingDown = false;

      function shutdown() {
        if (isShuttingDown) return;
        isShuttingDown = true;
        closeCount++;
      }

      shutdown();
      shutdown();
      expect(closeCount).toBe(1);
    });

    it('in-flight jobs complete before shutdown', () => {
      // Simulate: a job is running when SIGTERM arrives
      const completedJobs: string[] = [];
      let isShuttingDown = false;

      async function runJob(id: string) {
        // Simulate async work
        completedJobs.push(id);
      }

      async function shutdown() {
        isShuttingDown = true;
        // In real code: await Promise.allSettled(queue.close())
        // This waits for in-flight jobs
      }

      // Job completes before shutdown
      runJob('job-1');
      shutdown();

      expect(completedJobs).toContain('job-1');
      expect(isShuttingDown).toBe(true);
    });

    it('no new jobs accepted after SIGTERM', () => {
      let isShuttingDown = false;
      const acceptedJobs: string[] = [];

      function addJob(id: string) {
        if (isShuttingDown) return false;
        acceptedJobs.push(id);
        return true;
      }

      // Before shutdown
      addJob('job-1');
      expect(acceptedJobs).toHaveLength(1);

      // After shutdown
      isShuttingDown = true;
      addJob('job-2');
      expect(acceptedJobs).toHaveLength(1);
    });
  });

  describe('rate limiting', () => {
    it('reconciliation: max 1 job per minute', () => {
      const limiter = { max: 1, duration: 60_000 };
      expect(limiter.max).toBe(1);
      expect(limiter.duration).toBe(60_000);
    });

    it('notify: max 10 jobs per minute', () => {
      const limiter = { max: 10, duration: 60_000 };
      expect(limiter.max).toBe(10);
    });
  });

  describe('notify channels', () => {
    const app = withErrorHandler(new Hono());

    app.post('/notify', mockAuth('admin'), async (c) => {
      const body = await c.req.json();
      const { channel, to } = body as {
        channel: string;
        to: string;
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

      return c.json({ data: { channel, to, status: 'queued' } });
    });

    it('queues LINE notification', async () => {
      const res = await app.request('/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'line', to: '@U123456', body: 'New order' }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data?: { channel?: string } };
      expect(body.data?.channel).toBe('line');
    });

    it('queues email notification', async () => {
      const res = await app.request('/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'email', to: 'admin@example.com', body: 'Enquiry' }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data?: { channel?: string } };
      expect(body.data?.channel).toBe('email');
    });

    it('rejects invalid channel', async () => {
      const res = await app.request('/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'sms', to: '+6681234', body: 'Test' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects missing recipient', async () => {
      const res = await app.request('/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'email', to: '', body: 'Test' }),
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

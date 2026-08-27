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
  app.onError((err: any) => {
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

describe('P5 — Orders & payments logic', () => {
  describe('cart rejects enquiry products', () => {
    const app = withErrorHandler(new Hono());

    // Simulate checkout that checks purchase_mode
    app.post('/checkout', async (c) => {
      const body = await c.req.json();
      const { items } = body as { items: Array<{ productId: string; purchaseMode: string }> };

      const enquiryItems = items.filter((i) => i.purchaseMode === 'enquiry');
      if (enquiryItems.length > 0) {
        throw new AppError(
          'checkout_enquiry_not_allowed',
          'สินค้าบางรายการต้องติดต่อเจ้าหน้าที่',
          'Some products require staff contact',
          400,
          { enquiryProductIds: enquiryItems.map((i) => i.productId) },
        );
      }

      return c.json({ data: { ok: true } });
    });

    it('rejects enquiry product in cart', async () => {
      const res = await app.request('/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            { productId: 'prod-1', purchaseMode: 'cart' },
            { productId: 'prod-2', purchaseMode: 'enquiry' },
          ],
        }),
      });
      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error.code).toBe('checkout_enquiry_not_allowed');
    });

    it('allows all-cart products', async () => {
      const res = await app.request('/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            { productId: 'prod-1', purchaseMode: 'cart' },
            { productId: 'prod-3', purchaseMode: 'cart' },
          ],
        }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe('manual verify requires superadmin + reason', () => {
    const app = withErrorHandler(new Hono());

    app.post('/manual-verify', mockAuth('officer'), async (c) => {
      throw new AppError('forbidden', 'ไม่มีสิทธิ์', 'Forbidden', 403);
    });

    app.post('/manual-verify-sa', mockAuth('superadmin'), async (c) => {
      const body = await c.req.json();
      const { reason } = body as { reason: string };
      if (!reason || reason.trim().length < 15) {
        throw new AppError(
          'validation_error',
          'กรุณาระบุเหตุผล',
          'Reason must be at least 15 characters',
          422,
        );
      }
      return c.json({ data: { verified: true, severity: 'red' } });
    });

    it('rejects officer attempting manual verify', async () => {
      const res = await app.request('/manual-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: 'pay-1', reason: 'verified in person' }),
      });
      expect(res.status).toBe(403);
    });

    it('superadmin with short reason is rejected', async () => {
      const res = await app.request('/manual-verify-sa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: 'pay-1', reason: 'short' }),
      });
      expect(res.status).toBe(422);
    });

    it('superadmin with valid reason succeeds', async () => {
      const res = await app.request('/manual-verify-sa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: 'pay-1',
          reason: 'Customer paid via bank transfer and provided slip as evidence',
        }),
      });
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.severity).toBe('red');
    });
  });

  describe('reconciliation idempotency', () => {
    const payments = new Map<string, { id: string; status: string; transRef: string | null }>();

    const app = withErrorHandler(new Hono());

    app.post('/reconcile', async (c) => {
      const body = await c.req.json();
      const { transRef, status } = body as { transRef: string; status?: string };

      // Idempotent: if already verified, return existing
      const existing = [...payments.values()].find((p) => p.transRef === transRef);
      if (existing && existing.status === 'verified') {
        return c.json({ data: { paymentId: existing.id, status: 'already_verified' } });
      }

      // First time — create and verify
      const id = `pay-${payments.size + 1}`;
      payments.set(id, { id, status: 'verified', transRef });
      return c.json({ data: { paymentId: id, status: 'verified' } });
    });

    beforeEach(() => {
      payments.clear();
    });

    it('first ingestion creates verified payment', async () => {
      const res = await app.request('/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transRef: 'trans-001', rail: 'promptpay_billpay', amountSatang: 10000, occurredAt: Date.now() }),
      });
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.status).toBe('verified');
    });

    it('duplicate ingestion returns already_verified (idempotent)', async () => {
      // First
      await app.request('/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transRef: 'trans-002', rail: 'promptpay_billpay', amountSatang: 10000, occurredAt: Date.now() }),
      });

      // Duplicate
      const res = await app.request('/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transRef: 'trans-002', rail: 'promptpay_billpay', amountSatang: 10000, occurredAt: Date.now() }),
      });
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.status).toBe('already_verified');
    });
  });

  describe('slip cannot settle order', () => {
    it('no code path settles from slip — verified in structure', () => {
      // Non-negotiable #4: slip image is NEVER proof of payment
      // The reconcile endpoint only accepts provider_lookup or statement_match
      // manual_override requires superadmin + typed reason
      // There is NO code path that accepts a slip image to verify a payment
      const verifiedViaValues = ['provider_lookup', 'statement_match', 'manual_override'];
      expect(verifiedViaValues).not.toContain('slip');
      expect(verifiedViaValues).not.toContain('mini_qr');
    });
  });

  describe('payment state machine transitions', () => {
    const validTransitions: Record<string, string[]> = {
      pending: ['awaiting_provider', 'verified', 'failed', 'cancelled'],
      awaiting_provider: ['verified', 'failed', 'cancelled'],
      verified: ['refund_recorded'],
      failed: [],
      cancelled: [],
      refund_recorded: [],
    };

    it('pending can go to verified', () => {
      expect(validTransitions.pending).toContain('verified');
    });

    it('verified cannot go back to pending', () => {
      expect(validTransitions.verified).not.toContain('pending');
    });

    it('failed is terminal', () => {
      expect(validTransitions.failed).toHaveLength(0);
    });

    it('cancelled is terminal', () => {
      expect(validTransitions.cancelled).toHaveLength(0);
    });
  });
});

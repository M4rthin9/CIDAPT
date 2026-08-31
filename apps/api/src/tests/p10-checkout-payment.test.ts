import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { AppError } from '../errors.js';

/**
 * P10 — backend-selected payment rail at checkout (HTTP level).
 *
 * The pure rail-selection logic is covered by p10-payments-rail.test.ts. This
 * suite drives the REAL checkout route end-to-end through createPayment() —
 * the DB + audit path that auto-initiates a pending payment and returns the
 * rail + QR / account payload the storefront renders.
 */

const PRODUCT_ID = '33333333-3333-4333-8333-333333333333';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';

const h = vi.hoisted(() => ({
  queue: [] as unknown[][],
  rows: [] as unknown[],
  audit: vi.fn<(c: unknown, entry: Record<string, unknown>) => Promise<void>>(async () => {}),
}));

vi.mock('../middleware/audit', () => ({ writeAuditLog: h.audit }));

vi.mock('../middleware/auth', () => ({
  authMiddleware: async (_c: Context, next: Next) => {
    await next();
  },
  hashPassword: (p: string) => `hashed:${p}`,
}));

vi.mock('../lib/order-no', () => ({ nextOrderNo: async () => 'CIDA-2608-00099' }));

vi.mock('../config', () => ({
  getEnv: () => ({
    BILLER_COMP_CODE: '',
    PROMPTPAY_NUMBER: '0812345678',
    BANK_NAME: '',
    BANK_ACCOUNT_NAME: '',
    BANK_ACCOUNT_NO: '',
  }),
}));

vi.mock('../db', () => {
  const chain: Record<string, unknown> = {};
  const methods = [
    'select',
    'from',
    'where',
    'limit',
    'orderBy',
    'innerJoin',
    'leftJoin',
    'insert',
    'values',
    'returning',
    'update',
    'set',
    'delete',
    'onConflictDoUpdate',
  ];
  for (const m of methods) chain[m] = () => chain;
  // `transaction(cb)` resolves by invoking the callback with the same permissive
  // chain; inside it `tx.insert().values().returning()` resolves from the queue.
  chain['transaction'] = async (cb: (tx: unknown) => Promise<unknown>) => cb(chain);
  chain['then'] = (resolve: (v: unknown) => unknown) =>
    resolve(h.queue.length > 0 ? h.queue.shift() : h.rows);
  return { db: { instance: chain }, getDb: () => chain, closeDb: async () => {} };
});

const { default: checkout } = await import('../routes/checkout.js');

function app() {
  const a = new Hono();
  a.route('/checkout', checkout);
  a.onError((err) => {
    const status = err instanceof AppError ? err.status : 500;
    const code = err instanceof AppError ? err.code : 'internal_error';
    return new Response(JSON.stringify({ error: { code } }), {
      status: status as number,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return a;
}

const VALID_BODY = {
  items: [{ productId: PRODUCT_ID, quantity: 2 }],
  contactName: 'สมชาย ใจดี',
  phone: '0812345678',
  email: 'somchai@example.com',
  shipping: {
    addrLine1: '1/1 ถนนสุขุมวิท',
    addrLine2: '',
    subdistrict: 'คลองเตย',
    district: 'คลองเตย',
    province: 'กรุงเทพมหานคร',
    postcode: '10110',
  },
};

beforeEach(() => {
  h.queue = [];
  h.rows = [];
  h.audit.mockClear();
});

describe('checkout auto-selects rail and auto-initiates a pending payment', () => {
  it('returns rail + payment (with a tag-29 QR for the merchant PromptPay number)', async () => {
    // Query order along the checkout path:
    //  1. product select          -> one cart product
    //  2. transaction orders      -> created order (pending_payment)
    //  3. createPayment order     -> pending_payment lookup
    //  4. createPayment insert    -> payment row
    h.queue.push([
      {
        id: PRODUCT_ID,
        purchaseMode: 'cart',
        priceSatang: 1000,
        sku: 'CIDA-001',
        nameTh: 'แจกัน',
        nameEn: 'Vase',
      },
    ]);
    h.queue.push([
      {
        id: ORDER_ID,
        orderNo: 'CIDA-2608-00099',
        status: 'pending_payment',
        totalSatang: 2000,
      },
    ]);
    h.queue.push([{ id: 'item-1' }]);
    h.queue.push([
      {
        id: ORDER_ID,
        orderNo: 'CIDA-2608-00099',
        status: 'pending_payment',
        totalSatang: 2000,
      },
    ]);
    h.queue.push([{ id: 'pay-1', status: 'pending' }]);

    const res = await app().request('/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data?: {
        orderId: string;
        orderNo: string;
        rail: string;
        payment: {
          paymentId: string;
          rail: string;
          amountSatang: number;
          status: string;
          qrPayload?: string;
        };
      };
    };
    expect(body.data?.orderNo).toBe('CIDA-2608-00099');
    expect(body.data?.rail).toBe('promptpay_ewallet');
    expect(body.data?.payment.paymentId).toBe('pay-1');
    expect(body.data?.payment.rail).toBe('promptpay_ewallet');
    expect(body.data?.payment.amountSatang).toBe(2000);
    expect(body.data?.payment.status).toBe('pending');
    // The tag-29 QR targets the merchant PromptPay number.
    expect(body.data?.payment.qrPayload).toContain('0066812345678');
  });

  it('writes a payment.initiate audit row for the new payment', async () => {
    [
      [
        {
          id: PRODUCT_ID,
          purchaseMode: 'cart',
          priceSatang: 1000,
          sku: 'CIDA-001',
          nameTh: 'แจกัน',
          nameEn: 'Vase',
        },
      ],
      [
        {
          id: ORDER_ID,
          orderNo: 'CIDA-2608-00099',
          status: 'pending_payment',
          totalSatang: 2000,
        },
      ],
      [{ id: 'item-1' }],
      [
        {
          id: ORDER_ID,
          orderNo: 'CIDA-2608-00099',
          status: 'pending_payment',
          totalSatang: 2000,
        },
      ],
      [{ id: 'pay-1', status: 'pending' }],
    ].forEach((row) => h.queue.push(row));

    await app().request('/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });

    const initiate = h.audit.mock.calls.find(([, e]) => e.action === 'payment.initiate');
    expect(initiate).toBeTruthy();
    expect(initiate?.[1].entityId).toBe('pay-1');
    expect(initiate?.[1].afterState).toEqual({
      orderId: ORDER_ID,
      rail: 'promptpay_ewallet',
      amountSatang: 2000,
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { AppError } from '../errors';
import {
  eventUpsertSchema,
  newsUpsertSchema,
  pageUpsertSchema,
  productPublishSchema,
} from '@cida/contracts';

/**
 * P9 acceptance suite.
 *
 * Three gates from PLAN.md:
 *   1. every mutating admin action writes an audit_log row,
 *   2. publish is blocked when either language is empty,
 *   3. the role matrix holds on every admin endpoint.
 *
 * Auth, audit and the DB are mocked so the suite stays a unit test — the point
 * is the routing/authorisation wiring, not Postgres behaviour.
 */

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const PRODUCT_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const ENQUIRY_ID = '55555555-5555-4555-8555-555555555555';

// `vi.mock` factories are hoisted above imports, so shared handles must be too.
const h = vi.hoisted(() => ({
  role: 'superadmin' as string,
  // A permissive canned row: every terminal await in a route resolves to this,
  // which is enough for handlers that only read `.id` / `.role` off the result.
  rows: [{ id: 'row-1', n: 1, role: 'admin', code: 'SPRING', publishedAt: null }] as unknown[],
  // Queued results for handlers whose queries must differ (e.g. "no duplicate
  // exists" followed by "here is the inserted row"). Consumed in order; once
  // empty, queries fall back to `rows`.
  queue: [] as unknown[][],
  // Typed with writeAuditLog's real signature so `mock.calls[n][1]` is the entry.
  audit: vi.fn<(c: unknown, entry: Record<string, unknown>) => Promise<void>>(async () => {}),
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: Context, next: Next) => {
    c.set('adminUserId', USER_ID);
    c.set('adminRole', h.role);
    c.set('adminEmail', 'operator@example.com');
    c.set('adminDisplayName', 'Operator');
    await next();
  },
  hashPassword: (p: string) => `hashed:${p}`,
}));

vi.mock('../middleware/audit', () => ({
  writeAuditLog: h.audit,
}));

vi.mock('../db', () => {
  // Every builder method returns the same thenable, so any drizzle chain
  // (`select().from().where().limit()`, `insert().values().returning()`, …)
  // resolves to `h.rows`.
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
  chain['then'] = (resolve: (v: unknown) => unknown) =>
    resolve(h.queue.length > 0 ? h.queue.shift() : h.rows);
  return { db: { instance: chain }, getDb: () => chain, closeDb: async () => {} };
});

const { default: catalogAdmin } = await import('../routes/catalog-admin');
const { default: contentRoutes } = await import('../routes/content');
const { default: couponRoutes } = await import('../routes/coupons');
const { default: inventoryRoutes } = await import('../routes/inventory');
const { default: ordersAdmin } = await import('../routes/orders-admin');
const { default: enquiriesAdmin } = await import('../routes/enquiries-admin');
const { default: adminUserRoutes } = await import('../routes/admin-users');
const { default: auditRoutes } = await import('../routes/audit');
const { default: adminSummary } = await import('../routes/admin-summary');

function app() {
  const a = new Hono();
  a.route('/catalog', catalogAdmin);
  a.route('/content', contentRoutes);
  a.route('/coupons', couponRoutes);
  a.route('/inventory', inventoryRoutes);
  a.route('/orders', ordersAdmin);
  a.route('/enquiries', enquiriesAdmin);
  a.route('/users', adminUserRoutes);
  a.route('/audit', auditRoutes);
  a.route('/summary', adminSummary);
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

function post(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  h.role = 'superadmin';
  h.rows = [{ id: 'row-1', n: 1, role: 'admin', code: 'SPRING', publishedAt: null }];
  h.queue = [];
  h.audit.mockClear();
});

// ---------------------------------------------------------------------------
// 1. Bilingual publish gate — enforced by the contracts the API parses with.
// ---------------------------------------------------------------------------

describe('P9 — publish blocked when either language is empty', () => {
  const productBase = {
    categoryId: CATEGORY_ID,
    sku: 'CIDA-001',
    lotCode: 'LOT-1',
    purchaseMode: 'cart' as const,
    nameTh: 'แจกันดินเผา',
    nameEn: 'Terracotta vase',
    bodyTh: 'รายละเอียดภาษาไทย',
    bodyEn: 'English description',
    materialTh: null,
    materialEn: null,
    finishNoteTh: null,
    finishNoteEn: null,
    priceSatang: 120000,
    status: 'published' as const,
  };

  it('accepts a product with both languages filled', () => {
    expect(productPublishSchema.safeParse(productBase).success).toBe(true);
  });

  it('rejects a product missing the English name', () => {
    expect(productPublishSchema.safeParse({ ...productBase, nameEn: '' }).success).toBe(false);
  });

  it('rejects a product missing the Thai name', () => {
    expect(productPublishSchema.safeParse({ ...productBase, nameTh: '' }).success).toBe(false);
  });

  it('rejects a product with a null body in either language', () => {
    expect(productPublishSchema.safeParse({ ...productBase, bodyEn: null }).success).toBe(false);
    expect(productPublishSchema.safeParse({ ...productBase, bodyTh: null }).success).toBe(false);
  });

  const pageBase = {
    slugTh: 'about',
    slugEn: 'about',
    titleTh: 'เกี่ยวกับเรา',
    titleEn: 'About us',
    bodyTh: 'เนื้อหา',
    bodyEn: 'Body',
    status: 'published' as const,
  };

  it('accepts a page with both languages, rejects a half-filled one', () => {
    expect(pageUpsertSchema.safeParse(pageBase).success).toBe(true);
    expect(pageUpsertSchema.safeParse({ ...pageBase, bodyEn: '' }).success).toBe(false);
    expect(pageUpsertSchema.safeParse({ ...pageBase, titleEn: '' }).success).toBe(false);
  });

  it('allows a half-filled page to be saved as a draft', () => {
    const draft = { ...pageBase, status: 'draft' as const, bodyEn: '', titleEn: '' };
    expect(pageUpsertSchema.safeParse(draft).success).toBe(true);
  });

  const newsBase = {
    slugTh: 'news-1',
    slugEn: 'news-1',
    titleTh: 'ข่าว',
    titleEn: 'News',
    excerptTh: null,
    excerptEn: null,
    bodyTh: 'เนื้อหา',
    bodyEn: 'Body',
    heroImageKey: null,
    status: 'published' as const,
    publishAt: null,
  };

  it('gates news posts on both languages', () => {
    expect(newsUpsertSchema.safeParse(newsBase).success).toBe(true);
    expect(newsUpsertSchema.safeParse({ ...newsBase, bodyTh: null }).success).toBe(false);
  });

  const eventBase = {
    titleTh: 'งานแสดง',
    titleEn: 'Exhibition',
    descriptionTh: 'รายละเอียด',
    descriptionEn: 'Details',
    locationTh: null,
    locationEn: null,
    startsAt: 1_800_000_000,
    endsAt: null,
    heroImageKey: null,
    status: 'published' as const,
  };

  it('gates events on both languages', () => {
    expect(eventUpsertSchema.safeParse(eventBase).success).toBe(true);
    expect(eventUpsertSchema.safeParse({ ...eventBase, descriptionEn: null }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Role matrix — UI hiding is cosmetic; these endpoints must refuse directly.
// ---------------------------------------------------------------------------

describe('P9 — role matrix on admin endpoints', () => {
  const cases: { path: string; floor: 'officer' | 'admin' | 'superadmin' }[] = [
    { path: '/summary', floor: 'officer' },
    { path: '/orders', floor: 'officer' },
    { path: '/inventory/stock', floor: 'officer' },
    { path: '/enquiries', floor: 'officer' },
    { path: '/catalog/products', floor: 'admin' },
    { path: '/content/pages', floor: 'admin' },
    { path: '/coupons', floor: 'admin' },
    { path: '/users', floor: 'superadmin' },
    { path: '/audit', floor: 'superadmin' },
  ];

  const below: Record<string, string[]> = {
    officer: [],
    admin: ['officer'],
    superadmin: ['officer', 'admin'],
  };

  const atOrAbove: Record<string, string[]> = {
    officer: ['officer', 'admin', 'superadmin'],
    admin: ['admin', 'superadmin'],
    superadmin: ['superadmin'],
  };

  for (const { path, floor } of cases) {
    for (const role of below[floor]!) {
      it(`${path} rejects ${role} (floor: ${floor})`, async () => {
        h.role = role;
        const res = await app().request(`http://local${path}`);
        expect(res.status).toBe(403);
      });
    }

    for (const role of atOrAbove[floor]!) {
      it(`${path} admits ${role} (floor: ${floor})`, async () => {
        h.role = role;
        const res = await app().request(`http://local${path}`);
        expect(res.status).not.toBe(403);
      });
    }
  }

  it('rejects a request carrying no role at all', async () => {
    h.role = '';
    const res = await app().request('http://local/orders');
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 3. Audit trail — every mutating action records who did what.
// ---------------------------------------------------------------------------

describe('P9 — mutating actions write an audit_log row', () => {
  it('product create', async () => {
    const res = await app().request(
      post('/catalog/products', {
        categoryId: CATEGORY_ID,
        sku: 'CIDA-002',
        lotCode: 'LOT-2',
        purchaseMode: 'cart',
        nameTh: 'ชาม',
        nameEn: 'Bowl',
        bodyTh: 'ก',
        bodyEn: 'a',
        materialTh: null,
        materialEn: null,
        finishNoteTh: null,
        finishNoteEn: null,
        priceSatang: 50000,
      }),
    );
    expect(res.status).toBe(200);
    expect(h.audit).toHaveBeenCalledTimes(1);
    expect(h.audit.mock.calls[0]?.[1]).toMatchObject({
      action: 'product.create',
      entityType: 'product',
    });
  });

  it('product publish', async () => {
    const res = await app().request(
      post(`/catalog/products/${PRODUCT_ID}/publish`, {
        categoryId: CATEGORY_ID,
        sku: 'CIDA-003',
        lotCode: 'LOT-3',
        purchaseMode: 'cart',
        nameTh: 'จาน',
        nameEn: 'Plate',
        bodyTh: 'ข',
        bodyEn: 'b',
        materialTh: null,
        materialEn: null,
        finishNoteTh: null,
        finishNoteEn: null,
        priceSatang: 30000,
        status: 'published',
      }),
    );
    expect(res.status).toBe(200);
    expect(h.audit.mock.calls[0]?.[1]).toMatchObject({ action: 'product.publish' });
  });

  it('product publish is refused — and audits nothing — when English is empty', async () => {
    const res = await app().request(
      post(`/catalog/products/${PRODUCT_ID}/publish`, {
        categoryId: CATEGORY_ID,
        sku: 'CIDA-004',
        lotCode: 'LOT-4',
        purchaseMode: 'cart',
        nameTh: 'ถ้วย',
        nameEn: '',
        bodyTh: 'ค',
        bodyEn: null,
        materialTh: null,
        materialEn: null,
        finishNoteTh: null,
        finishNoteEn: null,
        priceSatang: 30000,
        status: 'published',
      }),
    );
    expect(res.status).toBe(422);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('page upsert', async () => {
    const res = await app().request(
      post('/content/pages', {
        slugTh: 'contact',
        slugEn: 'contact',
        titleTh: 'ติดต่อ',
        titleEn: 'Contact',
        bodyTh: 'ง',
        bodyEn: 'd',
        status: 'published',
      }),
    );
    expect(res.status).toBe(200);
    expect(h.audit).toHaveBeenCalledTimes(1);
    expect(h.audit.mock.calls[0]?.[1]).toMatchObject({ entityType: 'page' });
  });

  it('coupon create', async () => {
    const res = await app().request(
      post('/coupons', {
        code: 'SPRING10',
        kind: 'percent',
        valuePercent: 10,
        valueSatang: null,
        startsAt: null,
        endsAt: null,
        maxRedemptions: null,
        active: true,
      }),
    );
    expect(res.status).toBe(200);
    expect(h.audit.mock.calls[0]?.[1]).toMatchObject({
      action: 'coupon.create',
      entityType: 'coupon',
    });
  });

  it('inventory ledger entry', async () => {
    const res = await app().request(
      post('/inventory', {
        productId: PRODUCT_ID,
        delta: 12,
        reason: 'production_receipt',
        refType: null,
        refId: null,
        note: 'kiln batch 4',
      }),
    );
    expect(res.status).toBe(200);
    expect(h.audit.mock.calls[0]?.[1]).toMatchObject({
      action: 'inventory.production_receipt',
      entityType: 'product',
    });
  });

  it('order status change', async () => {
    const res = await app().request(
      new Request(`http://local/orders/${ORDER_ID}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'shipped', trackingNo: 'TH123' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(200);
    expect(h.audit.mock.calls[0]?.[1]).toMatchObject({
      action: 'order.status.shipped',
      entityType: 'order',
    });
  });

  it('enquiry status change', async () => {
    const res = await app().request(
      new Request(`http://local/enquiries/${ENQUIRY_ID}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'contacted' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(200);
    expect(h.audit.mock.calls[0]?.[1]).toMatchObject({
      action: 'enquiry.status.contacted',
      entityType: 'product_enquiry',
    });
  });

  it('admin user create', async () => {
    // First query is the duplicate-email guard (must be empty), second is the
    // insert's RETURNING clause.
    h.queue = [[], [{ id: 'user-9', email: 'new.operator@example.com', role: 'officer' }]];
    const res = await app().request(
      post('/users', {
        email: 'New.Operator@example.com',
        password: 'a-long-enough-password',
        displayName: 'New Operator',
        role: 'officer',
      }),
    );
    expect(res.status).toBe(200);
    expect(h.audit.mock.calls[0]?.[1]).toMatchObject({
      action: 'admin_user.create',
      entityType: 'admin_user',
    });
  });

  it('admin user create is refused when the email already exists', async () => {
    const res = await app().request(
      post('/users', {
        email: 'taken@example.com',
        password: 'a-long-enough-password',
        displayName: 'Dupe',
        role: 'officer',
      }),
    );
    expect(res.status).toBe(409);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('the last superadmin cannot be deactivated', async () => {
    // existing row is a superadmin; the guard's follow-up count returns one row.
    h.queue = [[{ id: USER_ID, role: 'superadmin', active: true }], [{ id: USER_ID }]];
    const res = await app().request(
      new Request(`http://local/users/${USER_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ active: false }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(409);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('coupon delete', async () => {
    const res = await app().request(
      new Request('http://local/coupons/row-1', { method: 'DELETE' }),
    );
    expect(res.status).toBe(200);
    expect(h.audit.mock.calls[0]?.[1]).toMatchObject({ action: 'coupon.delete' });
  });

  it('reads do not write audit rows', async () => {
    await app().request('http://local/orders');
    await app().request('http://local/coupons');
    await app().request('http://local/audit');
    expect(h.audit).not.toHaveBeenCalled();
  });
});

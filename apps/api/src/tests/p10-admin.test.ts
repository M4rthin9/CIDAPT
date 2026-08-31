import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { AppError } from '../errors.js';

/**
 * P10 carried-gap suite for the admin surface added during P10:
 *   - Reports (order aggregation + CSV export) — officer floor,
 *   - Manual-verify support (payments list) — superadmin floor.
 *
 * Auth, audit and the DB are mocked the same way as p9.test.ts: the point is
 * the routing + role-gating wiring, not Postgres/S3 behaviour.
 */

const USER_ID = '44444444-4444-4444-8444-444444444444';

const h = vi.hoisted(() => ({
  role: 'superadmin' as string,
  rows: [{ id: 'row-1', n: 1, role: 'admin', code: 'SPRING', publishedAt: null }] as unknown[],
  queue: [] as unknown[][],
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
    'groupBy',
  ];
  for (const m of methods) chain[m] = () => chain;
  chain['then'] = (resolve: (v: unknown) => unknown) =>
    resolve(h.queue.length > 0 ? h.queue.shift() : h.rows);
  return { db: { instance: chain }, getDb: () => chain, closeDb: async () => {} };
});

const { default: reports } = await import('../routes/reports.js');
const { default: paymentsAdmin } = await import('../routes/payments-admin.js');

function app() {
  const a = new Hono();
  a.route('/reports', reports);
  a.route('/payments', paymentsAdmin);
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

beforeEach(() => {
  h.role = 'superadmin';
  h.rows = [{ id: 'row-1', n: 1, role: 'admin', code: 'SPRING', publishedAt: null }];
  h.queue = [];
  h.audit.mockClear();
});

// ---------------------------------------------------------------------------
// Role matrix — the new admin routes enforce their floor server-side.
// ---------------------------------------------------------------------------

describe('P10 — role matrix on new admin endpoints', () => {
  const cases: { path: string; floor: 'officer' | 'superadmin' }[] = [
    { path: '/reports/summary', floor: 'officer' },
    { path: '/reports/orders.csv', floor: 'officer' },
    { path: '/payments', floor: 'superadmin' },
  ];

  const below: Record<string, string[]> = {
    officer: [],
    superadmin: ['officer', 'admin'],
  };

  const atOrAbove: Record<string, string[]> = {
    officer: ['officer', 'admin', 'superadmin'],
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
});

// ---------------------------------------------------------------------------
// Reports — grouped summary and CSV export are reachable and shape-correct.
// ---------------------------------------------------------------------------

describe('P10 — reports endpoints', () => {
  it('summary returns a JSON list for an allowed role', async () => {
    h.role = 'admin';
    const res = await app().request('http://local/reports/summary');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('orders.csv streams CSV with a content-type and download header', async () => {
    h.role = 'officer';
    const res = await app().request('http://local/reports/orders.csv?from=1&to=2');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('attachment');
  });
});

// ---------------------------------------------------------------------------
// Payments admin — the superadmin-facing list that backs the verify UI.
// ---------------------------------------------------------------------------

describe('P10 — payments admin list', () => {
  it('admits a superadmin and returns an array', async () => {
    h.role = 'superadmin';
    const res = await app().request('http://local/payments?status=pending');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    expect(Array.isArray(body.data)).toBe(true);
  });
});

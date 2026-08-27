import { describe, it, expect } from 'vitest';
import { Hono, type Context, type Next } from 'hono';
import { requireRole, requireMinRole } from '../middleware/rbac';
import { AppError } from '../errors';

// Mock auth middleware that sets context vars without DB
function mockAuth(role: string) {
  return async (c: Context, next: Next) => {
    c.set('adminUserId', 'test-user-id');
    c.set('adminRole', role);
    c.set('adminEmail', 'test@example.com');
    c.set('adminDisplayName', 'Test User');
    await next();
  };
}

function jsonStatus(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function withErrorHandler(app: Hono) {
  app.onError((err: unknown) => {
    if (err instanceof AppError) {
      return jsonStatus(err.status, { error: { code: err.code } });
    }
    return jsonStatus(500, { error: { code: 'internal_error' } });
  });
  return app;
}

describe('RBAC middleware', () => {
  describe('requireRole', () => {
    const app = withErrorHandler(new Hono());
    app.get('/superadmin', mockAuth('admin'), requireRole('superadmin'), (c) => c.json({ ok: true }));
    app.get('/admin-or-super', mockAuth('admin'), requireRole('admin', 'superadmin'), (c) => c.json({ ok: true }));

    it('rejects wrong role', async () => {
      const res = await app.request('/superadmin');
      expect(res.status).toBe(403);
    });

    it('accepts matching role', async () => {
      const res = await app.request('/admin-or-super');
      expect(res.status).toBe(200);
    });
  });

  describe('requireMinRole', () => {
    const app = withErrorHandler(new Hono());
    app.get('/officer', mockAuth('officer'), requireMinRole('officer'), (c) => c.json({ ok: true }));
    app.get('/admin', mockAuth('officer'), requireMinRole('admin'), (c) => c.json({ ok: true }));
    app.get('/superadmin', mockAuth('officer'), requireMinRole('superadmin'), (c) => c.json({ ok: true }));
    app.get('/admin-as-admin', mockAuth('admin'), requireMinRole('admin'), (c) => c.json({ ok: true }));
    app.get('/admin-as-superadmin', mockAuth('superadmin'), requireMinRole('admin'), (c) => c.json({ ok: true }));
    app.get('/superadmin-as-superadmin', mockAuth('superadmin'), requireMinRole('superadmin'), (c) => c.json({ ok: true }));

    it('officer passes officer check', async () => {
      const res = await app.request('/officer');
      expect(res.status).toBe(200);
    });

    it('officer fails admin check', async () => {
      const res = await app.request('/admin');
      expect(res.status).toBe(403);
    });

    it('officer fails superadmin check', async () => {
      const res = await app.request('/superadmin');
      expect(res.status).toBe(403);
    });

    it('admin passes admin check', async () => {
      const res = await app.request('/admin-as-admin');
      expect(res.status).toBe(200);
    });

    it('superadmin passes admin check', async () => {
      const res = await app.request('/admin-as-superadmin');
      expect(res.status).toBe(200);
    });

    it('superadmin passes superadmin check', async () => {
      const res = await app.request('/superadmin-as-superadmin');
      expect(res.status).toBe(200);
    });
  });

  describe('full matrix', () => {
    const matrix: Record<string, Record<string, number>> = {
      '/public': { officer: 200, admin: 200, superadmin: 200 },
      '/officer': { officer: 200, admin: 200, superadmin: 200 },
      '/admin': { officer: 403, admin: 200, superadmin: 200 },
      '/superadmin': { officer: 403, admin: 403, superadmin: 200 },
    };

    for (const [route, expectations] of Object.entries(matrix)) {
      for (const [role, expected] of Object.entries(expectations)) {
        it(`${route} with ${role} → ${expected}`, async () => {
          const app = withErrorHandler(new Hono());
          app.get('/public', (c) => c.json({ ok: true }));
          app.get('/officer', mockAuth(role), requireMinRole('officer'), (c) => c.json({ ok: true }));
          app.get('/admin', mockAuth(role), requireMinRole('admin'), (c) => c.json({ ok: true }));
          app.get('/superadmin', mockAuth(role), requireMinRole('superadmin'), (c) => c.json({ ok: true }));

          const res = await app.request(route);
          expect(res.status).toBe(expected);
        });
      }
    }
  });
});

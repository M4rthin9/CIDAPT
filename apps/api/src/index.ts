import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { requestIdMiddleware } from './middleware/request-id';
import { toErrorResponse, getErrorStatus } from './errors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { getLogger, createLogger } from './logger';
import { loadEnv } from './config';
import { closeDb } from './db';
import health from './routes/health';
import authRoutes from './routes/auth';
import settings from './routes/settings';
import upload from './routes/upload';
import catalog from './routes/catalog';
import cart from './routes/cart';
import checkout from './routes/checkout';
import paymentsRoutes from './routes/payments';
import enquiries from './routes/enquiries';
import taxInvoicesRoutes from './routes/tax-invoices';
import creditNotesRoutes from './routes/credit-notes';
import redirectsRoutes from './routes/redirects';
import catalogAdmin from './routes/catalog-admin';
import contentRoutes from './routes/content';
import couponRoutes from './routes/coupons';
import inventoryRoutes from './routes/inventory';
import ordersAdmin from './routes/orders-admin';
import adminUserRoutes from './routes/admin-users';
import auditRoutes from './routes/audit';
import enquiriesAdmin from './routes/enquiries-admin';
import adminSummary from './routes/admin-summary';

const env = loadEnv();
createLogger(env);
const log = getLogger();
const app = new Hono();

// Global middleware
app.use('*', requestIdMiddleware);
app.use('*', cors({ origin: env.APP_URL, credentials: true }));

// Health
app.route('/', health);

// Auth
app.route('/api/v1/auth', authRoutes);

// Settings (superadmin only)
app.route('/api/v1/settings', settings);

// Upload (admin+)
app.route('/api/v1/upload', upload);

// Catalog (public — storefront reads)
app.route('/api/v1/catalog', catalog);

// Cart (public — signed cookie; rejects enquiry products server-side)
app.route('/api/v1/cart', cart);

// Checkout (public — creates pending orders)
app.route('/api/v1/checkout', checkout);

// Payments (initiate public, reconcile webhook, manual-verify superadmin)
app.route('/api/v1/payments', paymentsRoutes);

// Enquiries (public — enquiry products)
app.route('/api/v1/enquiries', enquiries);

// Tax invoices (admin+)
app.route('/api/v1/tax-invoices', taxInvoicesRoutes);

// Credit notes (admin+)
app.route('/api/v1/credit-notes', creditNotesRoutes);

// Redirects (slug changes — public lookup, admin create)
app.route('/api/v1/redirects', redirectsRoutes);

// --- Admin surface (P9). Every route below enforces its own role floor via
// requireMinRole; the SPA's nav hiding is cosmetic only.

// Catalog authoring (admin+)
app.route('/api/v1/admin/catalog', catalogAdmin);

// Content authoring — pages/news/events/banners (admin+)
app.route('/api/v1/admin/content', contentRoutes);

// Coupons (admin+)
app.route('/api/v1/admin/coupons', couponRoutes);

// Inventory ledger — the sole stock mutation path (officer+)
app.route('/api/v1/admin/inventory', inventoryRoutes);

// Orders pipeline: packing/shipping (officer+)
app.route('/api/v1/admin/orders', ordersAdmin);

// Admin users (superadmin only)
app.route('/api/v1/admin/users', adminUserRoutes);

// Enquiry inbox (officer+)
app.route('/api/v1/admin/enquiries', enquiriesAdmin);

// Dashboard counters (officer+)
app.route('/api/v1/admin/summary', adminSummary);

// Audit log viewer + CSV export (superadmin only)
app.route('/api/v1/admin/audit', auditRoutes);

// Global error handler
app.onError((err, c) => {
  const requestId = c.get('requestId');
  const status = getErrorStatus(err);
  const body = toErrorResponse(err, requestId);
  return c.json(body, status as ContentfulStatusCode);
});

// 404
app.notFound((c) => {
  return c.json(
    {
      error: {
        code: 'not_found',
        message_th: 'ไม่พบหน้า',
        message_en: 'Not found',
        request_id: c.get('requestId'),
      },
    },
    404,
  );
});

const port = env.PORT;
const server = serve({ fetch: app.fetch, port }, () => {
  log.info({ port, env: env.NODE_ENV }, `API server listening on :${port}`);
});

// Compose sends SIGTERM on `down`/redeploy: stop accepting connections, drain
// in-flight requests, then release the pool so Postgres does not keep the socket.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, 'API shutting down');

  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeDb();

  log.info('API shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

export default app;

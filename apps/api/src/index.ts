import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { requestIdMiddleware } from './middleware/request-id.js';
import { rateLimit } from './middleware/rate-limit.js';
import { toErrorResponse, getErrorStatus } from './errors.js';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { getLogger, createLogger } from './logger.js';
import { loadEnv } from './config.js';
import { closeDb } from './db.js';
import { closeValkey } from './valkey.js';
import health from './routes/health.js';
import authRoutes from './routes/auth.js';
import settings from './routes/settings.js';
import upload from './routes/upload.js';
import catalog from './routes/catalog.js';
import cart from './routes/cart.js';
import checkout from './routes/checkout.js';
import paymentsRoutes from './routes/payments.js';
import enquiries from './routes/enquiries.js';
import taxInvoicesRoutes from './routes/tax-invoices.js';
import creditNotesRoutes from './routes/credit-notes.js';
import redirectsRoutes from './routes/redirects.js';
import catalogAdmin from './routes/catalog-admin.js';
import contentRoutes from './routes/content.js';
import couponRoutes from './routes/coupons.js';
import inventoryRoutes from './routes/inventory.js';
import ordersAdmin from './routes/orders-admin.js';
import adminUserRoutes from './routes/admin-users.js';
import auditRoutes from './routes/audit.js';
import enquiriesAdmin from './routes/enquiries-admin.js';
import adminSummary from './routes/admin-summary.js';
import mediaRoutes from './routes/media.js';
import reportsRoutes from './routes/reports.js';
import paymentsAdmin from './routes/payments-admin.js';

const env = loadEnv();
createLogger(env);
const log = getLogger();
const app = new Hono();

// Global middleware
app.use('*', requestIdMiddleware);
app.use('*', cors({ origin: env.APP_URL, credentials: true }));

// Security: Valkey-backed request rate limiting (P10). Stricter windows on the
// unauthenticated attack surfaces (auth, enquiries, checkout).
app.use('/api/v1/*', rateLimit({ max: 300, windowMs: 60_000 }));
app.use('/api/v1/auth/*', rateLimit({ max: 10, windowMs: 60_000 }));
app.use('/api/v1/enquiries/*', rateLimit({ max: 20, windowMs: 60_000 }));
app.use('/api/v1/checkout/*', rateLimit({ max: 30, windowMs: 60_000 }));

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

// Reports — factual order aggregation + CSV export (officer+)
app.route('/api/v1/admin/reports', reportsRoutes);

// Payments admin — list pending payments for manual verification (superadmin)
app.route('/api/v1/admin/payments', paymentsAdmin);

// Audit log viewer + CSV export (superadmin only)
app.route('/api/v1/admin/audit', auditRoutes);

// Media preview proxy — uploaded images for the SPA (admin+)
app.route('/api/v1/admin/media', mediaRoutes);

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
  await closeValkey();

  log.info('API shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

export default app;

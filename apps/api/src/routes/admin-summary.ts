import { Hono } from 'hono';
import { count, eq, inArray } from 'drizzle-orm';
import { db } from '../db.js';
import { orders, productEnquiries, products } from '@cida/db/schema';
import { authMiddleware } from '../middleware/auth.js';
import { requireMinRole } from '../middleware/rbac.js';

const adminSummary = new Hono();

adminSummary.use('*', authMiddleware);
adminSummary.use('*', requireMinRole('officer'));

/**
 * GET /api/v1/admin/summary — dashboard counters.
 *
 * Counts the work actually waiting on an operator rather than lifetime totals:
 * orders still moving through the pipeline, unclosed enquiries, and published
 * products.
 */
adminSummary.get('/', async (c) => {
  const [orderRow] = await db.instance
    .select({ n: count() })
    .from(orders)
    .where(
      inArray(orders.status, [
        'pending_payment',
        'awaiting_verification',
        'paid',
        'processing',
        'shipped',
      ]),
    );

  const [enquiryRow] = await db.instance
    .select({ n: count() })
    .from(productEnquiries)
    .where(inArray(productEnquiries.status, ['new', 'contacted', 'quoted']));

  const [productRow] = await db.instance
    .select({ n: count() })
    .from(products)
    .where(eq(products.status, 'published'));

  return c.json({
    data: {
      orders: orderRow?.n ?? 0,
      enquiries: enquiryRow?.n ?? 0,
      products: productRow?.n ?? 0,
    },
  });
});

export default adminSummary;

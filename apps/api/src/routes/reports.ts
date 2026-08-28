import { Hono, type Context } from 'hono';
import { and, count, desc, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import { orders } from '@cida/db/schema';
import { authMiddleware } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';

const reports = new Hono();

reports.use('*', authMiddleware);
reports.use('*', requireMinRole('officer'));

/** Parse `from`/`to` unix-second query params into a bounded placedAt window. */
function window(c: Context) {
  const from = Number(c.req.query('from'));
  const to = Number(c.req.query('to'));
  const hasFrom = Number.isFinite(from) && from > 0;
  const hasTo = Number.isFinite(to) && to > 0;
  return and(
    hasFrom ? gte(orders.placedAt, from) : undefined,
    hasTo ? lte(orders.placedAt, to) : undefined,
  );
}

// GET /api/v1/admin/reports/summary?from=&to=
// Purely factual aggregation — gross order totals grouped by status, with no
// invented revenue classification. `totalSatang` is VAT-inclusive (non-negotiable #5);
// VAT derivation is a policy concern and is left to the finance screen / reports.
reports.get('/summary', async (c) => {
  const cond = window(c);
  const rows = await db.instance
    .select({
      status: orders.status,
      n: count(),
      grossSatang: sql<number>`coalesce(sum(${orders.totalSatang}), 0)`,
    })
    .from(orders)
    .where(cond ?? undefined)
    .groupBy(orders.status)
    .orderBy(orders.status);

  return c.json({ data: rows });
});

// GET /api/v1/admin/reports/orders.csv?from=&to=
reports.get('/orders.csv', async (c) => {
  const cond = window(c);
  const rows = await db.instance
    .select()
    .from(orders)
    .where(cond ?? undefined)
    .orderBy(desc(orders.placedAt));

  const header = [
    'order_no',
    'status',
    'placed_at',
    'total_satang',
    'subtotal_satang',
    'discount_satang',
    'shipping_satang',
    'contact_name',
    'phone',
    'province',
    'tracking_no',
  ];
  const lines = rows.map((r) =>
    [
      r.orderNo,
      r.status,
      r.placedAt,
      r.totalSatang,
      r.subtotalSatang,
      r.discountSatang,
      r.shippingSatang,
      r.contactName,
      r.phone,
      r.province,
      r.trackingNo ?? '',
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  );

  const csv = [header.join(','), ...lines].join('\n');
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header(
    'Content-Disposition',
    `attachment; filename="orders-${Math.floor(Date.now() / 1000)}.csv"`,
  );
  return c.body(csv);
});

export default reports;

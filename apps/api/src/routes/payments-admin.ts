import { Hono } from 'hono';
import { desc, eq, and } from 'drizzle-orm';
import { db } from '../db.js';
import { orders, payments } from '@cida/db/schema';
import { authMiddleware } from '../middleware/auth.js';
import { requireMinRole } from '../middleware/rbac.js';

const paymentsAdmin = new Hono();

// Manual payment verification is a sensitive, payment-adjacent action. The
// endpoints here are superadmin only and every mutation goes through the
// public `/api/v1/payments/manual-verify` handler, which writes a `red`
// audit_log row with the mandated typed reason.
paymentsAdmin.use('*', authMiddleware);
paymentsAdmin.use('*', requireMinRole('superadmin'));

// GET /api/v1/admin/payments?status= — pending/verified payments with the
// order number attached so a superadmin can pick which one to verify.
paymentsAdmin.get('/', async (c) => {
  const status = c.req.query('status');
  const rows = await db.instance
    .select({
      id: payments.id,
      orderId: payments.orderId,
      orderNo: orders.orderNo,
      rail: payments.rail,
      status: payments.status,
      amountSatang: payments.amountSatang,
      transRef: payments.transRef,
      verifiedVia: payments.verifiedVia,
      verifiedByAdminId: payments.verifiedByAdminId,
      verifiedReason: payments.verifiedReason,
      verifiedAt: payments.verifiedAt,
      initiatedAt: payments.initiatedAt,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(status ? and(eq(payments.status, status)) : undefined)
    .orderBy(desc(payments.initiatedAt));

  return c.json({ data: rows });
});

export default paymentsAdmin;

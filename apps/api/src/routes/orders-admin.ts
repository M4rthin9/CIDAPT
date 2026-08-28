import { Hono } from 'hono';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { orderItems, orders } from '@cida/db/schema';
import { authMiddleware } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { writeAuditLog } from '../middleware/audit';
import { AppError } from '../errors';
import { orderStatusUpdateSchema } from '@cida/contracts';

const ordersAdmin = new Hono();

// Officers handle orders/packing/shipping
ordersAdmin.use('*', authMiddleware);
ordersAdmin.use('*', requireMinRole('officer'));

const ORDER_STATUS_TIMESTAMPS: Record<string, keyof typeof orders.$inferSelect> = {
  paid: 'paidAt',
  shipped: 'shippedAt',
  completed: 'completedAt',
  cancelled: 'cancelledAt',
};

ordersAdmin.get('/', async (c) => {
  const status = c.req.query('status');
  const search = c.req.query('search');

  const rows = await db.instance.select().from(orders).orderBy(desc(orders.placedAt));

  const filtered = rows.filter((o) => {
    if (status && o.status !== status) return false;
    if (search) {
      const term = search.toLowerCase();
      if (
        !o.orderNo.toLowerCase().includes(term) &&
        !o.contactName.toLowerCase().includes(term) &&
        !o.phone.includes(term)
      ) {
        return false;
      }
    }
    return true;
  });

  return c.json({ data: filtered });
});

ordersAdmin.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [order] = await db.instance.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) throw new AppError('order_not_found', 'ไม่พบคำสั่งซื้อ', 'Order not found', 404);

  const items = await db.instance
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, id))
    .orderBy(asc(orderItems.id));

  return c.json({ data: { order, items } });
});

ordersAdmin.patch('/:id/status', async (c) => {
  const parsed = orderStatusUpdateSchema.safeParse({
    orderId: c.req.param('id'),
    ...(await c.req.json()),
  });
  if (!parsed.success) throw validationError(parsed.error);
  const { orderId, status, trackingNo, occurredAt } = parsed.data;
  const now = occurredAt ?? Math.floor(Date.now() / 1000);

  const [existing] = await db.instance.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!existing) throw new AppError('order_not_found', 'ไม่พบคำสั่งซื้อ', 'Order not found', 404);

  const set = {
    status,
    updatedAt: now,
    ...(trackingNo !== undefined ? { trackingNo: trackingNo || null } : {}),
    ...(ORDER_STATUS_TIMESTAMPS[status] ? { [ORDER_STATUS_TIMESTAMPS[status]]: now } : {}),
  };

  const [row] = await db.instance.update(orders).set(set).where(eq(orders.id, orderId)).returning();

  await writeAuditLog(c, {
    action: `order.status.${status}`,
    entityType: 'order',
    entityId: orderId,
    beforeState: existing,
    afterState: row,
  });

  return c.json({ data: row });
});

function validationError(err: import('zod').ZodError): AppError {
  return new AppError(
    'validation_error',
    'ข้อมูลไม่ถูกต้อง',
    'Invalid input',
    422,
    Object.fromEntries(err.issues.map((i) => [i.path.join('.'), i.message])),
  );
}

export default ordersAdmin;

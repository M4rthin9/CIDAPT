import { Hono } from 'hono';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { coupons } from '@cida/db/schema';
import { authMiddleware } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { writeAuditLog } from '../middleware/audit';
import { AppError, mustRow } from '../errors';
import { couponUpsertSchema } from '@cida/contracts';

const couponRoutes = new Hono();

couponRoutes.use('*', authMiddleware);
couponRoutes.use('*', requireMinRole('admin'));

couponRoutes.get('/', async (c) => {
  const rows = await db.instance.select().from(coupons).orderBy(asc(coupons.code));
  return c.json({ data: rows });
});

couponRoutes.get('/:id', async (c) => {
  const [row] = await db.instance
    .select()
    .from(coupons)
    .where(eq(coupons.id, c.req.param('id')))
    .limit(1);
  if (!row) throw new AppError('coupon_not_found', 'ไม่พบคูปอง', 'Coupon not found', 404);
  return c.json({ data: row });
});

couponRoutes.post('/', async (c) => {
  const parsed = couponUpsertSchema.safeParse(await c.req.json());
  if (!parsed.success) throw validationError(parsed.error);
  const now = Math.floor(Date.now() / 1000);

  const [inserted] = await db.instance
    .insert(coupons)
    .values({ ...parsed.data, createdAt: now, updatedAt: now })
    .returning();
  const row = mustRow(inserted, 'coupon');

  await writeAuditLog(c, {
    action: 'coupon.create',
    entityType: 'coupon',
    entityId: row.id,
    afterState: row,
  });
  return c.json({ data: row });
});

couponRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const parsed = couponUpsertSchema.safeParse(await c.req.json());
  if (!parsed.success) throw validationError(parsed.error);

  const [existing] = await db.instance.select().from(coupons).where(eq(coupons.id, id)).limit(1);
  if (!existing) throw new AppError('coupon_not_found', 'ไม่พบคูปอง', 'Coupon not found', 404);

  const [row] = await db.instance
    .update(coupons)
    .set({ ...parsed.data, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(coupons.id, id))
    .returning();

  await writeAuditLog(c, {
    action: 'coupon.update',
    entityType: 'coupon',
    entityId: id,
    beforeState: existing,
    afterState: row,
  });
  return c.json({ data: row });
});

couponRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const [existing] = await db.instance.select().from(coupons).where(eq(coupons.id, id)).limit(1);
  if (!existing) throw new AppError('coupon_not_found', 'ไม่พบคูปอง', 'Coupon not found', 404);

  await db.instance.delete(coupons).where(eq(coupons.id, id));
  await writeAuditLog(c, {
    action: 'coupon.delete',
    entityType: 'coupon',
    entityId: id,
    beforeState: existing,
  });
  return c.json({ data: { id, deleted: true } });
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

export default couponRoutes;

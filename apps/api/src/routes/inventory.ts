import { Hono } from 'hono';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { inventoryLedger, products } from '@cida/db/schema';
import { authMiddleware } from '../middleware/auth.js';
import { requireMinRole } from '../middleware/rbac.js';
import { writeAuditLog } from '../middleware/audit.js';
import { AppError } from '../errors.js';
import { ledgerEntryCreateSchema } from '@cida/contracts';

const inventory = new Hono();

inventory.use('*', authMiddleware);
inventory.use('*', requireMinRole('officer'));

// POST /api/v1/inventory — the SOLE stock mutation path (non-negotiable #10)
inventory.post('/', async (c) => {
  const parsed = ledgerEntryCreateSchema.safeParse(await c.req.json());
  if (!parsed.success) throw validationError(parsed.error);
  const now = parsed.data.createdAt ?? Math.floor(Date.now() / 1000);
  const adminUserId = c.get('adminUserId') as string;
  const e = parsed.data;

  const [product] = await db.instance
    .select()
    .from(products)
    .where(eq(products.id, e.productId))
    .limit(1);
  if (!product) throw new AppError('product_not_found', 'ไม่พบสินค้า', 'Product not found', 404);

  const [row] = await db.instance
    .insert(inventoryLedger)
    .values({
      productId: e.productId,
      delta: e.delta,
      reason: e.reason,
      refType: e.refType,
      refId: e.refId,
      actorAdminId: adminUserId,
      note: e.note,
      createdAt: now,
    })
    .returning();

  await writeAuditLog(c, {
    action: `inventory.${e.reason}`,
    entityType: 'product',
    entityId: e.productId,
    afterState: row,
  });

  return c.json({ data: row });
});

// GET /api/v1/inventory?productId=...
inventory.get('/', async (c) => {
  const productId = c.req.query('productId');
  const rows = productId
    ? await db.instance
        .select()
        .from(inventoryLedger)
        .where(eq(inventoryLedger.productId, productId))
        .orderBy(desc(inventoryLedger.createdAt))
    : await db.instance.select().from(inventoryLedger).orderBy(desc(inventoryLedger.createdAt));

  return c.json({ data: rows });
});

// GET /api/v1/inventory/stock — current stock on hand per product
inventory.get('/stock', async (c) => {
  const rows = await db.instance
    .select({
      id: products.id,
      sku: products.sku,
      nameTh: products.nameTh,
      nameEn: products.nameEn,
      stockOnHand: sql<number>`coalesce(
        (select sum(delta) from inventory_ledger where product_id = ${products.id}), 0)`,
    })
    .from(products)
    .orderBy(asc(products.sku));

  return c.json({ data: rows });
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

export default inventory;

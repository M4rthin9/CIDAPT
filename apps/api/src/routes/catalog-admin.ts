import { Hono } from 'hono';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { categories, divisions, products } from '@cida/db/schema';
import { authMiddleware } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { writeAuditLog } from '../middleware/audit';
import { AppError, mustRow } from '../errors';
import {
  categoryUpsertSchema,
  divisionUpsertSchema,
  productPublishSchema,
  productUpsertSchema,
} from '@cida/contracts';

const catalogAdmin = new Hono();

// All admin catalog routes require auth + admin
catalogAdmin.use('*', authMiddleware);
catalogAdmin.use('*', requireMinRole('admin'));

// ------------------------- Divisions -------------------------

catalogAdmin.get('/divisions', async (c) => {
  const rows = await db.instance.select().from(divisions).orderBy(asc(divisions.sortOrder));
  return c.json({ data: rows });
});

catalogAdmin.post('/divisions', async (c) => {
  const parsed = divisionUpsertSchema.safeParse(await c.req.json());
  if (!parsed.success) throw validationError(parsed.error);
  const now = Math.floor(Date.now() / 1000);

  const [existing] = await db.instance
    .select()
    .from(divisions)
    .where(eq(divisions.code, parsed.data.code))
    .limit(1);

  const row = mustRow(
    existing
      ? (
          await db.instance
            .update(divisions)
            .set({
              nameTh: parsed.data.nameTh,
              nameEn: parsed.data.nameEn,
              sortOrder: parsed.data.sortOrder,
              updatedAt: now,
            })
            .where(eq(divisions.code, parsed.data.code))
            .returning()
        )[0]
      : (
          await db.instance
            .insert(divisions)
            .values({
              code: parsed.data.code,
              nameTh: parsed.data.nameTh,
              nameEn: parsed.data.nameEn,
              sortOrder: parsed.data.sortOrder,
              createdAt: now,
              updatedAt: now,
            })
            .returning()
        )[0],
    'division',
  );

  await writeAuditLog(c, {
    action: existing ? 'division.update' : 'division.create',
    entityType: 'division',
    entityId: parsed.data.code,
    beforeState: existing ?? undefined,
    afterState: row,
  });

  return c.json({ data: row });
});

// ------------------------- Categories -------------------------

catalogAdmin.get('/divisions/:division/categories', async (c) => {
  const rows = await db.instance
    .select()
    .from(categories)
    .where(eq(categories.divisionCode, c.req.param('division')))
    .orderBy(asc(categories.sortOrder));
  return c.json({ data: rows });
});

catalogAdmin.post('/categories', async (c) => {
  const parsed = categoryUpsertSchema.safeParse(await c.req.json());
  if (!parsed.success) throw validationError(parsed.error);
  const now = Math.floor(Date.now() / 1000);

  const [div] = await db.instance
    .select()
    .from(divisions)
    .where(eq(divisions.code, parsed.data.divisionCode))
    .limit(1);
  if (!div) throw new AppError('division_not_found', 'ไม่พบหมวดงาน', 'Division not found', 404);

  const [inserted] = await db.instance
    .insert(categories)
    .values({
      divisionCode: div.code,
      slugTh: parsed.data.slugTh,
      slugEn: parsed.data.slugEn,
      nameTh: parsed.data.nameTh,
      nameEn: parsed.data.nameEn,
      sortOrder: parsed.data.sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const row = mustRow(inserted, 'category');

  await writeAuditLog(c, {
    action: 'category.create',
    entityType: 'category',
    entityId: row.id,
    afterState: row,
  });
  return c.json({ data: row });
});

// ------------------------- Products -------------------------

catalogAdmin.get('/products', async (c) => {
  const status = c.req.query('status');
  const categoryId = c.req.query('categoryId');

  const rows = await db.instance
    .select({
      id: products.id,
      sku: products.sku,
      slugTh: products.slugTh,
      slugEn: products.slugEn,
      nameTh: products.nameTh,
      nameEn: products.nameEn,
      categoryId: products.categoryId,
      purchaseMode: products.purchaseMode,
      status: products.status,
      priceSatang: products.priceSatang,
      stockOnHand: sql<number>`coalesce(
        (select sum(delta) from inventory_ledger where product_id = ${products.id}), 0)`,
    })
    .from(products)
    .where(
      and(
        status ? eq(products.status, status) : undefined,
        categoryId ? eq(products.categoryId, categoryId) : undefined,
      ),
    )
    .orderBy(desc(products.createdAt));
  return c.json({ data: rows });
});

catalogAdmin.get('/categories/:id/products', async (c) => {
  const rows = await db.instance
    .select()
    .from(products)
    .where(eq(products.categoryId, c.req.param('id')))
    .orderBy(asc(products.sortOrder));
  return c.json({ data: rows });
});

catalogAdmin.get('/products/:id', async (c) => {
  const [row] = await db.instance
    .select()
    .from(products)
    .where(eq(products.id, c.req.param('id')))
    .limit(1);
  if (!row) throw new AppError('product_not_found', 'ไม่พบสินค้า', 'Product not found', 404);
  return c.json({ data: row });
});

catalogAdmin.post('/products', async (c) => {
  const parsed = productUpsertSchema.safeParse(await c.req.json());
  if (!parsed.success) throw validationError(parsed.error);
  const now = Math.floor(Date.now() / 1000);
  const p = parsed.data;

  const [cat] = await db.instance
    .select()
    .from(categories)
    .where(eq(categories.id, p.categoryId))
    .limit(1);
  if (!cat) throw new AppError('category_not_found', 'ไม่พบหมวดหมู่', 'Category not found', 404);

  const [inserted] = await db.instance
    .insert(products)
    .values({
      categoryId: p.categoryId,
      sku: p.sku,
      slugTh: slugOf(p.nameTh),
      slugEn: slugOf(p.nameEn),
      lotCode: p.lotCode,
      purchaseMode: p.purchaseMode,
      nameTh: p.nameTh,
      nameEn: p.nameEn,
      bodyTh: p.bodyTh,
      bodyEn: p.bodyEn,
      materialTh: p.materialTh,
      materialEn: p.materialEn,
      finishNoteTh: p.finishNoteTh,
      finishNoteEn: p.finishNoteEn,
      priceSatang: p.priceSatang,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const row = mustRow(inserted, 'product');

  await writeAuditLog(c, {
    action: 'product.create',
    entityType: 'product',
    entityId: row.id,
    afterState: row,
  });
  return c.json({ data: row });
});

catalogAdmin.put('/products/:id', async (c) => {
  const id = c.req.param('id');
  const parsed = productUpsertSchema.safeParse(await c.req.json());
  if (!parsed.success) throw validationError(parsed.error);
  const now = Math.floor(Date.now() / 1000);
  const p = parsed.data;

  const [existing] = await db.instance.select().from(products).where(eq(products.id, id)).limit(1);
  if (!existing) throw new AppError('product_not_found', 'ไม่พบสินค้า', 'Product not found', 404);

  const patch: Partial<typeof existing> = {
    categoryId: p.categoryId,
    sku: p.sku,
    slugTh: existing.publishedAt ? existing.slugTh : slugOf(p.nameTh),
    slugEn: existing.publishedAt ? existing.slugEn : slugOf(p.nameEn),
    lotCode: p.lotCode,
    purchaseMode: p.purchaseMode,
    nameTh: p.nameTh,
    nameEn: p.nameEn,
    bodyTh: p.bodyTh,
    bodyEn: p.bodyEn,
    materialTh: p.materialTh,
    materialEn: p.materialEn,
    finishNoteTh: p.finishNoteTh,
    finishNoteEn: p.finishNoteEn,
    priceSatang: p.priceSatang,
    updatedAt: now,
  };

  const [row] = await db.instance
    .update(products)
    .set(patch)
    .where(eq(products.id, id))
    .returning();
  await writeAuditLog(c, {
    action: 'product.update',
    entityType: 'product',
    entityId: id,
    beforeState: existing,
    afterState: row,
  });
  return c.json({ data: row });
});

catalogAdmin.post('/products/:id/publish', async (c) => {
  const id = c.req.param('id');
  const parsed = productPublishSchema.safeParse(await c.req.json());
  if (!parsed.success) throw validationError(parsed.error);
  const now = Math.floor(Date.now() / 1000);
  const p = parsed.data;

  const [existing] = await db.instance.select().from(products).where(eq(products.id, id)).limit(1);
  if (!existing) throw new AppError('product_not_found', 'ไม่พบสินค้า', 'Product not found', 404);

  const [row] = await db.instance
    .update(products)
    .set({
      ...p,
      slugTh: existing.publishedAt ? existing.slugTh : slugOf(p.nameTh),
      slugEn: existing.publishedAt ? existing.slugEn : slugOf(p.nameEn),
      status: 'published',
      publishedAt: p.publishedAt ?? now,
      updatedAt: now,
    })
    .where(eq(products.id, id))
    .returning();

  await writeAuditLog(c, {
    action: 'product.publish',
    entityType: 'product',
    entityId: id,
    beforeState: existing,
    afterState: row,
  });
  return c.json({ data: row });
});

catalogAdmin.post('/products/:id/archive', async (c) => {
  const id = c.req.param('id');
  const [existing] = await db.instance.select().from(products).where(eq(products.id, id)).limit(1);
  if (!existing) throw new AppError('product_not_found', 'ไม่พบสินค้า', 'Product not found', 404);
  const [row] = await db.instance
    .update(products)
    .set({ status: 'archived', updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(products.id, id))
    .returning();
  await writeAuditLog(c, {
    action: 'product.archive',
    entityType: 'product',
    entityId: id,
    beforeState: existing,
    afterState: row,
  });
  return c.json({ data: row });
});

/** ASCII slug from a Thai/English title — storefront slugs must stay immutable after publish. */
function slugOf(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || `item-${Date.now()}`;
}

function validationError(err: import('zod').ZodError): AppError {
  return new AppError(
    'validation_error',
    'ข้อมูลไม่ถูกต้อง',
    'Invalid input',
    422,
    Object.fromEntries(err.issues.map((i) => [i.path.join('.'), i.message])),
  );
}

export default catalogAdmin;

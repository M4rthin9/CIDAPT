import { Hono } from 'hono';
import { and, asc, eq, or } from 'drizzle-orm';
import { db } from '../db.js';
import { categories, divisions, products } from '@cida/db/schema';
import { AppError } from '../errors.js';

const catalog = new Hono();

/** Storefront money format — satang integers never leave the API as floats elsewhere. */
export function formatSatang(satang: number | null): string {
  if (satang === null) return '';
  return `฿${(satang / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// GET /api/v1/catalog/divisions — all divisions
catalog.get('/divisions', async (c) => {
  const rows = await db.instance.select().from(divisions).orderBy(asc(divisions.sortOrder));

  return c.json({
    data: rows.map((d) => ({ code: d.code, name_th: d.nameTh, name_en: d.nameEn })),
  });
});

// GET /api/v1/catalog/divisions/:division/categories
catalog.get('/divisions/:division/categories', async (c) => {
  const division = c.req.param('division');

  const [div] = await db.instance
    .select()
    .from(divisions)
    .where(eq(divisions.code, division))
    .limit(1);

  if (!div) {
    throw new AppError('division_not_found', 'ไม่พบหมวดงาน', 'Division not found', 404);
  }

  const rows = await db.instance
    .select()
    .from(categories)
    .where(eq(categories.divisionCode, division))
    .orderBy(asc(categories.sortOrder));

  return c.json({
    data: rows.map((cat) => ({
      slug: cat.slugTh,
      slug_th: cat.slugTh,
      slug_en: cat.slugEn,
      name_th: cat.nameTh,
      name_en: cat.nameEn,
    })),
    meta: { division: { code: div.code, name_th: div.nameTh, name_en: div.nameEn } },
  });
});

// GET /api/v1/catalog/divisions/:division/categories/:category/products
catalog.get('/divisions/:division/categories/:category/products', async (c) => {
  const division = c.req.param('division');
  const category = c.req.param('category');

  // Either language's slug resolves the same category.
  const [cat] = await db.instance
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.divisionCode, division),
        or(eq(categories.slugTh, category), eq(categories.slugEn, category)),
      ),
    )
    .limit(1);

  if (!cat) {
    throw new AppError('category_not_found', 'ไม่พบหมวดหมู่', 'Category not found', 404);
  }

  const rows = await db.instance
    .select()
    .from(products)
    .where(and(eq(products.categoryId, cat.id), eq(products.status, 'published')))
    .orderBy(asc(products.sortOrder));

  return c.json({
    data: {
      category: {
        slug: cat.slugTh,
        slug_th: cat.slugTh,
        slug_en: cat.slugEn,
        name_th: cat.nameTh,
        name_en: cat.nameEn,
      },
      products: rows.map((p) => ({
        id: p.id,
        slug: p.slugTh,
        slug_th: p.slugTh,
        slug_en: p.slugEn,
        name_th: p.nameTh,
        name_en: p.nameEn,
        purchaseMode: p.purchaseMode,
        priceSatang: p.priceSatang,
        priceFormatted: formatSatang(p.priceSatang),
      })),
    },
  });
});

// GET /api/v1/catalog/products/:slug — either language's slug
catalog.get('/products/:slug', async (c) => {
  const slug = c.req.param('slug');

  const [product] = await db.instance
    .select()
    .from(products)
    .where(
      and(
        or(eq(products.slugTh, slug), eq(products.slugEn, slug)),
        eq(products.status, 'published'),
      ),
    )
    .limit(1);

  if (!product) {
    throw new AppError('product_not_found', 'ไม่พบสินค้า', 'Product not found', 404);
  }

  return c.json({
    data: {
      id: product.id,
      slug: product.slugTh,
      slug_th: product.slugTh,
      slug_en: product.slugEn,
      sku: product.sku,
      lotCode: product.lotCode,
      purchaseMode: product.purchaseMode,
      name_th: product.nameTh,
      name_en: product.nameEn,
      description_th: product.bodyTh ?? '',
      description_en: product.bodyEn ?? '',
      material_th: product.materialTh ?? '',
      material_en: product.materialEn ?? '',
      handFinish_th: product.finishNoteTh ?? '',
      handFinish_en: product.finishNoteEn ?? '',
      priceSatang: product.priceSatang,
      priceFormatted: formatSatang(product.priceSatang),
    },
  });
});

export default catalog;

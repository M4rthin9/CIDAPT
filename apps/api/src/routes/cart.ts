import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Context } from 'hono';
import { db } from '../db.js';
import { products } from '@cida/db/schema';
import { AppError } from '../errors.js';
import { getEnv } from '../config.js';
import { decodeCart, encodeCart, type CartLine } from '../lib/cart-cookie.js';
import { formatSatang } from './catalog.js';

const cart = new Hono();

const COOKIE_NAME = 'cida_cart';
const MAX_LINES = 50;

function readCart(c: Context): CartLine[] {
  return decodeCart(getCookie(c, COOKIE_NAME));
}

function writeCart(c: Context, lines: CartLine[]) {
  const env = getEnv();
  setCookie(c, COOKIE_NAME, encodeCart(lines), {
    path: '/',
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'Lax',
    domain: env.COOKIE_DOMAIN,
    maxAge: 30 * 24 * 3600,
  });
}

/** Hydrate cookie lines from the DB. Prices and purchase mode are never trusted from the client. */
async function hydrate(lines: CartLine[]) {
  if (lines.length === 0) {
    return { items: [], subtotalSatang: 0, subtotalFormatted: formatSatang(0) };
  }

  const rows = await db.instance
    .select()
    .from(products)
    .where(
      inArray(
        products.id,
        lines.map((l) => l.productId),
      ),
    );

  let subtotalSatang = 0;
  const items = lines.flatMap((line) => {
    const product = rows.find((p) => p.id === line.productId);
    // Drop lines whose product was deleted or unpublished since it was added.
    if (!product || product.status !== 'published' || product.priceSatang === null) return [];

    subtotalSatang += product.priceSatang * line.quantity;

    return [
      {
        productId: product.id,
        slug: product.slugTh,
        slug_th: product.slugTh,
        slug_en: product.slugEn,
        name_th: product.nameTh,
        name_en: product.nameEn,
        priceSatang: product.priceSatang,
        priceFormatted: formatSatang(product.priceSatang),
        quantity: line.quantity,
      },
    ];
  });

  return { items, subtotalSatang, subtotalFormatted: formatSatang(subtotalSatang) };
}

const addSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99).default(1),
});

const patchSchema = z.object({
  quantity: z.number().int().min(1).max(99),
});

function invalid(issues: z.ZodError): never {
  throw new AppError(
    'validation_error',
    'ข้อมูลไม่ถูกต้อง',
    'Invalid input',
    422,
    Object.fromEntries(issues.issues.map((i) => [i.path.join('.'), i.message])),
  );
}

// GET /api/v1/cart
cart.get('/', async (c) => {
  return c.json({ data: await hydrate(readCart(c)) });
});

// POST /api/v1/cart — add a line
cart.post('/', async (c) => {
  const parsed = addSchema.safeParse(await c.req.json());
  if (!parsed.success) invalid(parsed.error);

  const { productId, quantity } = parsed.data;

  const [product] = await db.instance
    .select()
    .from(products)
    .where(inArray(products.id, [productId]))
    .limit(1);

  if (!product || product.status !== 'published') {
    throw new AppError('product_not_found', 'ไม่พบสินค้า', 'Product not found', 404);
  }

  // Non-negotiable (P5): enquiry products can never enter the cart.
  if (product.purchaseMode === 'enquiry') {
    throw new AppError(
      'cart_enquiry_not_allowed',
      'สินค้านี้ต้องติดต่อเจ้าหน้าที่เพื่อสั่งซื้อ',
      'This product requires staff contact — it cannot be added to the cart',
      400,
      { productId },
    );
  }

  const lines = readCart(c);
  const existing = lines.find((l) => l.productId === productId);

  if (existing) {
    existing.quantity = Math.min(99, existing.quantity + quantity);
  } else {
    if (lines.length >= MAX_LINES) {
      throw new AppError('cart_full', 'ตะกร้าเต็ม', 'Cart is full', 400);
    }
    lines.push({ productId, quantity });
  }

  writeCart(c, lines);
  return c.json({ data: await hydrate(lines) });
});

// PATCH /api/v1/cart/items/:productId — set quantity
cart.patch('/items/:productId', async (c) => {
  const productId = c.req.param('productId');
  const parsed = patchSchema.safeParse(await c.req.json());
  if (!parsed.success) invalid(parsed.error);

  const lines = readCart(c);
  const existing = lines.find((l) => l.productId === productId);
  if (!existing) {
    throw new AppError('cart_item_not_found', 'ไม่พบสินค้าในตะกร้า', 'Item not in cart', 404);
  }

  existing.quantity = parsed.data.quantity;
  writeCart(c, lines);
  return c.json({ data: await hydrate(lines) });
});

// DELETE /api/v1/cart/items/:productId
cart.delete('/items/:productId', async (c) => {
  const productId = c.req.param('productId');
  const lines = readCart(c).filter((l) => l.productId !== productId);

  writeCart(c, lines);
  return c.json({ data: await hydrate(lines) });
});

export default cart;

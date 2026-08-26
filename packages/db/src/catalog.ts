import {
  pgTable,
  text,
  boolean,
  integer,
  jsonb,
  uuid,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import type { ExtraConfigColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createdAt, moneySatang, pk, unixSeconds, updatedAt } from './_shared';
import { adminUsers } from './admin';

const slugCheck = (col: ExtraConfigColumn) => sql`${col} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`;

export const divisions = pgTable('divisions', {
  code: text('code').primaryKey(),
  nameTh: text('name_th').notNull(),
  nameEn: text('name_en').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const categories = pgTable(
  'categories',
  {
    id: pk(),
    divisionCode: text('division_code')
      .notNull()
      .references(() => divisions.code, { onDelete: 'restrict' }),
    slugTh: text('slug_th').notNull(),
    slugEn: text('slug_en').notNull(),
    nameTh: text('name_th').notNull(),
    nameEn: text('name_en').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('categories_slug_th_key').on(t.slugTh),
    uniqueIndex('categories_slug_en_key').on(t.slugEn),
    check('categories_slug_th_format', slugCheck(t.slugTh)),
    check('categories_slug_en_format', slugCheck(t.slugEn)),
  ],
);

export const products = pgTable(
  'products',
  {
    id: pk(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    sku: text('sku').notNull(),
    lotCode: text('lot_code').notNull(),
    purchaseMode: text('purchase_mode').notNull(),
    nameTh: text('name_th').notNull().default(''),
    nameEn: text('name_en').notNull().default(''),
    bodyTh: text('body_th'),
    bodyEn: text('body_en'),
    materialTh: text('material_th'),
    materialEn: text('material_en'),
    finishNoteTh: text('finish_note_th'),
    finishNoteEn: text('finish_note_en'),
    priceSatang: moneySatang('price_satang'),
    status: text('status').notNull().default('draft'),
    featured: boolean('featured').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    publishedAt: unixSeconds('published_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('products_sku_key').on(t.sku),
    index('products_category_idx').on(t.categoryId),
    index('products_status_idx').on(t.status),
    check('products_purchase_mode_check', sql`${t.purchaseMode} in ('cart', 'enquiry')`),
    check('products_status_check', sql`${t.status} in ('draft', 'published', 'archived')`),
    check('products_price_nonneg', sql`${t.priceSatang} is null or ${t.priceSatang} >= 0`),
    check(
      'products_cart_needs_price',
      sql`${t.purchaseMode} <> 'cart' or ${t.priceSatang} is not null`,
    ),
    check(
      'products_publish_completeness',
      sql`${t.status} <> 'published' or (${t.nameTh} <> '' and ${t.nameEn} <> '' and ${t.bodyTh} is not null and ${t.bodyEn} is not null)`,
    ),
  ],
);

export const productImages = pgTable(
  'product_images',
  {
    id: pk(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    altTh: text('alt_th'),
    altEn: text('alt_en'),
    position: integer('position').notNull().default(0),
    isPrimary: boolean('is_primary').notNull().default(false),
    widthLadder: jsonb('width_ladder').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('product_images_storage_key_key').on(t.storageKey),
    index('product_images_product_idx').on(t.productId, t.position),
  ],
);

export const productEnquiries = pgTable(
  'product_enquiries',
  {
    id: pk(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    ribbonText: text('ribbon_text').notNull(),
    deliveryDate: unixSeconds('delivery_date'),
    deliveryTimeNote: text('delivery_time_note'),
    venue: text('venue').notNull(),
    contactName: text('contact_name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    lineId: text('line_id'),
    message: text('message'),
    status: text('status').notNull().default('new'),
    handledByAdminId: uuid('handled_by_admin_id').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('product_enquiries_product_idx').on(t.productId),
    index('product_enquiries_status_time_idx').on(t.status, t.createdAt),
    check(
      'product_enquiries_status_check',
      sql`${t.status} in ('new', 'contacted', 'quoted', 'converted', 'closed')`,
    ),
  ],
);

import {
  pgTable,
  text,
  integer,
  boolean,
  uuid,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createdAt, moneySatang, pk, unixSeconds, updatedAt } from './_shared';
import { products } from './catalog';

export const coupons = pgTable(
  'coupons',
  {
    id: pk(),
    code: text('code').notNull(),
    kind: text('kind').notNull(),
    valuePercent: integer('value_percent'),
    valueSatang: moneySatang('value_satang'),
    startsAt: unixSeconds('starts_at'),
    endsAt: unixSeconds('ends_at'),
    maxRedemptions: integer('max_redemptions'),
    timesRedeemed: integer('times_redeemed').notNull().default(0),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('coupons_code_key').on(t.code),
    check('coupons_kind_check', sql`${t.kind} in ('percent', 'fixed')`),
    check(
      'coupons_single_value_shape',
      sql`(
        (${t.kind} = 'percent' and ${t.valuePercent} between 1 and 100 and ${t.valueSatang} is null)
        or
        (${t.kind} = 'fixed' and ${t.valueSatang} > 0 and ${t.valuePercent} is null)
      )`,
    ),
    check(
      'coupons_window_order',
      sql`${t.startsAt} is null or ${t.endsAt} is null or ${t.endsAt} >= ${t.startsAt}`,
    ),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: pk(),
    orderNo: text('order_no').notNull(),
    status: text('status').notNull().default('pending_payment'),
    contactName: text('contact_name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    addrLine1: text('addr_line1').notNull(),
    addrLine2: text('addr_line2'),
    subdistrict: text('subdistrict').notNull(),
    district: text('district').notNull(),
    province: text('province').notNull(),
    postcode: text('postcode').notNull(),
    shippingNote: text('shipping_note'),
    subtotalSatang: moneySatang('subtotal_satang').notNull(),
    discountSatang: moneySatang('discount_satang').notNull().default(0),
    shippingSatang: moneySatang('shipping_satang').notNull().default(0),
    totalSatang: moneySatang('total_satang').notNull(),
    couponId: uuid('coupon_id').references(() => coupons.id, { onDelete: 'set null' }),
    trackingNo: text('tracking_no'),
    placedAt: unixSeconds('placed_at').notNull(),
    paidAt: unixSeconds('paid_at'),
    shippedAt: unixSeconds('shipped_at'),
    completedAt: unixSeconds('completed_at'),
    cancelledAt: unixSeconds('cancelled_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('orders_order_no_key').on(t.orderNo),
    index('orders_status_placed_idx').on(t.status, t.placedAt),
    check(
      'orders_status_check',
      sql`${t.status} in ('pending_payment', 'awaiting_verification', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'refunded')`,
    ),
    check('orders_postcode_check', sql`${t.postcode} ~ '^[0-9]{5}$'`),
    check('orders_subtotal_nonneg', sql`${t.subtotalSatang} >= 0`),
    check('orders_discount_nonneg', sql`${t.discountSatang} >= 0`),
    check('orders_shipping_nonneg', sql`${t.shippingSatang} >= 0`),
    check('orders_total_nonneg', sql`${t.totalSatang} >= 0`),
    check(
      'orders_total_math',
      sql`${t.totalSatang} = ${t.subtotalSatang} - ${t.discountSatang} + ${t.shippingSatang}`,
    ),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: pk(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    sku: text('sku').notNull(),
    nameTh: text('name_th').notNull(),
    nameEn: text('name_en').notNull(),
    unitPriceSatang: moneySatang('unit_price_satang').notNull(),
    quantity: integer('quantity').notNull(),
    lineTotalSatang: moneySatang('line_total_satang').notNull(),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId),
    check('order_items_qty_positive', sql`${t.quantity} > 0`),
    check('order_items_unit_price_nonneg', sql`${t.unitPriceSatang} >= 0`),
    check(
      'order_items_line_total_math',
      sql`${t.lineTotalSatang} = ${t.unitPriceSatang} * ${t.quantity}`,
    ),
  ],
);

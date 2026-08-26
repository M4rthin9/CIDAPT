import { pgTable, text, integer, uuid, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createdAt, pk } from './_shared';
import { products } from './catalog';
import { adminUsers } from './admin';

export const inventoryLedger = pgTable(
  'inventory_ledger',
  {
    id: pk(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    delta: integer('delta').notNull(),
    reason: text('reason').notNull(),
    refType: text('ref_type'),
    refId: uuid('ref_id'),
    actorAdminId: uuid('actor_admin_id').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [
    index('inventory_ledger_product_time_idx').on(t.productId, t.createdAt),
    index('inventory_ledger_ref_idx').on(t.refType, t.refId),
    check(
      'inventory_ledger_reason_check',
      sql`${t.reason} in ('production_receipt', 'sale_reserve', 'sale_commit', 'reserve_release', 'shipment', 'damage', 'correction')`,
    ),
    check(
      'inventory_ledger_ref_type_check',
      sql`${t.refType} is null or ${t.refType} in ('order', 'stocktake', 'manual')`,
    ),
    check('inventory_ledger_delta_nonzero', sql`${t.delta} <> 0`),
  ],
);

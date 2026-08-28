import { pgTable, text, jsonb, uuid, index, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createdAt, moneySatang, pk, unixSeconds, updatedAt } from './_shared';
import { orders } from './orders';
import { adminUsers } from './admin';

export const payments = pgTable(
  'payments',
  {
    id: pk(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    rail: text('rail').notNull(),
    status: text('status').notNull().default('pending'),
    amountSatang: moneySatang('amount_satang').notNull(),
    transRef: text('trans_ref'),
    externalRef: text('external_ref'),
    providerPayload: jsonb('provider_payload'),
    verifiedVia: text('verified_via'),
    verifiedByAdminId: uuid('verified_by_admin_id').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    verifiedReason: text('verified_reason'),
    verifiedAt: unixSeconds('verified_at'),
    initiatedAt: unixSeconds('initiated_at').notNull(),
    settledAt: unixSeconds('settled_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('payments_trans_ref_key').on(t.transRef),
    uniqueIndex('payments_rail_external_key').on(t.rail, t.externalRef),
    index('payments_order_idx').on(t.orderId),
    index('payments_status_initiated_idx').on(t.status, t.initiatedAt),
    check(
      'payments_rail_check',
      sql`${t.rail} in ('promptpay_billpay', 'promptpay_ewallet', 'bank_transfer')`,
    ),
    check(
      'payments_status_check',
      sql`${t.status} in ('pending', 'awaiting_provider', 'verified', 'failed', 'cancelled', 'refund_recorded')`,
    ),
    check(
      'payments_verified_via_check',
      sql`${t.verifiedVia} is null or ${t.verifiedVia} in ('provider_lookup', 'statement_match', 'manual_override')`,
    ),
    check('payments_amount_positive', sql`${t.amountSatang} > 0`),
    // Non-negotiable #3/#4: a verified payment must carry a trans_ref that a
    // provider lookup (or matched statement line) can be keyed on.
    // Exception: manual_override (superadmin attests payment happened offline).
    // NOTE: use `verified_via is not null`, not `= 'manual_override'` — the
    // `= 'manual_override'` comparison against NULL yields UNKNOWN (NULL),
    // which satisfies a CHECK, so a bare `status = 'verified'` update with no
    // trans_ref and no verified_via would slip through.
    check(
      'payments_verified_has_trans_ref',
      sql`${t.status} <> 'verified' or ${t.transRef} is not null or ${t.verifiedVia} is not null`,
    ),
    check(
      'payments_manual_override_needs_reason',
      sql`${t.verifiedVia} <> 'manual_override' or ${t.verifiedReason} is not null`,
    ),
  ],
);

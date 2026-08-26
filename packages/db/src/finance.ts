import {
  pgTable,
  text,
  integer,
  uuid,
  index,
  uniqueIndex,
  check,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createdAt, moneySatang, pk, unixSeconds } from './_shared';
import { orders } from './orders';
import { adminUsers } from './admin';

// Gapless numbering (non-negotiable #6): a locked counter row per scope+period.
// SELECT ... FOR UPDATE, increment in tx. Never a Postgres SEQUENCE.
export const documentCounters = pgTable(
  'document_counters',
  {
    scope: text('scope').notNull(),
    period: text('period').notNull(),
    lastValue: integer('last_value').notNull().default(0),
    updatedAt: unixSeconds('updated_at').notNull(),
  },
  (t) => [
    primaryKey({ name: 'document_counters_pk', columns: [t.scope, t.period] }),
    check('document_counters_nonneg', sql`${t.lastValue} >= 0`),
    check(
      'document_counters_scope_check',
      sql`${t.scope} in ('order_no', 'tax_invoice', 'credit_note')`,
    ),
  ],
);

export const taxInvoices = pgTable(
  'tax_invoices',
  {
    id: pk(),
    invoiceNo: text('invoice_no').notNull(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    buyerName: text('buyer_name').notNull(),
    buyerTaxId: text('buyer_tax_id').notNull(),
    buyerBranchNo: text('buyer_branch_no'),
    buyerAddress: text('buyer_address').notNull(),
    subtotalSatang: moneySatang('subtotal_satang').notNull(),
    vatSatang: moneySatang('vat_satang').notNull(),
    totalSatang: moneySatang('total_satang').notNull(),
    issuedAt: unixSeconds('issued_at').notNull(),
    voidedAt: unixSeconds('voided_at'),
    pdfKey: text('pdf_key'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('tax_invoices_invoice_no_key').on(t.invoiceNo),
    uniqueIndex('tax_invoices_order_key').on(t.orderId),
    check('tax_invoices_taxid_check', sql`${t.buyerTaxId} ~ '^[0-9]{13}$'`),
    check(
      'tax_invoices_amounts_math',
      sql`${t.totalSatang} = ${t.subtotalSatang} + ${t.vatSatang}`,
    ),
  ],
);

export const creditNotes = pgTable(
  'credit_notes',
  {
    id: pk(),
    noteNo: text('note_no').notNull(),
    taxInvoiceId: uuid('tax_invoice_id')
      .notNull()
      .references(() => taxInvoices.id, { onDelete: 'restrict' }),
    reasonCode: text('reason_code').notNull(),
    reasonDetail: text('reason_detail').notNull(),
    subtotalSatang: moneySatang('subtotal_satang').notNull(),
    vatSatang: moneySatang('vat_satang').notNull(),
    totalSatang: moneySatang('total_satang').notNull(),
    approvedByAdminId: uuid('approved_by_admin_id').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    issuedAt: unixSeconds('issued_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('credit_notes_note_no_key').on(t.noteNo),
    index('credit_notes_invoice_idx').on(t.taxInvoiceId),
    check(
      'credit_notes_reason_check',
      sql`${t.reasonCode} in ('pricing_error', 'returned_goods', 'cancellation')`,
    ),
    check(
      'credit_notes_amounts_math',
      sql`${t.totalSatang} = ${t.subtotalSatang} + ${t.vatSatang}`,
    ),
  ],
);

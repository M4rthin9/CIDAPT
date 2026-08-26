import { z } from 'zod';
import { idSchema, nonnegSatangSchema, orderNoSchema, unixSecondsSchema } from './shared';

export const railSchema = z.enum(['promptpay_billpay', 'promptpay_ewallet', 'bank_transfer']);

export const paymentStatusSchema = z.enum([
  'pending',
  'awaiting_provider',
  'verified',
  'failed',
  'cancelled',
  'refund_recorded',
]);

export const paymentInitiateSchema = z.object({
  orderId: idSchema,
  rail: railSchema,
  amountSatang: z.number().int().positive(),
});

// Provider-agnostic ingestion for the ReconciliationProvider interface (D3).
export const reconciliationEventSchema = z
  .object({
    rail: railSchema,
    transRef: z.string().min(6).max(64).optional(),
    externalRef: z.string().min(1).max(64).optional(),
    ref1: orderNoSchema.optional(),
    amountSatang: z.number().int().positive(),
    occurredAt: unixSecondsSchema,
    raw: z.unknown().optional(),
  })
  .refine((e) => e.transRef !== undefined || e.externalRef !== undefined || e.ref1 !== undefined, {
    message: 'at least one of transRef, externalRef or ref1 is required',
  });

// superadmin only; typed reason is mandatory and lands in audit_log as red.
export const manualVerifySchema = z.object({
  paymentId: idSchema,
  reason: z.string().trim().min(15).max(500),
});

export const paymentRecordSchema = z.object({
  id: idSchema,
  orderId: idSchema,
  rail: railSchema,
  status: paymentStatusSchema,
  amountSatang: nonnegSatangSchema,
  transRef: z.string().nullable(),
  verifiedAt: unixSecondsSchema.nullable(),
});

import { z } from 'zod';
import { idSchema, unixSecondsSchema } from './shared';

export const ledgerReasonSchema = z.enum([
  'production_receipt',
  'sale_reserve',
  'sale_commit',
  'reserve_release',
  'shipment',
  'damage',
  'correction',
]);

export const ledgerRefTypeSchema = z.enum(['order', 'stocktake', 'manual']);

export const ledgerEntryCreateSchema = z
  .object({
    productId: idSchema,
    delta: z
      .number()
      .int()
      .refine((d) => d !== 0, { message: 'delta must be non-zero' }),
    reason: ledgerReasonSchema,
    refType: ledgerRefTypeSchema.nullable(),
    refId: idSchema.nullable(),
    note: z.string().max(500).nullable(),
    createdAt: unixSecondsSchema.optional(),
  })
  .refine((e) => (e.refId === null) === (e.refType === null), {
    message: 'refType and refId must be provided together',
  });

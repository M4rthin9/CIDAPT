import { z } from 'zod';
import { idSchema, nonnegSatangSchema, unixSecondsSchema } from './shared';

export const taxInvoiceIssueSchema = z.object({
  orderId: idSchema,
  buyerName: z.string().min(1).max(200),
  buyerTaxId: z.string().regex(/^\d{13}$/),
  buyerBranchNo: z
    .string()
    .regex(/^\d{1,5}$/)
    .optional(),
  buyerAddress: z.string().min(1).max(400),
  issuedAt: unixSecondsSchema.optional(),
});

export const creditNoteCreateSchema = z.object({
  taxInvoiceId: idSchema,
  reasonCode: z.enum(['pricing_error', 'returned_goods', 'cancellation']),
  reasonDetail: z.string().min(5).max(500),
  subtotalSatang: nonnegSatangSchema,
  vatSatang: nonnegSatangSchema,
  approvedAt: unixSecondsSchema.optional(),
});

export type TaxInvoiceIssue = z.infer<typeof taxInvoiceIssueSchema>;
export type CreditNoteCreate = z.infer<typeof creditNoteCreateSchema>;

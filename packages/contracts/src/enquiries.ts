import { z } from 'zod';
import { idSchema, phoneSchema, unixSecondsSchema } from './shared';

export const enquirySubmitSchema = z.object({
  productId: idSchema,
  ribbonText: z.string().min(1).max(120),
  deliveryDate: unixSecondsSchema.optional(),
  deliveryTimeNote: z.string().max(60).optional(),
  venue: z.string().min(1).max(200),
  contactName: z.string().min(1).max(120),
  phone: phoneSchema,
  email: z.email().optional(),
  lineId: z.string().max(50).optional(),
  message: z.string().max(1000).optional(),
});

export const enquiryStatusUpdateSchema = z.object({
  enquiryId: idSchema,
  status: z.enum(['new', 'contacted', 'quoted', 'converted', 'closed']),
  handledByAdminId: idSchema.optional(),
});

export type EnquirySubmit = z.infer<typeof enquirySubmitSchema>;

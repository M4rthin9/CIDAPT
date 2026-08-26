import { z } from 'zod';
import { idSchema, phoneSchema, postcodeSchema, unixSecondsSchema } from './shared';

export const couponKindSchema = z.enum(['percent', 'fixed']);

export const couponUpsertSchema = z
  .object({
    code: z.string().regex(/^[A-Z0-9_-]{1,32}$/),
    kind: couponKindSchema,
    valuePercent: z.number().int().min(1).max(100).nullable(),
    valueSatang: z.number().int().positive().nullable(),
    startsAt: unixSecondsSchema.nullable(),
    endsAt: unixSecondsSchema.nullable(),
    maxRedemptions: z.number().int().positive().nullable(),
    active: z.boolean().default(true),
  })
  .refine(
    (c) =>
      (c.kind === 'percent' && c.valuePercent !== null && c.valueSatang === null) ||
      (c.kind === 'fixed' && c.valueSatang !== null && c.valuePercent === null),
    { message: 'value must match the coupon kind' },
  )
  .refine((c) => c.startsAt === null || c.endsAt === null || c.endsAt >= c.startsAt, {
    message: 'coupon window ends before it starts',
  });

export const shippingAddressSchema = z.object({
  addrLine1: z.string().min(3).max(160),
  addrLine2: z.string().max(160).optional(),
  subdistrict: z.string().min(1).max(100),
  district: z.string().min(1).max(100),
  province: z.string().min(1).max(100),
  postcode: postcodeSchema,
});

export const checkoutItemSchema = z.object({
  productId: idSchema,
  quantity: z.number().int().min(1).max(99),
});

export const checkoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1).max(50),
  couponCode: z
    .string()
    .regex(/^[A-Z0-9_-]{1,32}$/)
    .optional(),
  contactName: z.string().min(1).max(120),
  phone: phoneSchema,
  email: z.email().optional(),
  shipping: shippingAddressSchema,
  shippingNote: z.string().max(500).optional(),
  placedAt: unixSecondsSchema.optional(),
});

export const orderStatusUpdateSchema = z.object({
  orderId: idSchema,
  status: z.enum([
    'pending_payment',
    'awaiting_verification',
    'paid',
    'processing',
    'shipped',
    'completed',
    'cancelled',
    'refunded',
  ]),
  trackingNo: z.string().max(60).optional(),
  occurredAt: unixSecondsSchema.optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type OrderStatusUpdate = z.infer<typeof orderStatusUpdateSchema>;

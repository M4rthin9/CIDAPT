import { z } from 'zod';
import { idSchema, nonnegSatangSchema, slugSchema, unixSecondsSchema } from './shared';

export const purchaseModeSchema = z.enum(['cart', 'enquiry']);
export const productStatusSchema = z.enum(['draft', 'published', 'archived']);

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v));

export const divisionUpsertSchema = z.object({
  code: slugSchema,
  nameTh: z.string().min(1).max(120),
  nameEn: z.string().min(1).max(120),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const categoryUpsertSchema = z.object({
  divisionCode: slugSchema,
  slugTh: slugSchema,
  slugEn: slugSchema,
  nameTh: z.string().min(1).max(120),
  nameEn: z.string().min(1).max(120),
  sortOrder: z.number().int().nonnegative().default(0),
});

const productCore = z.object({
  categoryId: idSchema,
  sku: z.string().regex(/^[A-Z0-9-]{1,40}$/),
  lotCode: z.string().regex(/^[A-Z0-9-]{1,24}$/),
  purchaseMode: purchaseModeSchema,
  nameTh: z.string().max(200),
  nameEn: z.string().max(200),
  bodyTh: z.string().nullable(),
  bodyEn: z.string().nullable(),
  materialTh: z.string().max(160).nullable(),
  materialEn: z.string().max(160).nullable(),
  finishNoteTh: z.string().max(300).nullable(),
  finishNoteEn: z.string().max(300).nullable(),
  priceSatang: nonnegSatangSchema.nullable(),
});

// Mirrors the DB CHECKs so the API rejects before Postgres does.
export const productUpsertSchema = productCore.refine(
  (p) => p.purchaseMode !== 'cart' || p.priceSatang !== null,
  { message: 'cart products require a price' },
);

export const productPublishSchema = productCore
  .and(
    z.object({
      status: z.literal('published'),
      publishedAt: unixSecondsSchema.optional(),
    }),
  )
  .refine(
    (p) => p.nameTh.length > 0 && p.nameEn.length > 0 && p.bodyTh !== null && p.bodyEn !== null,
    { message: 'both languages are required to publish' },
  );

export const productImageAttachSchema = z.object({
  productId: idSchema,
  storageKey: z.string().min(3).max(300),
  altTh: optionalText(200).nullable(),
  altEn: optionalText(200).nullable(),
  position: z.number().int().nonnegative().default(0),
  isPrimary: z.boolean().default(false),
  widthLadder: z.array(z.number().int().positive()).min(1),
});

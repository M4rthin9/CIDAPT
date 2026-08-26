import { z } from 'zod';
import { slugSchema, unixSecondsSchema } from './shared';

export const publishStatusSchema = z.enum(['draft', 'published']);

export const pageUpsertSchema = z
  .object({
    slugTh: slugSchema,
    slugEn: slugSchema,
    titleTh: z.string().max(200),
    titleEn: z.string().max(200),
    bodyTh: z.string().nullable(),
    bodyEn: z.string().nullable(),
    status: publishStatusSchema,
    publishedAt: unixSecondsSchema.optional(),
  })
  .refine(
    (p) =>
      p.status !== 'published' ||
      (p.titleTh.length > 0 &&
        p.titleEn.length > 0 &&
        p.bodyTh !== null &&
        p.bodyTh.length > 0 &&
        p.bodyEn !== null &&
        p.bodyEn.length > 0),
    { message: 'both languages are required to publish' },
  );

export const newsUpsertSchema = z
  .object({
    slugTh: slugSchema,
    slugEn: slugSchema,
    titleTh: z.string().max(200),
    titleEn: z.string().max(200),
    excerptTh: z.string().max(400).nullable(),
    excerptEn: z.string().max(400).nullable(),
    bodyTh: z.string().nullable(),
    bodyEn: z.string().nullable(),
    heroImageKey: z.string().min(3).max(300).nullable(),
    status: publishStatusSchema,
    publishAt: unixSecondsSchema.nullable(),
    publishedAt: unixSecondsSchema.optional(),
  })
  .refine(
    (n) =>
      n.status !== 'published' ||
      (n.titleTh.length > 0 &&
        n.titleEn.length > 0 &&
        n.bodyTh !== null &&
        n.bodyTh.length > 0 &&
        n.bodyEn !== null &&
        n.bodyEn.length > 0),
    { message: 'both languages are required to publish' },
  );

export const eventUpsertSchema = z
  .object({
    titleTh: z.string().max(200),
    titleEn: z.string().max(200),
    descriptionTh: z.string().nullable(),
    descriptionEn: z.string().nullable(),
    locationTh: z.string().max(200).nullable(),
    locationEn: z.string().max(200).nullable(),
    startsAt: unixSecondsSchema,
    endsAt: unixSecondsSchema.nullable(),
    heroImageKey: z.string().min(3).max(300).nullable(),
    status: publishStatusSchema,
    publishedAt: unixSecondsSchema.optional(),
  })
  .refine((e) => e.endsAt === null || e.endsAt >= e.startsAt, {
    message: 'event ends before it starts',
  })
  .refine(
    (e) =>
      e.status !== 'published' ||
      (e.titleTh.length > 0 &&
        e.titleEn.length > 0 &&
        e.descriptionTh !== null &&
        e.descriptionTh.length > 0 &&
        e.descriptionEn !== null &&
        e.descriptionEn.length > 0),
    { message: 'both languages are required to publish' },
  );

export const bannerUpsertSchema = z
  .object({
    placement: z.enum(['home_hero', 'home_promo']),
    imageKey: z.string().min(3).max(300),
    altTh: z.string().min(1).max(200),
    altEn: z.string().min(1).max(200),
    linkPathTh: z.string().regex(/^\//).max(300).nullable(),
    linkPathEn: z.string().regex(/^\//).max(300).nullable(),
    sortOrder: z.number().int().nonnegative().default(0),
    active: z.boolean().default(true),
    startsAt: unixSecondsSchema.nullable(),
    endsAt: unixSecondsSchema.nullable(),
  })
  .refine((b) => b.startsAt === null || b.endsAt === null || b.endsAt >= b.startsAt, {
    message: 'banner window ends before it starts',
  });

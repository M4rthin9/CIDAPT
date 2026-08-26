import { z } from 'zod';

export const errorDetailSchema = z.record(z.string(), z.unknown());

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message_th: z.string(),
    message_en: z.string(),
    details: errorDetailSchema.optional(),
    request_id: z.string().optional(),
  }),
});

export const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});

export function successEnvelope<T extends z.ZodType>(data: T) {
  return z.object({ data });
}

export function listEnvelope<T extends z.ZodType>(data: T) {
  return z.object({ data: z.array(data), meta: paginationMetaSchema });
}

export type ApiError = z.infer<typeof apiErrorSchema>;

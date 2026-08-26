import { z } from 'zod';
import { idSchema, SETTING_KEY_RE, unixSecondsSchema } from './shared';

export const settingsSetSchema = z.object({
  key: z.string().regex(SETTING_KEY_RE),
  value: z.unknown(),
  valueType: z.enum(['string', 'number', 'boolean', 'json']),
  description: z.string().min(1).max(300),
});

export const redirectCreateSchema = z.object({
  fromPath: z
    .string()
    .regex(/^\/\S*$/)
    .max(300),
  toPath: z
    .string()
    .regex(/^\/\S*$/)
    .max(300),
  permanent: z.boolean().default(true),
});

export const consentTypeSchema = z.enum(['marketing', 'analytics']);

export const consentRecordSchema = z.object({
  subjectEmail: z.email(),
  consentType: consentTypeSchema,
  policyVersion: z.string().regex(/^\d+\.\d+$/),
  granted: z.boolean(),
  source: z.string().min(1).max(60),
  orderId: idSchema.optional(),
});

export const auditEntryWriteSchema = z.object({
  actorAdminId: idSchema.nullable(),
  action: z.string().min(3).max(80),
  severity: z.enum(['normal', 'red']).default('normal'),
  entityType: z.string().min(1).max(60),
  entityId: z.string().max(64).nullable(),
  beforeState: z.unknown().nullable(),
  afterState: z.unknown().nullable(),
  requestId: z.string().max(64).nullable(),
  ip: z.string().max(45).nullable(),
  createdAt: unixSecondsSchema.optional(),
});

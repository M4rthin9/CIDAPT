import { z } from 'zod';
import { idSchema } from './shared';

export const adminRoleSchema = z.enum(['superadmin', 'admin', 'officer']);

export const adminUserCreateSchema = z.object({
  email: z.email(),
  password: z.string().min(10).max(128),
  displayName: z.string().min(1).max(120),
  role: adminRoleSchema,
});

export const adminUserUpdateSchema = z.object({
  id: idSchema,
  displayName: z.string().min(1).max(120).optional(),
  role: adminRoleSchema.optional(),
  active: z.boolean().optional(),
});

export const adminUserPasswordResetSchema = z.object({
  id: idSchema,
  password: z.string().min(10).max(128),
});

export type AdminUserCreate = z.infer<typeof adminUserCreateSchema>;
export type AdminUserUpdate = z.infer<typeof adminUserUpdateSchema>;

import { Hono } from 'hono';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { adminUsers } from '@cida/db/schema';
import { authMiddleware, hashPassword } from '../middleware/auth';
import { requireMinRole } from '../middleware/rbac';
import { writeAuditLog } from '../middleware/audit';
import { AppError, mustRow } from '../errors';
import {
  adminUserCreateSchema,
  adminUserPasswordResetSchema,
  adminUserUpdateSchema,
} from '@cida/contracts';

const adminUserRoutes = new Hono();

// Superadmin only — managing operators is the highest privilege.
adminUserRoutes.use('*', authMiddleware);
adminUserRoutes.use('*', requireMinRole('superadmin'));

const PUBLIC_FIELDS = {
  id: adminUsers.id,
  email: adminUsers.email,
  displayName: adminUsers.displayName,
  role: adminUsers.role,
  active: adminUsers.active,
  lastLoginAt: adminUsers.lastLoginAt,
  createdAt: adminUsers.createdAt,
};

adminUserRoutes.get('/', async (c) => {
  const rows = await db.instance
    .select(PUBLIC_FIELDS)
    .from(adminUsers)
    .orderBy(asc(adminUsers.email));
  return c.json({ data: rows });
});

adminUserRoutes.post('/', async (c) => {
  const parsed = adminUserCreateSchema.safeParse(await c.req.json());
  if (!parsed.success) throw validationError(parsed.error);
  const now = Math.floor(Date.now() / 1000);

  const [existing] = await db.instance
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, parsed.data.email.toLowerCase()))
    .limit(1);
  if (existing) {
    throw new AppError('admin_user_exists', 'อีเมลนี้ถูกใช้แล้ว', 'Email already in use', 409);
  }

  const [inserted] = await db.instance
    .insert(adminUsers)
    .values({
      email: parsed.data.email.toLowerCase(),
      passwordHash: hashPassword(parsed.data.password),
      displayName: parsed.data.displayName,
      role: parsed.data.role,
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning(PUBLIC_FIELDS);
  const row = mustRow(inserted, 'admin user');

  await writeAuditLog(c, {
    action: 'admin_user.create',
    entityType: 'admin_user',
    entityId: row.id,
    afterState: row,
  });
  return c.json({ data: row });
});

adminUserRoutes.put('/:id', async (c) => {
  const parsed = adminUserUpdateSchema.safeParse({
    id: c.req.param('id'),
    ...(await c.req.json()),
  });
  if (!parsed.success) throw validationError(parsed.error);
  const { id, ...patch } = parsed.data;

  const [existing] = await db.instance
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .limit(1);
  if (!existing) throw new AppError('admin_user_not_found', 'ไม่พบผู้ใช้', 'User not found', 404);

  // Guard: never deactivate or demote the last remaining superadmin.
  if (existing.role === 'superadmin' && parsed.data.active === false) {
    const superAdmins = await db.instance
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.role, 'superadmin'));
    if (superAdmins.length <= 1) {
      throw new AppError(
        'last_superadmin',
        'ไม่สามารถปิดใช้งานผู้ดูแลระบบสุดท้ายได้',
        'Cannot deactivate the last superadmin',
        409,
      );
    }
  }

  const [row] = await db.instance
    .update(adminUsers)
    .set({ ...patch, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(adminUsers.id, id))
    .returning(PUBLIC_FIELDS);

  await writeAuditLog(c, {
    action: 'admin_user.update',
    entityType: 'admin_user',
    entityId: id,
    beforeState: existing,
    afterState: row,
  });
  return c.json({ data: row });
});

adminUserRoutes.post('/:id/reset-password', async (c) => {
  const parsed = adminUserPasswordResetSchema.safeParse({
    id: c.req.param('id'),
    ...(await c.req.json()),
  });
  if (!parsed.success) throw validationError(parsed.error);

  const [existing] = await db.instance
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, parsed.data.id))
    .limit(1);
  if (!existing) throw new AppError('admin_user_not_found', 'ไม่พบผู้ใช้', 'User not found', 404);

  const [row] = await db.instance
    .update(adminUsers)
    .set({
      passwordHash: hashPassword(parsed.data.password),
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(adminUsers.id, parsed.data.id))
    .returning(PUBLIC_FIELDS);

  await writeAuditLog(c, {
    action: 'admin_user.reset_password',
    entityType: 'admin_user',
    entityId: parsed.data.id,
    beforeState: existing,
    afterState: { passwordReset: true },
  });
  return c.json({ data: row });
});

function validationError(err: import('zod').ZodError): AppError {
  return new AppError(
    'validation_error',
    'ข้อมูลไม่ถูกต้อง',
    'Invalid input',
    422,
    Object.fromEntries(err.issues.map((i) => [i.path.join('.'), i.message])),
  );
}

export default adminUserRoutes;

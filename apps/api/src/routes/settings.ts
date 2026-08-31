import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db.js';
import { settingsRegistry } from '@cida/db/schema';
import { authMiddleware } from '../middleware/auth.js';
import { requireMinRole } from '../middleware/rbac.js';
import { writeAuditLog } from '../middleware/audit.js';
import { AppError } from '../errors.js';
import { settingsSetSchema } from '@cida/contracts';

const settings = new Hono();

// All settings routes require auth + superadmin
settings.use('*', authMiddleware);
settings.use('*', requireMinRole('superadmin'));

settings.get('/', async (c) => {
  const rows = await db.instance.select().from(settingsRegistry);
  return c.json({ data: rows });
});

settings.get('/:key', async (c) => {
  const key = c.req.param('key');
  const [row] = await db.instance
    .select()
    .from(settingsRegistry)
    .where(eq(settingsRegistry.key, key))
    .limit(1);

  if (!row) {
    throw new AppError('settings_not_found', 'ไม่พบตั้งค่า', 'Setting not found', 404);
  }

  return c.json({ data: row });
});

settings.put('/:key', async (c) => {
  const key = c.req.param('key');
  const body = await c.req.json();
  const parsed = settingsSetSchema.safeParse({ ...body, key });
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'ข้อมูลไม่ถูกต้อง',
      'Invalid input',
      422,
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    );
  }

  const adminUserId = c.get('adminUserId') as string;
  const now = Math.floor(Date.now() / 1000);

  const [existing] = await db.instance
    .select()
    .from(settingsRegistry)
    .where(eq(settingsRegistry.key, key))
    .limit(1);

  if (existing) {
    await writeAuditLog(c, {
      action: 'settings.update',
      entityType: 'settings_registry',
      entityId: key,
      beforeState: existing,
      afterState: parsed.data,
    });

    await db.instance
      .update(settingsRegistry)
      .set({
        value: parsed.data.value,
        valueType: parsed.data.valueType,
        description: parsed.data.description,
        updatedByAdminId: adminUserId,
        updatedAt: now,
      })
      .where(eq(settingsRegistry.key, key));
  } else {
    await writeAuditLog(c, {
      action: 'settings.create',
      entityType: 'settings_registry',
      entityId: key,
      afterState: parsed.data,
    });

    await db.instance.insert(settingsRegistry).values({
      key,
      value: parsed.data.value,
      valueType: parsed.data.valueType,
      description: parsed.data.description,
      updatedByAdminId: adminUserId,
      createdAt: now,
      updatedAt: now,
    });
  }

  return c.json({ data: { key, updated: true } });
});

settings.delete('/:key', async (c) => {
  const key = c.req.param('key');

  const [existing] = await db.instance
    .select()
    .from(settingsRegistry)
    .where(eq(settingsRegistry.key, key))
    .limit(1);

  if (!existing) {
    throw new AppError('settings_not_found', 'ไม่พบตั้งค่า', 'Setting not found', 404);
  }

  await writeAuditLog(c, {
    action: 'settings.delete',
    entityType: 'settings_registry',
    entityId: key,
    beforeState: existing,
  });

  await db.instance.delete(settingsRegistry).where(eq(settingsRegistry.key, key));

  return c.json({ data: { key, deleted: true } });
});

export default settings;

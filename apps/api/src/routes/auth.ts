import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { db } from '../db';
import { adminUsers } from '@cida/db/schema';
import { authMiddleware, verifyPassword, createSession, setSessionCookie, clearSessionCookie, destroySession } from '../middleware/auth';
import { writeAuditLog } from '../middleware/audit';
import { AppError } from '../errors';

const authRoutes = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRoutes.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      'validation_error',
      'ข้อมูลไม่ถูกต้อง',
      'Invalid input',
      422,
      Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
    );
  }

  const { email, password } = parsed.data;

  const [user] = await db.instance
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    throw new AppError(
      'auth_invalid_credentials',
      'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      'Invalid email or password',
      401,
    );
  }

  const token = await createSession(user.id);

  // Update last login
  await db.instance
    .update(adminUsers)
    .set({ lastLoginAt: Math.floor(Date.now() / 1000) })
    .where(eq(adminUsers.id, user.id));

  await writeAuditLog(c, {
    action: 'login',
    entityType: 'admin_user',
    entityId: user.id,
  });

  setSessionCookie(c, token);

  return c.json({
    data: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
  });
});

authRoutes.post('/logout', authMiddleware, async (c) => {
  const token = c.req.header('cookie')?.match(/cida_session=([^;]+)/)?.[1];
  if (token) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await destroySession(tokenHash);
  }

  clearSessionCookie(c);

  return c.json({ data: { message: 'Logged out' } });
});

authRoutes.get('/me', authMiddleware, (c) => {
  return c.json({
    data: {
      id: c.get('adminUserId'),
      email: c.get('adminEmail'),
      displayName: c.get('adminDisplayName'),
      role: c.get('adminRole'),
    },
  });
});

export default authRoutes;

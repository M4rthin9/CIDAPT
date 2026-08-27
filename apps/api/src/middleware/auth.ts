import type { Context, Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { createHash, randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db';
import { adminUsers, sessions } from '@cida/db/schema';
import { getEnv } from '../config';
import { AppError } from '../errors';

const COOKIE_NAME = 'cida_session';
const ITERATIONS = 100_000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

export function hashPassword(password: string, salt?: string): string {
  const s = salt ?? randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, s, ITERATIONS, KEY_LENGTH, DIGEST);
  return `${s}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, 'hex');
  const candidate = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return timingSafeEqual(hashBuf, candidate);
}

function createSessionToken(): string {
  return randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(adminUserId: string): Promise<string> {
  const env = getEnv();
  const token = createSessionToken();
  const tokenHash = hashToken(token);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + env.SESSION_TTL_HOURS * 3600;

  await db.instance.insert(sessions).values({
    adminUserId,
    tokenHash,
    expiresAt,
    createdAt: now,
  });

  return token;
}

export async function destroySession(tokenHash: string): Promise<void> {
  await db.instance.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function authMiddleware(c: Context, next: Next) {
  const env = getEnv();
  const token = getCookie(c, COOKIE_NAME);

  if (!token) {
    throw new AppError(
      'auth_required',
      'กรุณาเข้าสู่ระบบ',
      'Authentication required',
      401,
    );
  }

  const tokenHash = hashToken(token);
  const now = Math.floor(Date.now() / 1000);

  const [session] = await db.instance
    .select({
      id: sessions.id,
      adminUserId: sessions.adminUserId,
      role: adminUsers.role,
      email: adminUsers.email,
      displayName: adminUsers.displayName,
      active: adminUsers.active,
    })
    .from(sessions)
    .innerJoin(adminUsers, eq(sessions.adminUserId, adminUsers.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, now),
        eq(adminUsers.active, true),
      ),
    )
    .limit(1);

  if (!session) {
    deleteCookie(c, COOKIE_NAME, {
      path: '/',
      domain: env.COOKIE_DOMAIN,
    });
    throw new AppError(
      'session_expired',
      'เซสชันหมดอายุ',
      'Session expired',
      401,
    );
  }

  c.set('adminUserId', session.adminUserId);
  c.set('adminRole', session.role);
  c.set('adminEmail', session.email);
  c.set('adminDisplayName', session.displayName);

  await next();
}

export function setSessionCookie(c: Context, token: string) {
  const env = getEnv();
  setCookie(c, COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'Lax',
    domain: env.COOKIE_DOMAIN,
    maxAge: env.SESSION_TTL_HOURS * 3600,
  });
}

export function clearSessionCookie(c: Context) {
  const env = getEnv();
  deleteCookie(c, COOKIE_NAME, {
    path: '/',
    domain: env.COOKIE_DOMAIN,
  });
}

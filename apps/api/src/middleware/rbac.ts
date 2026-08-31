import type { Context, Next } from 'hono';
import { AppError } from '../errors.js';

const ROLE_HIERARCHY: Record<string, number> = {
  officer: 1,
  admin: 2,
  superadmin: 3,
};

export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const role = c.get('adminRole') as string | undefined;
    if (!role || !roles.includes(role)) {
      throw new AppError('forbidden', 'ไม่มีสิทธิ์เข้าถึง', 'Insufficient permissions', 403);
    }
    await next();
  };
}

export function requireMinRole(minRole: string) {
  return async (c: Context, next: Next) => {
    const role = c.get('adminRole') as string | undefined;
    const roleLevel = ROLE_HIERARCHY[role ?? ''] ?? 0;
    const minLevel = ROLE_HIERARCHY[minRole] ?? 999;

    if (roleLevel < minLevel) {
      throw new AppError('forbidden', 'ไม่มีสิทธิ์เข้าถึง', 'Insufficient permissions', 403);
    }
    await next();
  };
}
